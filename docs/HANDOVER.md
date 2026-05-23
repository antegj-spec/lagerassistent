# HANDOVER — Lagerassistent

> **Detta dokument ger dig (Claude) full kontext för att fortsätta arbetet utan att läsa hela tidigare session.**
> Läs hela detta dokument INNAN du börjar koda. Det innehåller arkitekturbeslut, kända fallgropar och prioriterad plan.

---

## 0. TL;DR

Lagerassistent är en webapp (svenska) för en eventlagerverksamhet, deployad på Netlify med Supabase-backend. ~5 användare, vardaglig produktionsanvändning.

**Status:**
- **Fas 1 (säkerhet)** — KLAR och deployad. RLS aktiverat på 20 tabeller, bcrypt-PIN via Edge Functions, JWT-auth, härdad backend.
- **Fas 2 (Vite + TypeScript)** — KLAR och deployad. Hela kodbasen migrerad till TS, byggs via Vite/Netlify-pipeline.
- **Fas 3 (data-integritet, UX, realtime)** — KLAR (3.8 hoppad). Atomic `move_count()` RPC, CHECK constraints på alla status-kolumner, batch-DELETE, paginering, custom modal, comments.updated_at-fix, Supabase Realtime-subscribe, plus B6/B10/B12/B14-buggfixar.
- **Fas 4-6** återstår enligt detaljerad plan nedan.

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
│       ├── realtime.ts     # Supabase Realtime WebSocket (Fas 3.5)
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
├── migrations/             # 001-013 — kördes manuellt via SQL Editor
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

NPM-scripts kallar `node node_modules/<bin>/...` direkt — bypassar npm cmd-shim som har en bug med OneDrive-pathar med mellanslag (Windows).

### Script load-order (KRITISKT)

```html
<script type="module" src="/src/main.js"></script>   <!-- Vite: CSS-pipeline -->

<script src="/js/config.js"></script>     <!-- 1: globala konstanter + state -->
<script src="/js/supabase.js"></script>   <!-- 2: behöver config -->
<script src="/js/auth.js"></script>       <!-- 3: behöver supabase. OBS escAttr -->
<script src="/js/ui.js"></script>         <!-- 4: definierar escAttr -->
<script src="/js/render.js"></script>     <!-- 5: behöver ui -->
<script src="/js/realtime.js"></script>   <!-- 6: Fas 3.5 — behöver supabase + auth -->
<script src="/js/actions.js"></script>    <!-- 7: behöver alla ovan -->
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

### Realtime-flöde (Fas 3.5)
Parallellt med ovan triggar `src/legacy/realtime.ts` `load*() + render()`
när en *annan* användare ändrar en prenumererad tabell. Mappningen:
- `notes` → `loadNotes`
- `materials_v2|material_counts|material_items|borrowed_material` → `loadMats`
- `tasks` → `loadTasks`
- `returns` → `loadReturns`

Debounce på 300ms slår ihop bursts. `initRealtime()` anropas i
`completeLogin()` (täcker både PIN-login och F5-restore), `closeRealtime()`
först i `logout()`. Migration 013 lägger berörda tabeller i
`supabase_realtime`-publication.

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

## 5. Återstående plan (Fas 4-6)

### FAS 3 — KLAR (2026-05-23 → 2026-05-24)

```
3.1 ✅ move_count(material_id, from, to, qty, comment) RPC — atomic
    flytt + history-log inom transaktion, FOR UPDATE-lås, SECURITY
    DEFINER, läser changed_by ur JWT. Migration 010.
3.2 ✅ CHECK constraints på material_counts.status, material_items.status,
    material_history.old/new_status, notes.status, tasks.status,
    task_status_log.old/new_status. Migration 012.
3.3 ✅ emptyTrash batchad till ett DELETE ?id=in.(…) via ny helper
    delNotesPermBatch i supabase.ts.
3.4 ✅ Paginering: ny sbPaged<T>(path, pageSize=1000) i supabase.ts
    läser via Range-headers tills page.length < pageSize (eller 416).
    loadMats använder den för materials_v2 + material_counts +
    material_items.
3.5 ✅ Supabase Realtime via rå WebSocket (Phoenix-protokoll). Filen
    src/legacy/realtime.ts (~150 rader). Subscribe på notes/materials_v2/
    material_counts/material_items/borrowed_material/tasks/returns.
    Debounced load*() + render() vid postgres_changes. Heartbeat 30s,
    reconnect med exponential backoff. Anslutning sker i completeLogin
    (täcker både PIN-login och F5-restore), stängs i logout.
    Migration 013 lägger tabellerna i supabase_realtime publication.
3.6 ✅ Småbuggar:
      - B6  filter (fCat/fStat/fAssigned/planPersonFilter) nollställs
            på tab-byte i showTab
      - B10 deadlineLabel visar minuter under 1h ("för 5m sedan",
            "om 20m") istället för "0h sedan"
      - B12 compressImg använder URL.createObjectURL + revokeObjectURL
            istället för FileReader+dataURL (sparar RAM på iPhone)
      - B14 _matCommentImgUrl/_itemCommentImgUrl/_infoCommentImgUrl
            rensas i closeMat, closeInfo och showTab (var ambient-
            deklarerade i src/legacy/types.d.ts för att ui.ts ska se dem)
      - B5+B15 SKIPPADE: pinSet och userPins är dead state (skrivs
            men läses ingenstans — gamla "first-time PIN"-flow är borta)
      - B4, B11, B18 SKIPPADE: semantiska/feature-frågor, inte buggar
3.7 ✅ confirmModal(message, opts) Promise-baserad i ui.ts ersätter
    alla 15 confirm()-anrop i actions.ts. Stödjer danger:true för röd
    knapp och custom confirmLabel ("Radera", "Töm papperskorg", etc.).
3.8 ⏭ SKIPPAD: branch-tabellerna cars/drive_logs/info_pdfs är inte
    mergeats till main → ingen åtgärd behövs här. Plocka upp om/när
    de mergar.
3.9 ✅ Migration 011 lägger till updated_at på comments + initierar
    äldre rader till created_at. Klient-koden var redan korrekt
    (skickade updated_at i PATCH) — det var DB-kolumnen som saknades.
```

**Migrationer 010-013** kördes manuellt i Supabase SQL Editor. Pre-flight
för 012 (CHECK constraints) returnerade 0 rader → migrationen passerade
utan justering av befintlig data.

### FAS 4 — Arkitektur (~4-5 dagar)

```
4.1 Reactive store (nanostores) — aggregate per store
4.2 Services per aggregate (CRUD + load + subscribe)
4.3 Generic CommentSystem — ersätter 4 duplikat
4.4 Generic ImageUpload-komponent
4.5 Granular render: patchNoteCard(id) istället för full innerHTML
4.6 Optimistic UI överallt med rollback vid fel
4.7 Service Worker för offline-stöd
4.8 Foto-först-flöde (5.6 — tidigareläggs hit)
4.9 Eliminera klassisk script-modell — flytta till ES modules
4.10 Ta bort @ts-nocheck från actions.ts, full typing
4.11 Flytta state från globala vars till delat store-objekt
```

### FAS 5 — UX för lagermiljö (~4-5 dagar)

Användarens prio: **5.6 (foto-först), 5.10 (vibration — KLAR i Fas 1)**.

```
5.1 Swipe-actions på kort
5.2 QR-scanning på artiklar
5.3 Flytande FAB-knapp
5.4 Status-cykel istället för modal
5.5 Voice input för anteckningar
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
1. **npm cmd-shim kraschar på OneDrive-pathar med mellanslag** (Windows). Fix: `node node_modules/<bin>/...` direkt
2. **Side-effect-import av non-module-JS tree-shakas bort** av Vite — därav klassisk script-tag-approach
3. **`types.ts` (jämfört med `types.d.ts`) emittas av tsc** om det importeras från en typed fil. Fix: `.d.ts`-suffix (declaration only)
4. **TS 6.x har deprecated `module: "none"` och `esModuleInterop: false`** — pinnade TS till `^5.6` istället
5. **`alwaysStrict: true` injectar `"use strict"` i alla output** — pariteten med original kräver `alwaysStrict: false`
6. **`Comment` är en built-in DOM-typ** — vår domän-typ måste döpas om för att inte kollidera
7. **Many Note/Material/Task-fält saknades på interfaces** initialt — upptäcktes under render.ts-konvertering

### Fas 3 — Data-integritet, UX, realtime
- **Postgres-RPC för flerstegs-mutationer** — `move_count()` är mallen för Fas 4: ett HTTP-anrop, atomic transaktion, server-side validering av JWT-user. Återanvänd mönstret för andra multi-write actions.
- **`SECURITY DEFINER` + manuell `current_user_name()`-check** — bypass:ar RLS för att kunna skriva flera tabeller i en transaktion, men säkrar anon-block via tom JWT-claim. Anrop från SQL Editor (utan JWT) failar med felmeddelandet "ingen inloggad användare" — det är önskat, inte en bugg.
- **Pre-flight queries i CHECK-constraint-migrations** — utan dem failar `ALTER TABLE` på första raden med ogiltigt värde och rollbackar hela migrationen. Vi körde pre-flight i 012 och fick 0 träffar.
- **Supabase Realtime utan @supabase/supabase-js-klient** — Phoenix-protokollet är enkelt nog att implementera direkt (~150 rader). Sparar dependency och tvingar inte ES-modul-refaktor. Heartbeat var 30s, reconnect med exponential backoff (max ~30s, max 10 försök).
- **Realtime kräver att tabellen är i `supabase_realtime`-publication** — annars failar `phx_join` med error-status (loggas av realtime.ts till console). Lägg in nya tabeller via `alter publication supabase_realtime add table x`.
- **`confirmModal()` är pure Promise** — fungerar i WebView och Android-browsers där `window.confirm()` returnerar `false` direkt. Default `OK`/`Avbryt`-labels men varje destruktiv action sätter eget `confirmLabel` ("Radera", "Töm papperskorg", "Arkivera").

### Fallgropar från Fas 3
1. **`closeRealtime()` måste anropas FÖRE `logout()`-state-rensning** — annars börjar reconnect-loopen försöka med tom JWT mellan stängning och fullständig logout
2. **`material_counts` UNIQUE-index på (material_id, status) krävs implicit av `move_count()`** — funktionen gör UPSERT via separat SELECT FOR UPDATE och INSERT. Vid race kan dubbletter uppstå om constraint saknas. Verifiera schema. (Sannolikt redan så p.g.a. legacy code men inte testat.)
3. **`pinSet` och `userPins` i config.ts är dead state** — skrivs av loadPins/changePin men läses ingenstans. Rester efter borttagen "first-time-PIN"-UI-flow i Fas 1. Kandidat för cleanup i Fas 4.
4. **`_matCommentImgUrl` etc. är top-level `let` i actions.ts** — för att ui.ts ska kunna nollställa dem behövde de ambient-deklareras i types.d.ts (`declare global { let _xxx: ... }`). Annars TS-fel "Cannot find name".
5. **`@ts-nocheck` på actions.ts** maskerar att vi använder de tre `_*ImgUrl` före deras `let`-deklaration i samma fil (hoisting + TDZ skulle vara ett runtime-problem om de inte initialiserades till `null` vid load). Funkar idag men en fas 4-typing av actions.ts kommer behöva flytta deklarationerna till config.ts.

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

### För Fas 4 (arkitektur)

```
Läs docs/HANDOVER.md först.

Fas 4 — refaktorera till aggregate-services + reactive store.
Eliminerar shared global-state, byter till ES modules, typar actions.ts.

Förstudera först:
- 80+ event-handlers i src/legacy/actions.ts (alla med @ts-nocheck)
- Hur src/legacy/realtime.ts redan triggar load*() + render() per tabell
  — kan användas som "subscribe"-källa i nya store-modellen
- pinSet/userPins i config.ts är dead state — rensa som del av Fas 4.10

Börja med detaljerad plan + arkitekturskiss innan vi börjar koda.
```

### För Fas 5/6 (UX/features)

```
Läs docs/HANDOVER.md först.

Jag vill implementera <feature från Fas 5/6 — t.ex. QR-scanning, foto-
först-flöde, dashboard>.

Detta är fristående feature. Skissa minsta möjliga implementation som
integrerar med befintlig arkitektur (ingen Fas 4-refactor först).

OBS: All Fas 3-foundation finns på plats — atomic RPC-mönster i
migrations/010_move_count.sql är mall för flerstegs-mutationer,
realtime-subscribe i src/legacy/realtime.ts ger live-uppdateringar,
confirmModal() istället för window.confirm() i destruktiva flöden.
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

Detta dokument speglar tillståndet efter Fas 3-merge. Sista commits som ingår: `d0db01c` (Fas 3.1-3.4, 3.7, 3.9) och `f936edf` (Fas 3.5 + 3.6).

Om något i koden inte stämmer med vad som står här — koden vinner. Uppdatera detta dokument när arkitekturen förändras i Fas 3+.

**Lycka till. Hen är en bra kollega.**
