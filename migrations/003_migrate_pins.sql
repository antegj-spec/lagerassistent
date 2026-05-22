-- ============================================================
-- 003_migrate_pins.sql  (Fas 1, steg 1.4 — engångsmigration)
-- Hashar alla klartext-PINs till bcrypt.
-- VIKTIGT: kör BARA EN GÅNG. Andra körning hashar redan-hashade värden.
-- IDEMPOTENT genom WHERE migrated = false.
-- ============================================================

-- Hasha alla icke-migrerade PINs
update user_pins
   set pin_hash = crypt(pin, gen_salt('bf', 10)),  -- bcrypt cost 10
       migrated = true
 where migrated = false
   and pin is not null;

-- Nolla klartext-PINs efter migration (kan inte återställas — säkrast)
update user_pins
   set pin = null
 where migrated = true
   and pin is not null;

-- ============================================================
-- VERIFIKATION — alla rader ska visa migrated=true, har_klartext=false, har_hash=true
-- ============================================================
-- select user_name, pin is not null as har_klartext, pin_hash is not null as har_hash, migrated
--   from user_pins
--  order by user_name;

-- Testa bcrypt-jämförelse (ska returnera true):
-- select crypt('0987', pin_hash) = pin_hash as admin_pin_funkar
--   from user_pins where user_name = 'Admin';

-- ============================================================
-- ROLLBACK — OMÖJLIGT
-- ============================================================
-- bcrypt är envägs. Använd Supabase backup för att återställa user_pins.
