-- ============================================================
-- 008_rls_info.sql  (Fas 1, steg 1.5e)
-- RLS för info-tabeller (FAQ/info-flik).
-- ============================================================

-- ─── info_articles ──────────────────────────────────────────
alter table info_articles enable row level security;

drop policy if exists info_articles_select on info_articles;
create policy info_articles_select on info_articles
  for select to authenticated using (true);

drop policy if exists info_articles_insert on info_articles;
create policy info_articles_insert on info_articles
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists info_articles_update on info_articles;
create policy info_articles_update on info_articles
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

-- DELETE (hård radering): bara admin. Soft-delete via UPDATE.
drop policy if exists info_articles_delete on info_articles;
create policy info_articles_delete on info_articles
  for delete to authenticated using (is_admin());


-- ─── info_images (uploaded_by) ─────────────────────────────
alter table info_images enable row level security;

drop policy if exists info_images_select on info_images;
create policy info_images_select on info_images
  for select to authenticated using (true);

drop policy if exists info_images_insert on info_images;
create policy info_images_insert on info_images
  for insert to authenticated
  with check (uploaded_by = current_user_name());

drop policy if exists info_images_delete on info_images;
create policy info_images_delete on info_images
  for delete to authenticated
  using (uploaded_by = current_user_name() or is_admin());


-- ─── info_comments ─────────────────────────────────────────
alter table info_comments enable row level security;

drop policy if exists info_comments_select on info_comments;
create policy info_comments_select on info_comments
  for select to authenticated using (true);

drop policy if exists info_comments_insert on info_comments;
create policy info_comments_insert on info_comments
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists info_comments_update on info_comments;
create policy info_comments_update on info_comments
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists info_comments_delete on info_comments;
create policy info_comments_delete on info_comments
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table info_articles disable row level security;
-- alter table info_images   disable row level security;
-- alter table info_comments disable row level security;
