-- ============================================================
-- 006_rls_materials.sql  (Fas 1, steg 1.5c)
-- RLS för 8 material-tabeller.
-- material_history är APPEND-ONLY (audit log).
-- ============================================================

-- ─── materials_v2 (ingen created_by — använd role-baserad) ──
alter table materials_v2 enable row level security;

drop policy if exists materials_v2_select on materials_v2;
create policy materials_v2_select on materials_v2
  for select to authenticated using (true);

-- INSERT/UPDATE/DELETE: bara admin (matchar nuvarande UI-knappar)
drop policy if exists materials_v2_modify on materials_v2;
create policy materials_v2_modify on materials_v2
  for all to authenticated
  using (is_admin())
  with check (is_admin());


-- ─── material_items (alla autentiserade kan ändra status) ───
alter table material_items enable row level security;

drop policy if exists material_items_select on material_items;
create policy material_items_select on material_items
  for select to authenticated using (true);

-- INSERT: alla autentiserade kan skapa artiklar
drop policy if exists material_items_insert on material_items;
create policy material_items_insert on material_items
  for insert to authenticated with check (true);

-- UPDATE: alla autentiserade.
-- KÄND BEGRÄNSNING: "tillgänglig"-restriktionen (bara admin sätter denna status)
-- upprätthålls bara i frontend. Härdas i Fas 3 via trigger eller Edge Function.
drop policy if exists material_items_update on material_items;
create policy material_items_update on material_items
  for update to authenticated using (true) with check (true);

drop policy if exists material_items_delete on material_items;
create policy material_items_delete on material_items
  for delete to authenticated using (is_admin());


-- ─── material_counts (count-baserat material) ───────────────
alter table material_counts enable row level security;

drop policy if exists material_counts_select on material_counts;
create policy material_counts_select on material_counts
  for select to authenticated using (true);

-- INSERT/UPDATE: alla autentiserade (för move_count m.m.)
drop policy if exists material_counts_insert on material_counts;
create policy material_counts_insert on material_counts
  for insert to authenticated with check (true);

drop policy if exists material_counts_update on material_counts;
create policy material_counts_update on material_counts
  for update to authenticated using (true) with check (true);

drop policy if exists material_counts_delete on material_counts;
create policy material_counts_delete on material_counts
  for delete to authenticated using (is_admin());


-- ─── material_history (APPEND-ONLY audit log) ───────────────
alter table material_history enable row level security;

drop policy if exists material_history_select on material_history;
create policy material_history_select on material_history
  for select to authenticated using (true);

-- INSERT: changed_by måste matcha inloggad användare
drop policy if exists material_history_insert on material_history;
create policy material_history_insert on material_history
  for insert to authenticated
  with check (changed_by = current_user_name());

-- INGEN UPDATE-policy → ingen kan ändra audit log
-- INGEN DELETE-policy → ingen kan radera audit log
-- (utom service_role, för städningsjobb)


-- ─── material_comments ─────────────────────────────────────
alter table material_comments enable row level security;

drop policy if exists material_comments_select on material_comments;
create policy material_comments_select on material_comments
  for select to authenticated using (true);

drop policy if exists material_comments_insert on material_comments;
create policy material_comments_insert on material_comments
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists material_comments_update on material_comments;
create policy material_comments_update on material_comments
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists material_comments_delete on material_comments;
create policy material_comments_delete on material_comments
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());


-- ─── material_images (uploaded_by, inte created_by!) ────────
alter table material_images enable row level security;

drop policy if exists material_images_select on material_images;
create policy material_images_select on material_images
  for select to authenticated using (true);

drop policy if exists material_images_insert on material_images;
create policy material_images_insert on material_images
  for insert to authenticated
  with check (uploaded_by = current_user_name());

drop policy if exists material_images_delete on material_images;
create policy material_images_delete on material_images
  for delete to authenticated
  using (uploaded_by = current_user_name() or is_admin());


-- ─── material_item_images (uploaded_by) ─────────────────────
alter table material_item_images enable row level security;

drop policy if exists material_item_images_select on material_item_images;
create policy material_item_images_select on material_item_images
  for select to authenticated using (true);

drop policy if exists material_item_images_insert on material_item_images;
create policy material_item_images_insert on material_item_images
  for insert to authenticated
  with check (uploaded_by = current_user_name());

drop policy if exists material_item_images_delete on material_item_images;
create policy material_item_images_delete on material_item_images
  for delete to authenticated
  using (uploaded_by = current_user_name() or is_admin());


-- ─── borrowed_material ─────────────────────────────────────
alter table borrowed_material enable row level security;

drop policy if exists borrowed_material_select on borrowed_material;
create policy borrowed_material_select on borrowed_material
  for select to authenticated using (true);

drop policy if exists borrowed_material_insert on borrowed_material;
create policy borrowed_material_insert on borrowed_material
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists borrowed_material_update on borrowed_material;
create policy borrowed_material_update on borrowed_material
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists borrowed_material_delete on borrowed_material;
create policy borrowed_material_delete on borrowed_material
  for delete to authenticated using (is_admin());


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table materials_v2          disable row level security;
-- alter table material_items        disable row level security;
-- alter table material_counts       disable row level security;
-- alter table material_history      disable row level security;
-- alter table material_comments     disable row level security;
-- alter table material_images       disable row level security;
-- alter table material_item_images  disable row level security;
-- alter table borrowed_material     disable row level security;
