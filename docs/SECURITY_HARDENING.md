# Säkerhetshärdning — kritiskt + högt + medel (2026-06)

Resultat av en read-only säkerhetsgranskning + åtgärder. Det här dokumentet är
**runbook + beslutslogg**. Läs deploy-ordningen för K1 noga — fel ordning låser
ut alla användare tillfälligt.

## TL;DR

| ID | Allvar | Problem | Status |
|----|--------|---------|--------|
| **K1** | 🔴 Kritiskt | Auth-bypass: identitet härleddes ur `user_metadata` (användarskrivbar) + öppen anon-signup → vem som helst kunde bli Admin | Åtgärdat i kod, **kräver staged deploy** |
| **H1** | 🟠 Högt | `user_pins` självservice-UPDATE → lockout-bypass | Åtgärdat (migration 032) |
| **H2** | 🟠 Högt | `claude.js` oavkortad Anthropic-proxy | Åtgärdat |
| **H3** | 🟠 Högt | Brute-force: svaga PIN + ingen per-IP-gräns | Delvis (IP-throttle klar; PIN-rotation/tvång uppskjutet) |
| **M2** | 🟡 Medel | Inga säkerhetsheaders | Åtgärdat (Report-Only CSP + enforced headers) |
| **M3** | 🟡 Medel | `send-weekly` fri to-adress | Åtgärdat (allowlist) |
| **M4** | 🟡 Medel | `lager-images`/`lager-pdfs` är publika buckets | Dokumenterad avvägning (ej ändrad) |

---

## K1 — identitet flyttad till `app_metadata`

**Rotorsak:** `current_user_name()` läste `auth.jwt() -> 'user_metadata' ->> 'user_name'`.
`user_metadata` kan sättas/ändras av klienten (signup `data`, `PUT /auth/v1/user`).
Med öppen anonym signup (publik anon-nyckel) kunde vem som helst bli vem som helst:

```
POST /auth/v1/signup   apikey: <anon>   { "data": { "user_name": "Admin" } }
→ current_user_name() = "Admin" → is_admin() = true → full åtkomst, förbi PIN
```

**Fix:** `app_metadata` kan bara sättas av service-role. `verify-pin` skriver
identiteten dit och växlar token så JWT:n bär claimen; RLS-helpern läser därifrån.
En självskapad anon-session får tom identitet → noll åtkomst (öppen anon-signup
blir ofarlig).

Ändrade filer:
- `migrations/032_auth_hardening_appmetadata.sql` — helper → app_metadata (+ H1)
- `supabase/functions/verify-pin/index.ts` — `admin.updateUserById(app_metadata)` + token-refresh
- `supabase/functions/change-pin/index.ts`, `save-push-subscription/index.ts` — läs app_metadata
- `netlify/functions/claude.js`, `send-weekly.js` — läs app_metadata
- `src/legacy/auth.ts` — `restoreSession` läser app_metadata (fallback user_metadata)

### ⚠️ Deploy-ordning (måste följas)

1. **Deploya `verify-pin` FÖRST:** `supabase functions deploy verify-pin --project-ref tzidalknfoumoknhsetx`
   (sätter både app_metadata + user_metadata under övergången → inget hinner brytas).
2. **Kör migrationerna** i SQL Editor (backup först): `032_auth_hardening_appmetadata.sql`, `033_login_throttle.sql`.
3. **Deploya övriga funktioner:** `supabase functions deploy change-pin save-push-subscription`
   + pusha/merga så Netlify bygger om `claude.js` + `send-weekly.js`.
4. **Tvinga omlogin** för alla 5 (logga ut/in). Gamla tokens saknar app_metadata
   och tappar åtkomst tills omlogin — väntat och ofarligt.
5. **Verifiera hålet stängt:** skapa anon-session mot anon-nyckeln, sätt
   `user_metadata.user_name="Admin"`, kör `select is_admin();` → ska ge **false**.

### Rollback
Återställ `current_user_name()` till user_metadata-varianten (SQL finns i 032).

---

## H1 — `user_pins` nedlåst
Migration 032 droppar authenticated `SELECT`+`UPDATE` på `user_pins`. Ingen
klientkod läste/skrev tabellen lagligt; all PIN-hantering går via Edge Functions
(service-role, bypassar RLS). Stänger lockout-reset via DevTools.

## H2 — `claude.js` saniterad
Vidarebefordrar inte längre klientens body rakt av. Modell-allowlist
(`claude-sonnet-4-5` — lägg till nytt id vid modellbyte), `max_tokens`-tak 2000,
bara `{model, max_tokens, system, messages}` skickas vidare. Fortsatt admin-gated.

## H3 — brute-force
- **Klart:** per-IP-throttling (`migrations/033_login_throttle.sql` + `verify-pin`),
  30 försök / 15 min / IP. OBS: delar kontorets-IP flera användare → höj `IP_THRESHOLD` vid behov.
- **Uppskjutet (rör PIN — medvetet ej gjort nu):**
  - Rotera de 5 PIN-koderna bort från default (`0000`/`0987`).
  - Tvinga PIN-byte för den som har default. First-PIN-skärmen i `index.html` är
    **medvetet kvar** för detta — koppla den till `change-pin` Edge Function
    (som hashar) istället för döda `savePin` (som skrev klartext).
- `DEFAULT_PINS` borttagen ur `config.ts` (var oanvänd).

---

## M2 — säkerhetsheaders
`netlify.toml` sätter nu `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, samt en **Report-Only** CSP. Appen är
inline-tung (onclick/style + inline tema-script + Google Fonts) så en enforced
CSP kräver `'unsafe-inline'`. Validera Report-Only på en deploy-preview
(kolla konsolen), byt sedan headern till `Content-Security-Policy` för att tvinga.

## M3 — `send-weekly` mottagar-allowlist
Klient-angiven `to` hedras bara om den finns i env `WEEKLY_MAIL_ALLOWLIST`
(komma-separerad; default = `WEEKLY_MAIL`). Annars används default-mottagaren.

## M4 — publika bilder/PDF-buckets (avvägning, ej ändrad)
`lager-images` + `lager-pdfs` serveras via `/storage/v1/object/public/...`
(`src/legacy/services/images.ts`). De är alltså **publika** — vem som helst med
URL:en kan hämta filen utan auth. Att göra dem privata skulle bryta visningen
(kräver byte till signed URLs). Lämnad som den är; överväg signed URLs om
material-/körjournalsfoton eller PDF:er bedöms känsliga.

---

## Kvarvarande granskning (ej blockerande)
- XSS: konventionen `esc()/escAttr()/escJs()` följs konsekvent i render-lagret;
  inget live-hål hittat i stickprov. Latent footgun: `openEditCommentModal`
  (`commentSystem.ts`) har en egen-rullad arg-escaper — ofarlig idag (bara
  numeriska ID-args) men bör byta till `escJs`.
- `material_items`/`task_checklist`/`material_counts` UPDATE `using(true)` — avsiktligt
  (alla får ändra status), bekräftat OK av ägaren.
- `materials.ts` har kvar `@ts-nocheck` (559 rader otypade).
