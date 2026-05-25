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
- **Fas 4 (arkitektur)** — KLAR. Block A: appState + reactive store. Block B: services + actions per aggregate + generic CommentSystem/ImageUpload. Block C: granular render (patchCard) + optimistic UI + type-cleanup (kvar @ts-nocheck endast i actions/materials.ts). **Skjutna:** ES modules-migration (4.9 → egen senare session), 4.7/4.8 levererade i Fas 5/6.
- **Fas 5 (UX för lagermiljö)** — KLAR (trimmat scope). Levererat: 5.4 status-cykel, 5.5 voice input, 5.6 foto-först-flöde, 5.7 mall-anteckningar, 5.8 återanvänd senaste värden, 5.12 auto-tema (OS-pref). **Skippade på användarens begäran:** 5.1 swipe, 5.2 QR, 5.3 FAB, 5.9 stora knappar, 5.11 stora datum-knappar.
- **Fas 6 (smart logik + ops)** — KLAR (utan AI-features). Levererat: 6.2 auto-task från åtgärd, 6.3 auto-arkivera klara tasks, 6.5 reserverad-status, 6.6 lagernivå-varningar, 6.7 topp 5 problem-artiklar, 6.8 service-intervall, 6.9 dashboard-flik, 6.10 CSV-export, 6.13 aktivitetslogg, 6.14 daglig backup, 6.15 send-weekly cron, 6.16 service worker, 6.1 web push. **Skippade på användarens begäran:** 6.4 auto-tvätt-flytt, 6.11 Claude Vision, 6.12 AI parsar return-content.

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

NPM-scripts kallar `node node_modules/<bin>/...` direkt — bypassar npm cmd-shim som har en bug med OneDrive-pathar med mellanslag (Windows).

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

### FAS 5 — UX för lagermiljö (KLAR — trimmat scope)

Mergade i två milstolpar:

```
Milstolpe 1 (PR claude/fas5-milstolpe1):
  5.4  ✅ Status-cykel — klickbar status-badge på note + task-rad
       cyklar ny → pågår → klar via optimistic + patchCard.
  5.5  ✅ Voice input — Web Speech API på note-textarea (sv-SE).
       Mic-knapp dyker upp om SpeechRecognition stöds.
  5.7  ✅ Mall-anteckningar — localStorage per användare. Chip-UI ovan
       formuläret för "Spara som mall" + apply + högerklick-radera.
  5.8  ✅ Återanvänd senaste värden — note-form pre-fillar cat/prio/
       assigned/material från senaste sparade anteckning.
  5.12 ✅ Auto-tema — index.html boot-script följer prefers-color-scheme
       när localStorage saknar preferens. Manuell toggle persisterar.

Milstolpe 2 (PR claude/fas5-milstolpe2):
  5.6  ✅ Foto-först-flöde ★ — "📸 SNABBT FOTO"-knapp högst upp på Hem.
       Kamera → uppladdning → default-anteckning → openEdit-modal för
       att fylla i resten. Återanvänder uploadImg/saveNote/openEdit.

Skippade på användarens begäran (kan plockas senare vid behov):
  5.1  Swipe-actions på kort
  5.2  QR-scanning på artiklar
  5.3  Flytande FAB-knapp
  5.9  "Stora knappar"-läge i settings
  5.11 Stora datum-knappar
```

### FAS 6 — Smart logik + ops (KLAR — utan AI-features)

Mergade i fem milstolpar (lägst risk först per användarens önskemål).
6.4 auto-tvätt-flytt togs bort efter att användaren ville behålla manuell
kontroll. 6.11/6.12 (Claude Vision + AI-parse) skippade — kan plockas
i framtida AI-fas.

```
Milstolpe 1 (PR claude/fas6-milstolpe1) — frontend-only-paket:
  6.7  ✅ Topp 5 problem-artiklar — widget på dashboard-fliken,
       aggregerar items i reparation + actionComments per material.
  6.9  ✅ Dashboard-flik — admin-only. KPI-rad (aktiva noter/uppgifter/
       kommande deadlines/problem-artiklar). Laddar via openDashboard()
       on-demand (modul-level state i actions/dashboard.ts, inte appState).
  6.10 ✅ CSV-export — 4 knappar i Export-fliken (notes, tasks, materials,
       returns). UTF-8 BOM + semikolon-separator → Excel-kompatibel,
       inga npm-deps.
  6.13 ✅ Aktivitetslogg — admin-only feed på dashboard. Joinar
       task_status_log + material_history mot tasks/materials, genererar
       svenska prosabeskrivningar. Senaste 14 dagar, max 80 entries.

Milstolpe 2 (PR claude/fas6-milstolpe2) — DB schema + UI:
  6.5  ✅ Reserverad-status — ny MAT_STATS 'reserverad' (lila 📌).
       material_items.reserved_for-kolumn för "till X"-kontext. Status-
       modal visar villkorat textfält. rItemDetail visar inline.
  6.6  ✅ Lagernivå-varningar — materials_v2.min_threshold-kolumn.
       Banner högst upp i Material-fliken visar count-based material
       där tillgänglig < tröskel.
  6.8  ✅ Service-intervall — material_items.service_interval_days.
       openServiceIntervalModal sätter värdet. Banner i Material-fliken
       listar items där (now - last_washed) > intervall.

Milstolpe 3 (PR claude/fas6-milstolpe3) — auto-action:
  6.2  ✅ Auto-task från åtgärd ★ — när material-kommentar postas med
       status 'åtgärd_krävs' (NYA kommentarer, inte cykel) skapas task
       med titel "🚨 Åtgärd: <materialnamn>", prio hög, ansvarig=
       författaren. Toast med ÅNGRA-knapp (soft-delete).

Milstolpe 4 (PR claude/fas6-milstolpe4) — cron + backend (MERGED):
  6.3  ✅ Auto-arkivera klara tasks (03:00 UTC) — pg_cron-jobb
       'auto-archive-tasks'. tasks.status='klar' AND updated_at>30d
       → archived=true. Idempotent.
  6.14 ✅ Daglig backup ★ — Edge Function 'daily-backup' (npm:web-push
       finns INTE här — bara service-key + storage). JSON-dump av alla
       tabeller utom user_pins.pin_hash → /backups/YYYY-MM-DD.json.
       pg_cron-jobb '0 2 * * *' triggar via pg_net. Rotation: 'backup-
       cleanup' raderar >30d.
  6.15 ✅ Send-weekly cron — pg_cron-jobb 'send-weekly-mail' (måndag
       06:00 UTC) POSTar till befintlig Netlify-funktion via pg_net.

Milstolpe 5 (PR claude/fas6-milstolpe5) — service worker + push:
  6.16 ✅ Service Worker (public/sw.js) — cache-first för /assets, /js,
       navigations. Network-only för /rest/v1, /functions/v1, /auth/v1,
       /storage/v1. Push handler + notificationclick. Registreras från
       src/main.js post 'load'.
  6.1  ✅ Web Push påminnelser 24h innan deadline — migration 016 lägger
       user_push_subscriptions + tasks/notes.push_sent_at. 3 Edge
       Functions: get-vapid-public-key (no auth), save-push-subscription
       (JWT), check-upcoming-deadlines (cron-secret). pg_cron '5 * * * *'
       triggar deadline-check. Frontend: gear-meny "🔔 Aktivera notiser"
       → permission + subscribe-flöde. Tasks pushar till responsible+
       assigned_to[], notes till assigned_to.

Skippade på användarens begäran:
  6.4  Auto-flytta tvätt → tillgänglig efter X dagar
  6.11 Claude Vision: foto → auto-kategori
  6.12 AI parsar return-content
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

### Fas 5 — UX-paketet
- **Trimmat scope överlägset stort scope.** Användaren plockade 6/12 punkter, vi körde två milstolpar med en testrunda var. Skippade resten ("om de behövs senare"). Sparade 2-3 dagars arbete utan att äventyra prio-features.
- **Inline-script i index.html för boot-tid-känsligt** (5.12 auto-tema måste löpa innan första render, annars flash). Fortsatte med samma pattern som theme-bootstrap.
- **Vissa features berör SAMMA formulär** — 5.5 (voice), 5.7 (mall), 5.8 (defaults) packades naturligt ihop i en commit eftersom de alla utvidgade note-input-formuläret.
- **Web Speech API har dåligt browser-stöd** (saknas i iOS Safari <15). Lös som vi gjorde i 5.5: feature-detect → dölj knappen tyst om saknas. Inget förstör för icke-stödande klienter.

### Fas 6 — Smart logik + ops
- **5-milstolpars-uppdelning fungerade bra.** Risk-ordning (1=lågrisk frontend → 3=auto-action → 2=schema → 4=cron → 5=SW+push) gav snabba wins först och tunga rörelser sist. Användaren mergade i samma ordning så bygget förblev stabilt mellan tester.
- **DB-migrations är ADDITIVE.** Varje migration (014-016) lägger till kolumner och CHECK-värden, tar inte bort något. Rollback-blocks med specifik DDL längst ner i varje fil.
- **Edge Functions för cron-triggade jobb.** Mönstret är: `pg_cron` → `net.http_post()` → Edge Function med `x-cron-secret`-header. Lättare att testa än PL/pgSQL-baserade jobb och låter oss skriva tung logik i TS i stället för PG-procedurer.
- **Supabase Vault för pg_cron-secrets.** ALTER DATABASE SET cron.* failar med 42501 — Vault är rätt verktyg. Wrapper-funktion `public.cron_secret(name)` med SECURITY DEFINER läser `vault.decrypted_secrets` så cron-SQL blir konsis.
- **6.4 droppades efter implementation.** Användaren ändrade sig — vi tog bort jobbet via en separat commit och dokumenterade `cron.unschedule('auto-flytta-tvatt')` för redan-aktiverade installationer. Lärdom: lätt att bygga, lätt att riva. Kostar nästan inget att backa scope.
- **Service Worker registreras från src/main.js**, INTE från index.html inline-script. Vite-modulen kör efter DOM, vilket är rätt timing för `navigator.serviceWorker.register()`. Inline-script i `<head>` skulle vara för tidigt.
- **Web Push kräver VAPID-nycklar.** Genereras lokalt en gång via `npx web-push generate-vapid-keys`, public delas via Edge Function `get-vapid-public-key`, private i Edge Function secrets. Använder `npm:web-push@3.6.7` i Deno (`npm:` specifier funkar i Supabase Edge Functions).
- **Idempotens på cron-jobb.** Alla deadline-pushes markerar `push_sent_at=now()` så samma item inte plockas vid nästa timme. Att-resetta: nullställ manuellt vid behov (när deadline flyttas fram).

### Fallgropar från Fas 5/6
1. **Edit-tool path-bug fortsätter på Windows + OneDrive + worktrees.** Hände flera gånger i Fas 6. När det händer på nya filer: kontrollera `git status` i både worktree och parent direkt efter edit, kör cp+revert om edit hamnade i parent. Verifierat mönster i CLAUDE.md.
2. **Grep-tool renderar forward-slash som backslash i sin output på Windows.** Jag flaggade en "bug" i `delTaskPerm` baserat på det. Faktiska bytes (verifierat med `od -c`) var `0x2F`. Aldrig flagga escape-buggar utan hex-verify först.
3. **`alter database postgres set cron.* = '...'` failar med 42501** i Supabase SQL Editor. Använd Supabase Vault i stället (se Lessons learned ovan).
4. **`cron.job_run_details` har INTE en `jobname`-kolumn.** Joina mot `cron.job` för att få namnet. `select j.jobname, d.* from cron.job_run_details d join cron.job j on j.jobid = d.jobid`.
5. **Manuella `net.http_post`-anrop hamnar INTE i `cron.job_run_details`.** De går till `net._http_response` med request_id-matchning. Cron-triggade jobb hamnar i job_run_details.
6. **`actions/materials.ts` har `@ts-nocheck`** så typfel i den filen syns inte vid build. Använd den för pragmatiska edits men var medveten om att TS-säkerhet är off där.
7. **PushSubscription.applicationServerKey** kräver `BufferSource` — Uint8Array funkar inte direkt i TS strict-mode på grund av SharedArrayBuffer-skillnaden. Casta `.buffer as ArrayBuffer` vid call site.
8. **Branch-stack-merge:** flera PRs som lägger till script-tags i samma område av index.html kan auto-merga med union-strategi. Om merge-conflict på GitHub: keep all script-rader manuellt.

### Saker att INTE göra
- Inte ändra script load-order utan att förstå konsekvenserna
- Inte köra `DROP TABLE` utan backup
- Inte hårdkoda `isAdmin = user === "Admin"` — använd JWT-rollen
- Inte använda `confirm()` för destruktiva åtgärder (UX) — använd `confirmModal()` eller "Undo"-toast istället
- Inte committa `.claude/`, `backups/`, `node_modules/`, `dist/`, `public/js/`, eller `supabase/.temp/` (alla i .gitignore)
- Inte återinföra `module: "esnext"` i tsconfig.legacy.json — bryter shared global scope-paradigmet
- Inte använda `current_setting('cron.xxx')` för Supabase cron-secrets — använd Vault + wrapper-funktion (se M4-migration)
- Inte sätta `push_sent_at=now()` manuellt — låt `check-upcoming-deadlines` Edge Function hantera det. Nullställ bara vid deadline-ändring.

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

### För skippad feature från Fas 5/6 (t.ex. QR-scanning)

```
Läs docs/HANDOVER.md först.

Fas 5/6 är klara men dessa skippades: 5.1 swipe, 5.2 QR, 5.3 FAB,
5.9 stora knappar, 5.11 stora datum-knappar, 6.4 auto-tvätt-flytt,
6.11 Claude Vision, 6.12 AI parse return.

Jag vill nu plocka <feature>. Detta är fristående — skissa minsta
möjliga implementation som integrerar med befintlig arkitektur
(appState + services + actions + render/patches).
```

### För actions/materials.ts type-cleanup (sista @ts-nocheck)

```
Läs docs/HANDOVER.md först.

Sista @ts-nocheck-resten är src/legacy/actions/materials.ts (~600 rader
efter Fas 6). Plocka bort @ts-nocheck och typ alla DOM-lookups + parametrar.
Använd notes.ts/tasks.ts/info.ts/returns.ts som mall (samma mönster:
saveX/loadX/render). Inget annat ändras. Liten PR.
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

### För framtida AI-fas (6.11 + 6.12 + ev. nya)

```
Läs docs/HANDOVER.md först.

Skippade AI-features från Fas 6:
  - 6.11 Claude Vision: foto → auto-kategori (foto-först-flödet 5.6
    skickar bild till Claude som returnerar kategori-förslag)
  - 6.12 AI parsar return-content (Claude läser fritext i returer och
    extraherar strukturerad data: antal, art-id, status)

AI-proxy finns redan: netlify/functions/claude.js (admin-only JWT).
Plus en framtida AI-fas kan inkludera röst-till-task, sammanfattning
per vecka per användare, smart-sökning, etc.

Börja med detaljerad plan + design-frågor innan vi kodar.
```

### För ny milstolpe / ad-hoc feature

```
Läs docs/HANDOVER.md först.

Jag vill implementera <feature>.

Detta är fristående. Skissa minsta möjliga implementation som integrerar
med befintlig arkitektur: appState (store.ts), services (services/
<aggregate>.ts), actions (actions/<aggregate>.ts), och patches
(render/patches.ts).
```

---

## 9. Sista raden

Detta dokument speglar tillståndet efter Fas 6-merge. Sista commits som
ingår per PR:
  - Fas 5: `claude/fas5-milstolpe1` + `claude/fas5-milstolpe2` (merged)
  - Fas 6 M1: `claude/fas6-milstolpe1`
  - Fas 6 M2: `claude/fas6-milstolpe2`
  - Fas 6 M3: `claude/fas6-milstolpe3`
  - Fas 6 M4: `claude/fas6-milstolpe4` (merged)
  - Fas 6 M5: `claude/fas6-milstolpe5`

**Det som kvarstår på roadmappen (skjutet eller skippat):**
- `actions/materials.ts` @ts-nocheck — egen liten PR vid tillfälle
- 4.9 ES modules-migration — kör när feature kräver tree-shaking
- Fas 5 skippade: 5.1, 5.2, 5.3, 5.9, 5.11 — plockas om/när behov uppstår
- Fas 6 skippade: 6.4, 6.11, 6.12 — 6.11/6.12 hör hemma i framtida AI-fas

Om något i koden inte stämmer med vad som står här — koden vinner.
Uppdatera detta dokument när arkitekturen förändras.

**Hen är en bra kollega.**

**Lycka till. Hen är en bra kollega.**
