# Säkerhetsdokumentation

## Fas 1-säkerhetshärdning (genomförd 2026-05-22)

### Auth-modell
- **Frontend** skickar PIN till Edge Function `verify-pin`, som bcrypt-jämför mot `user_pins.pin_hash`.
- Vid godkänd PIN skapas en **Supabase Auth anonymous session** med custom claim `user_name`.
- **Role** läses inte från JWT-claim utan slås upp i `user_roles`-tabellen via helper-funktion `current_user_role()` (säkrare — rolländringar slår igenom direkt).
- JWT TTL: 12h. Auto-logout vid inaktivitet eller 401.
- 5 felaktiga PIN-försök i rad → kontot låst 5 min (`locked_until`).

### RLS-strategi
- Alla **17 aktiva produktionstabeller** har RLS aktiverat med policies som binder operations till `current_user_name()`.
- **Admin** kan läsa/ändra/radera vad som helst.
- **Vanlig user** kan se allt och ändra/radera bara egna rader.
- **intern_user** (Admin + Andreas) kan dessutom se `notes` med `category = 'intern'`.

### Kända öppna ytor (acceptedrisk — branch-features)
Följande 4 tabeller har **INTE** RLS aktiverat i Fas 1:

| Tabell | Skäl | Plan |
|---|---|---|
| `cars` | Branch-feature, inte i main än | Härdas när branch mergas |
| `drive_logs` | Branch-feature, inte i main än | Härdas när branch mergas |
| `info_pdfs` | Branch-feature, inte i main än | Härdas när branch mergas |
| `materials` | Legacy (0 rader), ersatt av `materials_v2` | Droppas i Fas 3 |

**Konsekvens:** Den som känner till Supabase-anon-nyckeln kan fortfarande läsa/skriva mot dessa 4 tabeller. Detta är medveten avvägning för att inte bryta branch-utveckling. Adressas senast när respektive branch mergas.

### Netlify Functions-säkerhet
- `claude.js`: kräver `Authorization: Bearer <jwt>`, verifieras mot Supabase JWKS. Rate-limit 10 req/min per user_name.
- `send-weekly.js`: manuell trigger kräver admin-JWT; cron-trigger kräver `x-cron-secret` (env var).
- CORS: bara `https://<din-netlify-domän>` tillåts som Origin.

### Storage-säkerhet
- Bilduppladdning: bara `image/jpeg|png|webp`, max 5MB.
- URL-validering vid render: bara `https://` + Supabase Storage-prefix accepteras (förhindrar `javascript:` injection).

### Backup
- Engångs full-export: `backups/2026-05-22-pre-fas1/*.csv`
- Daglig auto-backup: Edge Function `daily-backup` triggad av Netlify cron 03:00 → Storage bucket `backups`, retention 30 dagar.

## Rollback-procedur

Om Fas 1 bryter något i produktion:

1. `git revert <fas1-commit-sha>` → push → Netlify auto-deployer förra versionen.
2. Inaktivera RLS via Supabase Dashboard om data blivit otillgänglig:
   ```sql
   alter table notes disable row level security;
   -- (upprepa per tabell)
   ```
3. Återställ från backup om data korrumperats:
   - Restore CSV/JSON från `backups/2026-05-22-pre-fas1/`
4. Anon-key fungerar igen efter steg 2 → frontend fungerar som före Fas 1.
