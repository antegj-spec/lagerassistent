-- ============================================================
-- 002_pin_security.sql  (Fas 1, steg 1.3)
-- Lägger till bcrypt-hash, lockout och försökräkning på user_pins.
-- Kör DETTA innan du deployer verify-pin Edge Function.
-- ============================================================

-- Aktivera pgcrypto för bcrypt (crypt() + gen_salt())
create extension if not exists pgcrypto;

-- Nya kolumner — alla med defaults så befintliga rader fortsätter funka
alter table user_pins
  add column if not exists pin_hash text,
  add column if not exists migrated boolean not null default false,
  add column if not exists failed_attempts int not null default 0,
  add column if not exists locked_until timestamptz;

-- Index för snabb lookup vid login
create index if not exists idx_user_pins_user_name on user_pins (user_name);

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- Bör visa alla nya kolumner:
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_name = 'user_pins'
--  order by ordinal_position;

-- Bör visa migrated=false för alla rader (de migreras i 003):
-- select user_name, pin is not null as har_klartext, pin_hash is not null as har_hash, migrated
--   from user_pins;

-- ============================================================
-- ROLLBACK (FARLIGT — testa noga först)
-- ============================================================
-- alter table user_pins drop column if exists locked_until;
-- alter table user_pins drop column if exists failed_attempts;
-- alter table user_pins drop column if exists migrated;
-- alter table user_pins drop column if exists pin_hash;
-- drop index if exists idx_user_pins_user_name;
