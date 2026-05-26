-- ============================================================
-- 020_schema_drift_fix.sql  (Fas 8 Etapp B/C fixpack)
--
-- Adresserar drift mellan migrationsfiler och faktiskt schema.
-- Vanlig orsak: en tabell skapades manuellt under test innan
-- migrationen kördes — sen hoppar `create table if not exists`
-- över skapandet och nya kolumner läggs aldrig till.
--
-- Fixar:
--   cars      — saknar ev. active/created_at/created_by
--   car_trips — saknar ev. updated_at/image_path
--   schema-cache-reload så PostgREST ser ändringarna direkt
--
-- IDEMPOTENT. Säkert att köra flera gånger.
-- ============================================================

-- ---- cars ----

-- 'active' var den som blev observerat saknad i UI-felet.
alter table cars
  add column if not exists active boolean not null default true;

-- 'created_by' kan saknas om RLS-policyn skapades innan kolumnen.
alter table cars
  add column if not exists created_by text not null default current_user_name();

alter table cars
  add column if not exists created_at timestamptz not null default now();

-- 'nickname' är nullable i specen — säkerställ existens.
alter table cars
  add column if not exists nickname text;

-- ---- car_trips ----

alter table car_trips
  add column if not exists image_path text;

alter table car_trips
  add column if not exists updated_at timestamptz;

alter table car_trips
  add column if not exists is_private boolean not null default false;

alter table car_trips
  add column if not exists is_fueling boolean not null default false;

alter table car_trips
  add column if not exists liters numeric(6,2);

alter table car_trips
  add column if not exists total_price numeric(8,2);

-- ---- RLS-policies (re-create — idempotent via drop policy if exists i 017) ----
-- Ingen åtgärd behövs här om 017 redan körts; den filen är idempotent.

-- ---- Tvinga PostgREST att ladda om schema-cache ----
-- PostgREST cachar schema vid uppstart + via NOTIFY pgrst. Utan denna
-- kan kolumner saknas i schema cache även efter ALTER TABLE.
notify pgrst, 'reload schema';

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- Lista alla kolumner på cars:
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'cars'
--   order by ordinal_position;
-- → ska visa: id, reg_nr, nickname, active, created_at, created_by

-- Samma för car_trips:
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'car_trips'
--   order by ordinal_position;
-- → ska visa 14 kolumner inkl. image_path, updated_at, is_private, is_fueling
