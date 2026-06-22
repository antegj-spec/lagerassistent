# Database migrations

SQL-filer som körs manuellt i Supabase SQL Editor i numerisk ordning.

**Kör ALDRIG en migration utan backup först.**

## Körordning för Fas 1

| # | Fil | När |
|---|---|---|
| 001 | `001_helpers.sql` | Steg 1.2 — Helper-funktioner för RLS |
| 002 | `002_pin_security.sql` | Steg 1.3 — bcrypt-kolumner på user_pins |
| 003 | `003_migrate_pins.sql` | Steg 1.4 — Engångsmigration plaintext→bcrypt (kör EFTER Edge Function deployad) |
| 004 | `004_rls_helpers_and_user_tables.sql` | Steg 1.5a — RLS på user_pins + user_roles |
| 005 | `005_rls_notes_and_comments.sql` | Steg 1.5b — RLS på notes + comments |
| 006 | `006_rls_materials.sql` | Steg 1.5c — RLS på alla material-tabeller |
| 007 | `007_rls_tasks.sql` | Steg 1.5d — RLS på tasks-tabeller |
| 008 | `008_rls_info.sql` | Steg 1.5e — RLS på info-tabeller |
| 009 | `009_rls_returns_borrowed.sql` | Steg 1.5f — RLS på returns + borrowed_material |

## Rollback per migration

Varje fil har en `-- ROLLBACK:` kommentar längst ner med SQL som upphäver ändringen.

## Era-split (CLI sedan 2026-06)

Den här mappen (`migrations/001–032`) är ett **historiskt arkiv** av migrationer som
kördes **manuellt** i SQL Editor. De är redan applicerade i prod och spåras INTE av
Supabase-CLI:n.

**Nya migrationer skrivs i `supabase/migrations/`** och körs med `supabase db push`
(se "Database migrations" i `CLAUDE.md`). CLI:ns historik börjar med
`login_throttle` (f.d. 033). Om hela schemat någon gång ska kunna återskapas från
noll: kör `supabase db pull` för att baseline:a nuvarande remote-schema.
