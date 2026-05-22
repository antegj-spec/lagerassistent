-- ============================================================
-- 009_rls_returns.sql  (Fas 1, steg 1.5f)
-- RLS för returns-tabellen.
-- ============================================================

alter table returns enable row level security;

drop policy if exists returns_select on returns;
create policy returns_select on returns
  for select to authenticated using (true);

drop policy if exists returns_insert on returns;
create policy returns_insert on returns
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists returns_update on returns;
create policy returns_update on returns
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists returns_delete on returns;
create policy returns_delete on returns
  for delete to authenticated using (is_admin());


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table returns disable row level security;
