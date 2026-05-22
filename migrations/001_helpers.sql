-- ============================================================
-- 001_helpers.sql  (Fas 1, steg 1.2)
-- Helper-funktioner som alla RLS-policies använder.
-- IDEMPOTENT — kan köras flera gånger utan biverkningar.
-- ============================================================

-- Returnerar inloggad användares user_name från JWT-claim.
-- Tom sträng om ingen JWT (= anonymous request).
create or replace function current_user_name() returns text
  language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'user_name', '')
$$;

-- Returnerar inloggad användares role.
-- LÄSER FRÅN TABELLEN, inte från JWT-claim.
-- Detta gör att admin kan ändra någons role direkt i DB
-- utan att personen behöver logga in på nytt.
create or replace function current_user_role() returns text
  language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role from user_roles where user_name = current_user_name()),
    'user'  -- default om okänd user
  )
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public
as $$
  select current_user_role() = 'admin'
$$;

create or replace function is_intern_or_admin() returns boolean
  language sql stable security definer set search_path = public
as $$
  select current_user_role() in ('intern_user', 'admin')
$$;

-- ============================================================
-- VERIFIKATION — kör efter migration för att kolla att det funkar
-- ============================================================
-- Som anonymous user ska dessa returnera: '', 'user', false, false
-- select current_user_name(), current_user_role(), is_admin(), is_intern_or_admin();

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists is_intern_or_admin();
-- drop function if exists is_admin();
-- drop function if exists current_user_role();
-- drop function if exists current_user_name();
