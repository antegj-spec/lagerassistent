-- ============================================================
-- 032_auth_hardening_appmetadata.sql  (Säkerhetshärdning K1 + H1)
--
-- BAKGRUND (kritiskt grundfel):
-- current_user_name() läste identiteten ur JWT-claimen
--   auth.jwt() -> 'user_metadata' ->> 'user_name'
-- men `user_metadata` är ANVÄNDARSKRIVBAR i Supabase (sätts av klienten
-- vid signInAnonymously och kan ändras via PUT /auth/v1/user). Eftersom
-- anonym inloggning är påslagen och anon-nyckeln är publik kunde vem som
-- helst göra:
--   POST /auth/v1/signup  { "data": { "user_name": "Admin" } }
-- och därmed bli admin — helt förbi PIN/bcrypt/lockout.
--
-- FIX:
--  K1) current_user_name() läser nu ur `app_metadata` istället. app_metadata
--      kan ENDAST sättas av service-role (verify-pin Edge Function), aldrig
--      av användaren. En självskapad anon-session får tom identitet → noll
--      åtkomst. Detta gör samtidigt öppen anonym signup ofarlig.
--  H1) user_pins: ta bort authenticated SELECT/UPDATE så en användare inte
--      kan nollställa eget lockout (failed_attempts/locked_until) eller läsa
--      hash-rader. All PIN-hantering går via Edge Functions (service-role,
--      bypassar RLS). Bekräftat: ingen klientkod läser/skriver user_pins.
--
-- IDEMPOTENT — CREATE OR REPLACE + DROP POLICY IF EXISTS.
--
-- ⚠️ UTRULLNINGSORDNING (annars låses alla ut):
--   1. Deploya NY verify-pin FÖRST (skriver både app_metadata + user_metadata).
--   2. Kör DENNA migration.
--   3. Tvinga omlogin för alla aktiva sessioner (gamla tokens saknar
--      app_metadata och tappar åtkomst tills de loggar in på nytt).
-- ============================================================

-- ---- K1: identitet ur app_metadata (ej user_metadata) ----
create or replace function current_user_name() returns text
  language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_name', '')
$$;

-- current_user_role() / is_admin() / is_intern_or_admin() är oförändrade —
-- de härleder rollen ur user_roles-tabellen via current_user_name().


-- ---- H1: lås ner user_pins (ta bort klientåtkomst) ----
-- SELECT: ingen klientkod läser user_pins — ta bort. (verify-pin/change-pin
-- använder service-role och påverkas inte.)
drop policy if exists user_pins_select on user_pins;

-- UPDATE: tar bort självservice-uppdatering. Detta var lockout-bypassen
-- (användaren kunde PATCH:a egen failed_attempts/locked_until = 0).
drop policy if exists user_pins_update on user_pins;

-- INSERT/DELETE (admin) behålls — kan användas för användarhantering.
-- (user_pins_insert / user_pins_delete från 004 lämnas orörda.)


-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. Som anonym self-signup med påhittat user_name ska is_admin() bli false:
--    (skapa anon-session mot anon-nyckeln, sätt user_metadata.user_name='Admin',
--     anropa select is_admin();  → ska returnera false, förr: true)
--
-- 2. Som inloggad icke-admin:
--    select * from user_pins;     -- ska ge 0 rader (ingen SELECT-policy)
--    -- PATCH .../user_pins?...failed_attempts=0  -- ska ge 0 rader påverkade
--
-- 3. Inloggning + RLS för noter/material/tasks ska fungera som vanligt
--    EFTER omlogin (ny token bär app_metadata.user_name).

-- ============================================================
-- ROLLBACK
-- ============================================================
-- create or replace function current_user_name() returns text
--   language sql stable security definer set search_path = public
-- as $$ select coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '') $$;
--
-- create policy user_pins_select on user_pins
--   for select to authenticated
--   using (user_name = current_user_name() or is_admin());
-- create policy user_pins_update on user_pins
--   for update to authenticated
--   using (user_name = current_user_name() or is_admin())
--   with check (user_name = current_user_name() or is_admin());
