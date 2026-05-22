-- ============================================================
-- 004_rls_auth_tables.sql  (Fas 1, steg 1.5a)
-- RLS för user_pins och user_roles.
--
-- NOTERA: verify-pin Edge Function använder SUPABASE_SERVICE_ROLE_KEY
-- vilket BYPASSAR RLS. Det är därför failed_attempts/locked_until kan
-- uppdateras av Edge Function även med strikta policies här.
-- ============================================================

-- ─── user_pins ──────────────────────────────────────────────
alter table user_pins enable row level security;

-- SELECT: bara egen rad (eller admin). Ingen ska kunna lista andras hash.
drop policy if exists user_pins_select on user_pins;
create policy user_pins_select on user_pins
  for select to authenticated
  using (user_name = current_user_name() or is_admin());

-- UPDATE: egen rad (för PIN-byte via frontend) eller admin.
-- KÄND BEGRÄNSNING: en user kan teoretiskt nollställa egen failed_attempts
-- via DevTools. Härdas i senare fas via en change-pin Edge Function.
drop policy if exists user_pins_update on user_pins;
create policy user_pins_update on user_pins
  for update to authenticated
  using (user_name = current_user_name() or is_admin())
  with check (user_name = current_user_name() or is_admin());

-- INSERT: bara admin (skapa nya användare). Login skapas av Edge Function.
drop policy if exists user_pins_insert on user_pins;
create policy user_pins_insert on user_pins
  for insert to authenticated
  with check (is_admin());

-- DELETE: bara admin
drop policy if exists user_pins_delete on user_pins;
create policy user_pins_delete on user_pins
  for delete to authenticated
  using (is_admin());


-- ─── user_roles ─────────────────────────────────────────────
alter table user_roles enable row level security;

-- SELECT: alla autentiserade (vi vill kunna se vem som är admin i listor)
drop policy if exists user_roles_select on user_roles;
create policy user_roles_select on user_roles
  for select to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: bara admin
drop policy if exists user_roles_modify on user_roles;
create policy user_roles_modify on user_roles
  for all to authenticated
  using (is_admin())
  with check (is_admin());


-- ============================================================
-- VERIFIKATION (kör från SQL Editor — du är anon, så all SELECT blockerad)
-- ============================================================
-- Som anonymous:
-- select * from user_pins;     -- ska returnera 0 rader
-- select * from user_roles;    -- ska returnera 0 rader (anon ≠ authenticated)

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table user_pins disable row level security;
-- alter table user_roles disable row level security;
