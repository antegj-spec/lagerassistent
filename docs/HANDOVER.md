# HANDOVER — Lagerassistent

> **Detta dokument ger dig (Claude) full kontext för att fortsätta arbetet utan att läsa hela tidigare session.**
> Läs hela detta dokument INNAN du börjar koda. Det innehåller arkitekturbeslut, kända fallgropar och prioriterad plan.

---

## 0. TL;DR

Lagerassistent är en plain HTML/JS-webapp (no build) för en svensk eventlagerverksamhet, deployad på Netlify med Supabase-backend. ~5 användare, vardaglig produktionsanvändning.

**Status (per 2026-05-23):** Fas 1 (säkerhet) klar och deployad. RLS aktiverat på 20 tabeller, bcrypt-PIN via Edge Functions, JWT-auth, härdad backend. **Fas 2-6 återstår** enligt detaljerad plan nedan.

**Arbetsmodell mellan användare och dig (Claude):**
- Användaren är Admin på Supabase + Netlify, kan köra SQL och deploya Edge Functions
- Användaren testar på Windows + PowerShell, kör lokalt med `npx serve . -p 8000`
- Användaren föredrar steg-för-steg-flöde med verifiering mellan
- **Aldrig** committa/pusha/merga utan användarens explicita OK
- **Aldrig** köra DB-ändringar utan backup först

---

## 1. Kodbasens arkitektur (efter Fas 1)

### Filstruktur
```
lagerassistent/
├── index.html              # SPA-skal med PIN-screen, nav, main
├── style.css               # ~634 rader CSS, ljust + mörkt tema
├── js/
│   ├── config.js           # Konstanter, ENUMs, globala state-variabler (let)
│   ├── supabase.js         # sb()-wrapper, alla DB/Storage-funktioner
│   ├── auth.js             # PIN-login, JWT-restore, byt-PIN
│   ├── ui.js               # esc/escAttr, modal, toast, AI-funktioner
│   ├── render.js           # 1212 rader — bygger innerHTML per tab
│   └── actions.js          # 1458 rader — alla user-action-handlers
├── netlify/functions/
│   ├── claude.js           # AI-proxy, JWT-skyddad
│   └── send-weekly.js      # Veckomail, JWT/CRON_SECRET-skyddad
├── supabase/functions/
│   ├── verify-pin/         # Edge Function: bcrypt-PIN-check + JWT
│   └── change-pin/         # Edge Function: säker PIN-byte
├── migrations/             # 001-010 — kördes manuellt via SQL Editor
├── docs/
│   ├── SECURITY.md         # Säkerhetsmodell, rollback-procedurer
│   └── HANDOVER.md         # ← DETTA DOKUMENT
├── netlify.toml            # Functions-config + SECRETS_SCAN_OMIT_KEYS
├── .gitignore              # .claude/, backups/, node_modules/, etc.
└── CLAUDE.md               # Original projekt-instruktioner (läs först!)
```

### Script load-order (KRITISKT)
```html
<script src="js/config.js"></script>     <!-- 1: globala konstanter + state -->
<script src="js/supabase.js"></script>   <!-- 2: behöver config -->
<script src="js/auth.js"></script>       <!-- 3: behöver supabase. OBS: använder escAttr från ui.js -->
<script src="js/ui.js"></script>         <!-- 4: definierar escAttr -->
<script src="js/render.js"></script>     <!-- 5: behöver ui -->
<script src="js/actions.js"></script>    <!-- 6: behöver alla ovan -->
```

**FALLGROP:** auth.js använder `escAttr` (från ui.js) men laddas FÖRE ui.js. Lösningen är `DOMContentLoaded`-listener i auth.js boot. **Rör inte detta utan att förstå varför.** Se commit `539a336`.

### State-modell
- Alla state-variabler är `let` på modul-nivå i `config.js` (60+ stycken)
- Mutationer sker direkt från actions.js, supabase.js, auth.js, ui.js, render.js
- Ingen reactive store, ingen subscription — vid varje state-change anropas `render()` som rebuildar hela tabbens innerHTML
- **Detta är teknisk skuld** som Fas 4 adresserar

### Dataflöde för varje user-action
1. User triggar `actions.js`-funktion (oftast inline `onclick`)
2. Funktion uppdaterar Supabase via `sb()` i supabase.js
3. Kallar matching `load*()` för att uppdatera in-memory state
4. Kallar `render()` för att bygga om tab-HTML
5. Efter render körs `bindEvents()` för icke-inline event listeners (note-input auto-classifier)

---

## 2. Säkerhetsmodell (Fas 1, live)

### Auth-flow
1. User skriver PIN på PIN-skärm
2. `auth.js:checkPin` POSTar till `https://tzidalknfoumoknhsetx.supabase.co/functions/v1/verify-pin`
3. Edge Function bcrypt-jämför mot `user_pins.pin_hash`
4. Vid OK: `signInAnonymously` med `user_name` + `role` i `user_metadata`
5. Returnerar JWT, sparas i `sessionStorage`
6. `sb()` skickar JWT istället för anon-key
7. RLS-policies på alla tabeller binder operations till `current_user_name()` / `is_admin()`

### Lockout
5 fel PIN-försök → låst 5 min (`user_pins.locked_until`)

### Roller
- `admin` (Admin) — full CRUD, ser AI/Export/Trash-flikar
- `intern_user` (Andreas) — ser dessutom `notes` med `category = 'intern'`
- `user` (Nicklas, Per, Johannes) — standardanvändare

### Session-restore (F5)
`auth.js:restoreSession` validerar JWT mot `/auth/v1/user` vid sidladdning. Vid 200 → identity läses från JWT-claims (källan-till-sanning), INTE från sessionStorage.

### Säkerhetsbeslut: 4 tabeller utanför RLS (Alt C)
Branch-features som inte lever på main än:
- `cars` (branch-feature)
- `drive_logs` (branch-feature)
- `info_pdfs` (branch-feature, RLS inte ens aktiverat)
- `materials` (legacy, 0 rader, ersatt av materials_v2)

**TODO för Fas 3 eller när respektive branch mergas:** härda dessa.

### Edge Functions
- `verify-pin` — login. Använder `bcryptjs@2.4.3` från esm.sh (INTE `deno.land/x/bcrypt` — det hade kompatibilitetsproblem med PG `crypt()`).
- `change-pin` — säker PIN-byte. Kräver JWT.

### Netlify Functions (skyddade)
- `claude.js` — AI-proxy. Kräver JWT med `role=admin`.
- `send-weekly.js` — Veckomail. Kräver JWT (admin) eller `x-cron-secret` header.

### CORS
Edge Functions accepterar:
- `https://lagerassistent.netlify.app`
- `http://localhost:5173|8000|3000`
- Pattern: `^https://[a-z0-9-]+--lagerassistent\.netlify\.app$` (Netlify deploy-previews)

### Env vars i Netlify
| Key | Värde | Hemlig? |
|---|---|---|
| `SUPABASE_URL` | `https://tzidalknfoumoknhsetx.supabase.co` | Nej (publik) |
| `SUPABASE_ANON_KEY` | (anon JWT från config.js) | Nej (publik by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | (från Supabase API-settings) | **JA — HEMLIG** |
| `CRON_SECRET` | UUID | **JA — HEMLIG** |
| `ANTHROPIC_API_KEY` | Claude API-nyckel | **JA — HEMLIG** |
| `RESEND_API_KEY` | Resend API-nyckel | **JA — HEMLIG** |
| `WEEKLY_MAIL` | mottagar-adress | Nej |

`netlify.toml` har `SECRETS_SCAN_OMIT_KEYS = "SUPABASE_ANON_KEY,SUPABASE_URL"` så Netlify Build inte felaktigt flaggar dessa som hemliga.

---

## 3. Database — Supabase

### Projekt-ID
`tzidalknfoumoknhsetx`

### Tabeller (24 totalt, 20 RLS-skyddade)

**RLS skyddat (Fas 1):**
- `notes`, `comments` (intern-filter i RLS-policy)
- `materials_v2`, `material_items`, `material_counts`, `material_history` (append-only), `material_comments`, `material_images` (uploaded_by), `material_item_images` (uploaded_by), `borrowed_material`
- `tasks`, `task_status_log` (append-only), `task_comments`, `task_checklist`
- `info_articles`, `info_images` (uploaded_by), `info_comments`
- `returns`
- `user_pins` (egen rad eller admin), `user_roles` (admin-only)

**UTANFÖR RLS (Alt C):** `cars`, `drive_logs`, `info_pdfs`, `materials` (legacy)

### Helper-funktioner (i alla RLS-policies)
```sql
current_user_name() → text       -- läser JWT user_metadata.user_name
current_user_role() → text       -- läser från user_roles-tabell (inte JWT — så role-changes slår igenom direkt)
is_admin() → boolean
is_intern_or_admin() → boolean
```

### Migrations (alla körda manuellt via Supabase SQL Editor)
| # | Fil | Vad |
|---|---|---|
| 001 | `helpers.sql` | Helper-funktioner |
| 002 | `pin_security.sql` | bcrypt-kolumner |
| 003 | `migrate_pins.sql` | Engångs plaintext→bcrypt |
| 004 | `rls_auth_tables.sql` | user_pins, user_roles |
| 005 | `rls_notes.sql` | notes, comments |
| 006 | `rls_materials.sql` | 8 material-tabeller |
| 007 | `rls_tasks.sql` | 4 task-tabeller |
| 008 | `rls_info.sql` | 3 info-tabeller |
| 009 | `rls_returns.sql` | returns |
| 010 | (kördes inline) `cleanup_legacy_policies.sql` | Tog bort gamla "anon_all" + "Allow all" policies |

**När du behöver lägga till migration:** skriv som `migrations/0NN_name.sql` med tydlig rubrik + `-- ROLLBACK:` kommentar längst ner.

### Schema-quirks att känna till
- `materials_v2` har INGEN `created_by` — bara `deleted_at`
- `material_history` använder `changed_by` (inte created_by!)
- `material_images`/`material_item_images`/`info_images` använder `uploaded_by`
- `tasks.assigned_to` är `text[]` (PostgreSQL array)
- `tasks.responsible` är enskild username
- `user_pins.pin` (klartext) är BORTTAGEN (kolumnen droppades i Fas 1)

---

## 4. Användare och PINs

| Användare | Role | Default PIN (om inte bytt) |
|---|---|---|
| Admin | admin | 1234 (sattes i Fas 1, byt!) |
| Andreas | intern_user | 0000 |
| Nicklas | user | 0000 |
| Per | user | 0000 |
| Johannes | user | 0000 |

`pin_set = true` betyder användaren har bytt PIN.

---

## 5. Återstående plan (Fas 2-6)

### FAS 2 — Vite + TypeScript foundation (~4 dagar)

**Mål:** Sätt upp verktygskedjan. Ingen visuell förändring, ingen ny funktionalitet.

```
Mappstruktur:
src/
  domain/       Note.ts, Material.ts, Task.ts (typer + validering)
  services/     api.ts, auth.ts, notes.ts, materials.ts, tasks.ts
  state/        store.ts (nanostores), notes.ts, ui.ts
  ui/
    components/ Modal.ts, Toast.ts, ImageUpload.ts, CommentList.ts
    views/      Home.ts, Notes.ts, Material.ts, Plan.ts, Info.ts
    cards/      NoteCard.ts, MaterialCard.ts
  utils/        escape.ts, dates.ts, image.ts, classify.ts
```

Steg:
- 2.1 `npm init`, Vite-konfig, `tsconfig.json` (strict: true, allowJs först för gradvis migration)
- 2.2 Flytta config.js → `domain/` typer + `state/store.ts`
- 2.3 Flytta supabase.js → `services/api.ts` med interceptors
- 2.4 Behåll alla nuvarande funktioner — bara organisera om
- 2.5 Netlify build-config (`vite build → dist/`)
- 2.6 DEPLOY → exakt samma app, men på TS+Vite

**Viktigt:** disciplin. Paritet, INTE perfektion. Frestelser att "improvera på vägen" ska motstås.

### FAS 3 — Data-integritet och alla B-buggar (~3-4 dagar)

```
3.1 Postgres-funktion move_count() — atomic flytt + log (B2, B3)
3.2 CHECK constraints på status-kolumner (B1)
3.3 Batch-DELETE för emptyTrash via DELETE ?id=in.(...) (B8)
3.4 Paginering i loadMats med Range-headers (B9)
3.5 Subscribe-pattern: invalidera cache när annan användare ändrar (B19)
3.6 Fixa småbuggar: B4, B5, B6, B10, B11, B12, B14, B15, B18
3.7 Custom modal-system ersätter alla confirm() (B20)
3.8 Härda branch-tabeller (cars, drive_logs, info_pdfs) om de mergeats vid det laget
```

### FAS 4 — Arkitektur (~4-5 dagar)

```
4.1 Reactive store (nanostores) — aggregate per store
4.2 Services per aggregate (CRUD + load + subscribe)
4.3 Generic CommentSystem — ersätter 4 duplikat (~400 rader)
4.4 Generic ImageUpload-komponent
4.5 Granular render: patchNoteCard(id) istället för full innerHTML
4.6 Optimistic UI överallt med rollback vid fel
4.7 Service Worker för offline-stöd
4.8 Foto-först-flöde (5.6 — tidigareläggs hit)
```

### FAS 5 — UX för lagermiljö (~4-5 dagar)

Användarens uttryckliga prio: **5.6 (foto-först), 5.10 (vibration — KLAR i Fas 1)**.

```
5.1 Swipe-actions på kort (klar/pågår)
5.2 QR-scanning på artiklar (html5-qrcode lib)
5.3 Flytande FAB-knapp för quick-add på alla flikar
5.4 Status-cykel istället för modal
5.5 Voice input för anteckningar
5.7 Mall-anteckningar ("Trasig", "Tvätt", "Reparation")
5.8 Återanvänd senaste värden (leverantör m.m.)
5.9 "Stora knappar"-läge i settings (handskar)
5.11 Stora datum-knappar (Idag/Imorgon/Nästa vecka)
5.12 Auto-tema via tid/ljussensor
```

### FAS 6 — Smart logik & AI (~4-5 dagar)

Användarens uttryckliga prio: **6.2 (auto-task från åtgärds-kommentar), 6.14 (daglig backup)**.

```
6.1 Web Push: påminnelser 24h innan deadline (Service Worker)
6.2 Auto-skapa task från åtgärds-kommentar ★
6.3 Auto-arkivera klara tasks efter 30 dagar (Edge cron via Supabase pg_cron)
6.4 Auto-flytta tvätt → tillgänglig efter X dagar
6.5 Ny status "reserverad till X"
6.6 Lagernivå-varningar (< 20% → notis)
6.7 "Topp 5 problem-artiklar" widget
6.8 Service-intervall per artikel
6.9 Dashboard-flik med stats
6.10 Excel-export
6.11 Claude Vision: foto → auto-kategori + beskrivning
6.12 AI parsar return-content → uppdaterar counts
6.13 Aktivitetslogg per användare
6.14 Daglig backup till bucket ★ (via Supabase pg_cron + Edge Function)
6.15 Återaktivera send-weekly cron (via pg_cron med CRON_SECRET)
```

---

## 6. Lessons learned från Fas 1

### Vad fungerade bra
- **Steg-för-steg-cadence** med verifiering mellan: minskar regressioner
- **Backup först** innan DB-ändringar (vi tvingade detta)
- **Idempotenta migrations** (drop policy if exists → create policy) → kan köras flera gånger
- **Edge Functions för känslig logik** (bcrypt, JWT-skapande) — håller hemligheter på servern
- **Detaljerad commit-messages** + dokumentation i `docs/`

### Fallgropar vi snubblade på
1. **bcrypt-deno var inkompatibel med PG crypt()** → bytte till `bcryptjs@2.4.3` från esm.sh
2. **Gamla "anon_all" RLS-policies från tidigare experiment** låg kvar och gav full access trots våra nya policies. Lösning: alltid `select * from pg_policies where tablename=...` för att se vad som faktiskt finns innan nya policies skrivs.
3. **Netlify Secrets Scanning är överkänslig** — slog larm på `SUPABASE_ANON_KEY` (publik by design). Fix: `SECRETS_SCAN_OMIT_KEYS` i netlify.toml.
4. **Script load-order**: auth.js använder `escAttr` från ui.js. Måste vänta på `DOMContentLoaded`.
5. **State-leakage**: logout nollade inte `tab`-variabeln → ny user landade på admin-flik. **Säkerhetsbug**. Lösning: `logout()` nollar nu ALL state inkl. navigation.
6. **F5-restore behöver validera JWT mot server** — lokal expires-stämpel är opålitlig.
7. **CORS för Netlify deploy-previews** — preview-URL:er är `deploy-preview-N--lagerassistent.netlify.app` — måste matchas med regex.

### Saker att INTE göra
- Inte ändra script load-order utan att förstå konsekvenserna
- Inte köra `DROP TABLE` eller motsvarande utan att backupa först
- Inte hårdkoda `isAdmin = user === "Admin"` — använd JWT-rollen
- Inte använda `confirm()` för destruktiva åtgärder (UX) — använd "Undo"-toast istället
- Inte committa `.claude/` eller `backups/`-mappar (finns i .gitignore)

---

## 7. Praktisk info för dig (Claude) i nästa session

### Hur jag (användaren) jobbar
- Windows + PowerShell, ibland CMD
- Edge-browser, ibland Chrome incognito för säkerhetstest
- Lokal dev: `npx serve . -p 8000` i Bash-shell
- Supabase Dashboard för SQL Editor och Edge Functions (har owner-access men säg åt mig steg-för-steg)
- Netlify Dashboard för deploys + env vars (har owner-access)
- GitHub web UI för PRs (gh CLI saknas, ingen token tillgänglig för dig)
- Inte van vid avancerad terminal — escape-strul med curl + PowerShell

### Hur jag (Claude) ska jobba
- **Aldrig** commita/pusha/merga utan användarens explicita OK
- **Aldrig** köra DB-ändringar utan backup
- **Alltid** ge användaren konkreta steg-för-steg instruktioner när hen ska göra något i Supabase/Netlify Dashboard
- **Alltid** föreslå verifierings-queries efter SQL-ändringar
- **Alltid** uppdatera task-listan med TaskCreate/TaskUpdate vid större faser
- **Alltid** ge fallback-alternativ ("Om du fastnar, prova...")
- **Föredra** små commits per logisk enhet, även när användaren säger "stor commit per fas" — för rollback-möjlighet
- **Verifiera** Edge Functions med curl själv när möjligt (sparar tid)
- **Använd** PR via URL: `https://github.com/antegj-spec/lagerassistent/compare/main...<branch>` — gh CLI finns inte

### Smoketest-mönster
Efter varje deploy ska minimum testas:
```
[ ] Hard-reload incognito (Ctrl+Shift+R)
[ ] Logga in som Admin → ser data
[ ] Logga ut → logga in som vanlig user (Andreas/Per) → INGA admin-flikar
[ ] F5 → fortfarande inloggad
[ ] Anon-curl mot /rest/v1/notes ska returnera [] (inte data)
```

### Rollback-procedur
1. `git revert <commit>` → push → Netlify auto-deployar
2. Vid DB-problem: `alter table X disable row level security;` per tabell
3. Vid värsta: restore från backup i `backups/2026-05-22-pre-fas1/`

---

## 8. Föreslagna första-prompts för nästa session

### För Fas 2 (Vite + TS)
```
Läs docs/HANDOVER.md först.

Vi är klara med Fas 1 (säkerhet) och ska nu starta Fas 2 — migrera till Vite + TypeScript.

Mål: paritet, inte perfektion. Ingen ny funktionalitet. Bara verktygskedja.

Börja med en detaljerad task-by-task plan för Fas 2 (matcha detaljnivån vi hade för Fas 1). Pausa efter planen — jag vill granska innan vi börjar koda.
```

### För Fas 3 (data-fix utan TS)
```
Läs docs/HANDOVER.md först.

Vi hoppar Fas 2. Gå direkt på Fas 3 — alla B-buggar (B2, B3, B8, B9, B19, m.fl.) + atomic move_count via Postgres-funktion.

Börja med detaljerad plan, börja sen med move_count som första leverabel.
```

### För akut bug-fix
```
Läs docs/HANDOVER.md först.

Akut bugg i prod: <beskriv buggen + vad du ser>.

Felmeddelande:
<klistra in>

Git-status:
<git log --oneline -10>

Hjälp mig debugga och fixa.
```

### För feature från Fas 5/6
```
Läs docs/HANDOVER.md först.

Jag vill implementera <feature från Fas 5/6 — t.ex. QR-scanning för artiklar>.

Detta är fristående feature, inte del av full Fas X. Skissa minsta möjliga
implementation som integrerar med befintlig arkitektur (ingen Vite/TS-refactor).
```

---

## 9. Sista raden

Detta dokument speglar tillståndet efter Fas 1 deploy + alla hotfixes. Sista commit som ingår: `539a336` (DOMContentLoaded-fix).

Om något i koden inte stämmer med vad som står här — koden vinner. Uppdatera detta dokument när arkitekturen förändras i Fas 2+.

**Lycka till. Hen är en bra kollega.**
