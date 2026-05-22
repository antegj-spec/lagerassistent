-- ============================================================
-- 005_rls_notes.sql  (Fas 1, steg 1.5b)
-- RLS för notes + comments (kommentarer på noter).
-- Löser B7 — intern-filter flyttas från klient till DB.
-- ============================================================

-- ─── notes ──────────────────────────────────────────────────
alter table notes enable row level security;

-- SELECT: alla autentiserade SER alla noter UTOM intern-noter (bara intern_user/admin)
-- Soft-deleted är synliga (klienten filtrerar för papperskorg)
drop policy if exists notes_select on notes;
create policy notes_select on notes
  for select to authenticated
  using (category != 'intern' or is_intern_or_admin());

-- INSERT: created_by måste matcha inloggad användare
drop policy if exists notes_insert on notes;
create policy notes_insert on notes
  for insert to authenticated
  with check (created_by = current_user_name());

-- UPDATE: egen note eller admin (löser S3 — klient kan inte längre PATCHa andras)
drop policy if exists notes_update on notes;
create policy notes_update on notes
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

-- DELETE (hård radering): bara admin. Soft-delete sker via UPDATE deleted_at.
drop policy if exists notes_delete on notes;
create policy notes_delete on notes
  for delete to authenticated
  using (is_admin());


-- ─── comments (på noter) ────────────────────────────────────
alter table comments enable row level security;

-- SELECT: alla autentiserade ser alla kommentarer
-- (vi kontrollerar inte att note är synlig — kommentar utan synlig parent är harmlöst)
drop policy if exists comments_select on comments;
create policy comments_select on comments
  for select to authenticated
  using (true);

drop policy if exists comments_insert on comments;
create policy comments_insert on comments
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists comments_update on comments;
create policy comments_update on comments
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists comments_delete on comments;
create policy comments_delete on comments
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table notes disable row level security;
-- alter table comments disable row level security;
