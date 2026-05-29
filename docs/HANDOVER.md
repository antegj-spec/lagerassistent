# HANDOVER — Lagerassistent

> **Detta dokument ger dig (Claude) full kontext för att fortsätta arbetet utan att läsa hela tidigare session.**
> Läs hela detta dokument INNAN du börjar koda. Det innehåller arkitekturbeslut, kända fallgropar och prioriterad plan.

---

## 0. TL;DR

Lagerassistent är en webapp (svenska) för en eventlagerverksamhet, deployad på Netlify med Supabase-backend. ~5 användare, vardaglig produktionsanvändning.

**Status:**
- **Fas 1 (säkerhet)** — KLAR och deployad. RLS aktiverat på 20 tabeller, bcrypt-PIN via Edge Functions, JWT-auth, härdad backend.
- **Fas 2 (Vite + TypeScript)** — KLAR och deployad. Hela kodbasen migrerad till TS, byggs via Vite/Netlify-pipeline.
- **Fas 3 (data-integritet + realtime + UX-fix)** — KLAR och deployad. move_count RPC, CHECK constraints, batch-DELETE, paginering, Realtime, confirmModal.
- **Fas 4 (arkitektur)** — KLAR. Block A: appState + reactive store. Block B: services + actions per aggregate + generic CommentSystem/ImageUpload. Block C: granular render (patchCard) + optimistic UI + type-cleanup (kvar @ts-nocheck endast i actions/materials.ts). **Skjutna till Fas 5/6:** ES modules-migration (4.9), Service Worker (4.7), foto-först-flöde (4.8).
- **Fas 5-6** återstår enligt detaljerad plan nedan.

**Arbetsmodell mellan användare och dig (Claude):**
- Användaren är Admin på Supabase + Netlify, kan köra SQL och deploya Edge Functions
- Användaren testar på Windows + PowerShell, kör lokalt med `npm run dev`
- Användaren föredrar steg-för-steg-flöde med verifiering mellan
- **Aldrig** committa/pusha/merga utan användarens explicita OK
- **Aldrig** köra DB-ändringar utan backup först

---

## 1. Kodbasens arkitektur (efter Fas 2)

### Filstruktur

```
lagerassistent/
├── index.html              # SPA-skal med PIN-screen, nav, main
├── style.css               # ~634 rader CSS, ljust + mörkt tema
├── package.json            # Vite + TS som devDeps
├── package-lock.json
├── vite.config.js          # outDir: dist, sourcemap: true
├── tsconfig.json           # ESNext-modules, noEmit (för framtida src/domain etc.)
├── tsconfig.legacy.json    # module: "none", transpilerar src/legacy/ → public/js/
├── netlify.toml            # build: npm run build, publish: dist, Node 20
├── .gitignore              # node_modules, dist, public/js, .claude, backups
├── CLAUDE.md               # Projekt-instruktioner (läs först!)
├── src/
│   ├── main.js             # Vite-entry: importerar style.css
│   ├── domain/
│   │   └── types.d.ts      # Exported domain interfaces (Note, Material, Task, ...)
│   └── legacy/
│       ├── types.d.ts      # Ambient bridge — re-declarerar Domain-typer globalt
│       ├── config.ts       # Konstanter, ENUMs, globala state-variabler
│       ├── supabase.ts     # sb<T>()-wrapper, alla DB/Storage-funktioner
│       ├── auth.ts         # PIN-login, JWT-restore, byt-PIN
│       ├── ui.ts           # esc/escAttr, modal, toast, AI-funktioner
│       ├── render.ts       # bygger innerHTML per tab
│       └── actions.ts      # alla user-action-handlers (@ts-nocheck — Fas 4 typar)
├── public/
│   ├── assets/             # logo.png etc. — serveras på /assets/
│   └── js/                 # GENERERAD: tsc-transpilerat output (i .gitignore)
├── dist/                   # GENERERAD: Vite-build output (i .gitignore)
├── netlify/functions/
│   ├── claude.js           # AI-proxy, JWT-skyddad
│   └── send-weekly.js      # Veckomail, JWT/CRON_SECRET-skyddad
├── supabase/functions/
│   ├── verify-pin/         # Edge Function: bcrypt-PIN-check + JWT
│   └── change-pin/         # Edge Function: säker PIN-byte
├── migrations/             # 001-010 — kördes manuellt via SQL Editor
└── docs/
    ├── SECURITY.md         # Säkerhetsmodell, rollback-procedurer
    └── HANDOVER.md         # ← DETTA DOKUMENT
```

### Bygg-pipeline (Fas 2)

`npm run build`:
1. `tsc -p tsconfig.json --noEmit` — typecheck modul-config (src/main.js + src/domain)
2. `tsc -p tsconfig.legacy.json` — typecheck OCH transpilera src/legacy/ → public/js/
3. `vite build` — bundla HTML + CSS, kopiera public/* till dist/

Netlify kör exakt samma pipeline. TS-fel bryter bygget.

NPM-scripts kallar `node node_modules/<bin>/...` direkt — bypassar npm cmd-shim som har en bug med Windows-pathar med mellanslag.

### Script load-order (KRITISKT)

```html
<script type="module" src="/src/main.js"></script>   <!-- Vite: CSS-pipeline -->

<script src="/js/config.js"></script>     <!-- 1: globala konstanter + state -->
<script src="/js/supabase.js"></script>   <!-- 2: behöver config -->
<script src="/js/auth.js"></script>       <!-- 3: behöver supabase. OBS escAttr -->
<script src="/js/ui.js"></script>         <!-- 4: definierar escAttr -->
<script src="/js/render.js"></script>     <!-- 5: behöver ui -->
<script src="/js/actions.js"></script>    <!-- 6: behöver alla ovan -->
```

**FALLGROP:** `auth.ts` använder `escAttr` (från ui.ts) men laddas FÖRE ui.ts. Lösningen är `DOMContentLoaded`-listener i auth.ts boot. **Rör inte detta utan att förstå varför.** Se commit `539a336`.

### State-modell

- Alla state-variabler är `let`/`const` på top-level i `config.ts` (60+ stycken)
- Mutationer sker direkt från andra filer (möjligt eftersom `tsconfig.legacy.json` har `module: "none"` → shared global scope)
- Ingen reactive store, ingen subscription — vid varje state-change anropas `render()` som rebuildar hela tabbens innerHTML
- **Detta är teknisk skuld** som Fas 4 adresserar

### Dataflöde för varje user-action
1. User triggar `actions.ts`-funktion (oftast inline `onclick`)
2. Funktion uppdaterar Supabase via `sb()` i supabase.ts
3. Kallar matching `load*()` för att uppdatera in-memory state
4. Kallar `render()` för att bygga om tab-HTML
5. Efter render körs `bindEvents()` för icke-inline event listeners

### TypeScript-modell

- `src/domain/types.d.ts` — exporterade interfaces. Alla domäntyper finns här.
- `src/legacy/types.d.ts` — ambient bridge: `declare global { type Note = D.Note; ... }`. Tillåter legacy-filer (utan import) att referera typer.
- `actions.ts` har `// @ts-nocheck` i toppen — full typing skjuten till Fas 4.
- `Comment` heter `NoteComment` (för att inte kollidera med DOM:s built-in `Comment`).

---

## 2. Säkerhetsmodell (Fas 1, live)

### Auth-flow
1. User skriver PIN på PIN-skärm
2. `auth.ts:checkPin` POSTar till `https://tzidalknfoumoknhsetx.supabase.co/functions/v1/verify-pin`
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
`auth.ts:restoreSession` validerar JWT mot `/auth/v1/user` vid sidladdning. Vid 200 → identity läses från JWT-claims, INTE från sessionStorage.

### Säkerhetsbeslut: 4 tabeller utanför RLS (Alt C)
Branch-features som inte lever på main än:
- `cars`, `drive_logs`, `info_pdfs`, `materials` (legacy, 0 rader)

**TODO för Fas 3:** härda dessa.

### Edge Functions
- `verify-pin` — login. Använder `bcryptjs@2.4.3` från esm.sh.
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
| `SUPABASE_ANON_KEY` | (anon JWT från config.ts) | Nej (publik by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | (från Supabase API-settings) | **JA — HEMLIG** |
| `CRON_SECRET` | UUID | **JA — HEMLIG** |
| `ANTHROPIC_API_KEY` | Claude API-nyckel | **JA — HEMLIG** |
| `RESEND_API_KEY` | Resend API-nyckel | **JA — HEMLIG** |
| `WEEKLY_MAIL` | mottagar-adress | Nej |

`netlify.toml` har `SECRETS_SCAN_OMIT_KEYS = "SUPABASE_ANON_KEY,SUPABASE_URL"`.

---

## 3. Database — Supabase

### Projekt-ID
`tzidalknfoumoknhsetx`

### Tabeller (24 totalt, 20 RLS-skyddade)

**RLS skyddat (Fas 1):**
- `notes`, `comments` (intern-filter i RLS-policy)
- `materials_v2`, `material_items`, `material_counts`, `material_history`, `material_comments`, `material_images`, `material_item_images`, `borrowed_material`
- `tasks`, `task_status_log`, `task_comments`, `task_checklist`
- `info_articles`, `info_images`, `info_comments`
- `returns`, `user_pins`, `user_roles`

**UTANFÖR RLS (Alt C):** `cars`, `drive_logs`, `info_pdfs`, `materials` (legacy)

### Helper-funktioner

```sql
current_user_name() → text       -- läser JWT user_metadata.user_name
current_user_role() → text       -- läser från user_roles-tabell
is_admin() → boolean
is_intern_or_admin() → boolean
```

### Migrations (alla körda manuellt via Supabase SQL Editor)
001-010 i `migrations/`. När ny migration behövs: skriv som `migrations/0NN_name.sql` med tydlig rubrik + `-- ROLLBACK:` kommentar längst ner.

### Schema-quirks att känna till
- `materials_v2` har INGEN `created_by` — bara `deleted_at`
- `material_history` använder `changed_by` + `old_status`/`new_status` (INTE `from_status`/`to_status`)
- `task_status_log` använder `old_status`/`new_status` också
- `tasks.assigned_to` är `text[]` (PostgreSQL array)
- `tasks.responsible` är enskild username
- `user_pins.pin` (klartext) är BORTTAGEN
- `comments`-tabellen verkar SAKNA `updated_at`-kolumn — editComment returnerar 400 Bad Request (B-bugg loggad i project_todo.md)

---

## 4. Användare och PINs

| Användare | Role | Default PIN |
|---|---|---|
| Admin | admin | 1234 (byt!) |
| Andreas | intern_user | 0000 |
| Nicklas | user | 0000 |
| Per | user | 0000 |
| Johannes | user | 0000 |

`pin_set = true` betyder användaren har bytt PIN.

---

## 5. Återstående plan (Fas 3-6)

### FAS 3 — Data-integritet och alla B-buggar (~3-4 dagar)

```
3.1 Postgres-funktion move_count() — atomic flytt + log (B2, B3)
3.2 CHECK constraints på status-kolumner (B1)
3.3 Batch-DELETE för emptyTrash via DELETE ?id=in.(...) (B8)
3.4 Paginering i loadMats med Range-headers (B9)
3.5 Subscribe-pattern: invalidera cache när annan användare ändrar (B19)
3.6 Fixa småbuggar: B4, B5, B6, B10, B11, B12, B14, B15, B18
3.7 Custom modal-system ersätter alla confirm() (B20)
3.8 Härda branch-tabeller (cars, drive_logs, info_pdfs) om mergeats
3.9 Fix editComment: ta bort updated_at från body ELLER lägga till kolumnen
```

### FAS 4 — Arkitektur (KLAR utom 4.7/4.8/4.9)

```
4.1  ✅ Reactive store — appState + subscribe/notify i store.ts
     (Block A merged till main).
4.11 ✅ Flytta state från globala vars till delat store-objekt
     (Block A — gjordes ihop med 4.1).
4.2  ✅ Services per aggregate — services/{notes,materials,returns,
     tasks,info,pins,images}.ts (Block B).
4.3  ✅ Generic CommentSystem — components/commentSystem.ts ersätter
     dupliceringen av kommentar-edit/del-flows (Block B).
4.4  ✅ Generic ImageUpload — components/imageUpload.ts (Block B).
4.5  ✅ Granular render — render/patches.ts (patchNoteCard,
     patchMaterialCard, patchTaskRow, patchHeaderMeta) + render/
     subscribers.ts. Hot-paths (toggleNote, setStatus,
     submitComment, setTaskStatus) använder dem (Block C).
4.6  ✅ Optimistic UI — store.ts:optimistic({apply, rollback, api}).
     Wrap:ad runt setStatus + setTaskStatus (Block C).
4.10 ✅ @ts-nocheck borttaget från actions/{notes,returns,info,tasks}.ts
     (Block C). Endast actions/materials.ts (559 rader) kvar —
     plockas i egen PR vid tillfälle.
4.7  ⏭ SKJUTEN till Fas 6 — Service Worker hör hemma där (daglig
     backup-feature behöver service worker för cron).
4.8  ⏭ SKJUTEN till Fas 5 — foto-först-flöde hör hemma där (UX för
     lagermiljö) per ursprungs-roadmappen.
4.9  ⏭ SKJUTEN till egen senare session — ES modules-migration är
     högrisk, ingen direkt user-value, och bryter Fas 2-paradigmet.
     Gör när en framtida feature kräver tree-shaking / dynamic
     import (t.ex. lazy-load av AI-tab eller foto-modul).
```

### FAS 5 — UX för lagermiljö (~4-5 dagar)

Användarens prio: **5.6 (foto-först), 5.10 (vibration — KLAR i Fas 1)**.

```
5.1 Swipe-actions på kort
5.2 QR-scanning på artiklar
5.3 Flytande FAB-knapp
5.4 Status-cykel istället för modal
5.5 Voice input för anteckningar
5.6 Foto-först-flöde ★ (skjuten från 4.8)
5.7 Mall-anteckningar
5.8 Återanvänd senaste värden
5.9 "Stora knappar"-läge i settings
5.11 Stora datum-knappar
5.12 Auto-tema via tid/ljussensor
```

### FAS 6 — Smart logik & AI (~4-5 dagar)

Användarens prio: **6.2 (auto-task), 6.14 (daglig backup)**.

```
6.1 Web Push: påminnelser 24h innan deadline
6.2 Auto-skapa task från åtgärds-kommentar ★
6.3 Auto-arkivera klara tasks efter 30 dagar (pg_cron)
6.4 Auto-flytta tvätt → tillgänglig efter X dagar
6.5 Ny status "reserverad till X"
6.6 Lagernivå-varningar
6.7 "Topp 5 problem-artiklar" widget
6.8 Service-intervall per artikel
6.9 Dashboard-flik
6.10 Excel-export
6.11 Claude Vision: foto → auto-kategori
6.12 AI parsar return-content
6.13 Aktivitetslogg per användare
6.14 Daglig backup till bucket ★ (pg_cron + Edge Function)
6.15 Återaktivera send-weekly cron
6.16 Service Worker — offline-stöd (skjuten från 4.7)
```

---

## 6. Lessons learned

### Fas 1 — Säkerhet
- **Steg-för-steg-cadence** med verifiering mellan: minskar regressioner
- **Backup först** innan DB-ändringar
- **Idempotenta migrations** (drop policy if exists → create policy)
- **Edge Functions för känslig logik** (bcrypt, JWT-skapande)
- **Detaljerad commit-messages** + dokumentation i `docs/`

### Fallgropar från Fas 1
1. **bcrypt-deno var inkompatibel med PG crypt()** → bytte till `bcryptjs@2.4.3` från esm.sh
2. **Gamla "anon_all" RLS-policies** låg kvar och gav full access trots våra nya policies
3. **Netlify Secrets Scanning är överkänslig** — Fix: `SECRETS_SCAN_OMIT_KEYS`
4. **Script load-order**: auth.ts använder `escAttr` från ui.ts. Måste vänta på `DOMContentLoaded`
5. **State-leakage** vid logout
6. **F5-restore behöver validera JWT mot server**
7. **CORS för Netlify deploy-previews** — preview-URLs matchas med regex

### Fas 2 — Vite + TypeScript
- **Klassiska script-taggar bevarade** genom hela Fas 2 — undviker state-refactor som hör hemma i Fas 4
- **tsc transpilerar src/legacy/ → public/js/** — Vite serverar transpilerat output som static
- **`module: "none"` i tsconfig.legacy.json** ger shared global scope mellan filer (paritet med pre-Fas-2)
- **Ambient bridge `src/legacy/types.d.ts`** låter legacy-filer referera Domain-typer utan import
- **`Comment` renamed till `NoteComment`** för att inte kollidera med DOM:s built-in Comment-typ
- **`actions.ts` med `@ts-nocheck`** — 80+ event-handlers, för stort jobb för Fas 2. Görs i Fas 4 vid refaktor
- **Typer breddades vid behov** — varje upptäckt saknad fält triggade interface-uppdatering

### Fallgropar från Fas 2
1. **npm cmd-shim kraschar på Windows-pathar med mellanslag**. Fix: `node node_modules/<bin>/...` direkt
2. **Side-effect-import av non-module-JS tree-shakas bort** av Vite — därav klassisk script-tag-approach
3. **`types.ts` (jämfört med `types.d.ts`) emittas av tsc** om det importeras från en typed fil. Fix: `.d.ts`-suffix (declaration only)
4. **TS 6.x har deprecated `module: "none"` och `esModuleInterop: false`** — pinnade TS till `^5.6` istället
5. **`alwaysStrict: true` injectar `"use strict"` i alla output** — pariteten med original kräver `alwaysStrict: false`
6. **`Comment` är en built-in DOM-typ** — vår domän-typ måste döpas om för att inte kollidera
7. **Many Note/Material/Task-fält saknades på interfaces** initialt — upptäcktes under render.ts-konvertering

### Saker att INTE göra
- Inte ändra script load-order utan att förstå konsekvenserna
- Inte köra `DROP TABLE` utan backup
- Inte hårdkoda `isAdmin = user === "Admin"` — använd JWT-rollen
- Inte använda `confirm()` för destruktiva åtgärder (UX) — använd "Undo"-toast istället
- Inte committa `.claude/`, `backups/`, `node_modules/`, `dist/`, eller `public/js/` (alla i .gitignore)
- Inte återinföra `module: "esnext"` i tsconfig.legacy.json — bryter shared global scope-paradigmet

---

## 7. Praktisk info för dig (Claude) i nästa session

### Hur jag (användaren) jobbar
- Windows + PowerShell, ibland CMD
- Edge-browser, ibland Chrome incognito för säkerhetstest
- Lokal dev: `npm run dev` (port 5173)
- Supabase Dashboard för SQL Editor och Edge Functions
- Netlify Dashboard för deploys + env vars
- GitHub web UI för PRs (gh CLI saknas, ingen token tillgänglig för dig)

### Hur jag (Claude) ska jobba
- **Aldrig** committa/pusha/merga utan användarens explicita OK
- **Aldrig** köra DB-ändringar utan backup
- **Alltid** ge användaren konkreta steg-för-steg instruktioner
- **Alltid** föreslå verifierings-queries efter SQL-ändringar
- **Alltid** uppdatera task-listan med TaskCreate/TaskUpdate vid större faser
- **Alltid** ge fallback-alternativ ("Om du fastnar, prova...")
- **Föredra** små commits per logisk enhet
- **Använd** PR via URL: `https://github.com/antegj-spec/lagerassistent/compare/main...<branch>`

### Smoketest-mönster
Efter varje deploy ska minimum testas:
```
[ ] Hard-reload incognito (Ctrl+Shift+R) — efter att stängt ALLA incognito-fönster
[ ] Logga in som Admin → ser data
[ ] Logga ut → logga in som vanlig user (Andreas/Per) → INGA admin-flikar
[ ] F5 → fortfarande inloggad
[ ] Anon-curl mot /rest/v1/notes ska returnera [] (inte data)
```

### Rollback-procedur
1. `git revert <commit>` → push → Netlify auto-deployar
2. Vid DB-problem: `alter table X disable row level security;` per tabell
3. Vid värsta: restore från backup, eller `git reset --hard pre-fas2-checkpoint` (Fas 2 baseline) / `pre-fas1-backup` (Fas 1 baseline)

---

## 8. Föreslagna första-prompts för nästa session

### För Fas 3 (data-fix)

```
Läs docs/HANDOVER.md först.

Vi är klara med Fas 1 (säkerhet) och Fas 2 (Vite + TS). Nu Fas 3 —
alla B-buggar (B2, B3, B8, B9, B19, m.fl.) + atomic move_count via
Postgres-funktion + fix på editComment (i project_todo.md).

Börja med detaljerad plan, börja sen med move_count som första leverabel.
```

### För Fas 4 (arkitektur)

```
Läs docs/HANDOVER.md först.

Fas 4 — refaktorera till aggregate-services + reactive store.
Eliminerar shared `window.*`-state, byter till ES modules, typar actions.ts.

Börja med detaljerad plan + arkitekturskiss innan vi börjar koda.
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

Jag vill implementera <feature från Fas 5/6 — t.ex. QR-scanning>.

Detta är fristående feature. Skissa minsta möjliga implementation som
integrerar med befintlig arkitektur (ingen Fas 4-refactor).
```

---

## 9. Sista raden

Detta dokument speglar tillståndet efter Fas 2-merge. Sista commit som ingår: `56eadce` (Fas 2.11 actions → TS) + slutstädning.

Om något i koden inte stämmer med vad som står här — koden vinner. Uppdatera detta dokument när arkitekturen förändras i Fas 3+.

**Lycka till. Hen är en bra kollega.**
