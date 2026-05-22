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
