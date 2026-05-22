-- ============================================================
-- 007_rls_tasks.sql  (Fas 1, steg 1.5d)
-- RLS för 4 task-tabeller.
-- task_status_log är APPEND-ONLY.
-- tasks-UPDATE: även tilldelade kan ändra status (assigned_to-kolumn).
-- ============================================================

-- ─── tasks ──────────────────────────────────────────────────
alter table tasks enable row level security;

drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks
  for select to authenticated using (true);

drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks
  for insert to authenticated
  with check (created_by = current_user_name());

-- UPDATE: skapare, admin, eller någon i assigned_to / responsible.
-- assigned_to är text[] (lista av usernames).
drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks
  for update to authenticated
  using (
    created_by = current_user_name()
    or is_admin()
    or current_user_name() = any(coalesce(assigned_to, array[]::text[]))
    or current_user_name() = responsible
  )
  with check (
    created_by = current_user_name()
    or is_admin()
    or current_user_name() = any(coalesce(assigned_to, array[]::text[]))
    or current_user_name() = responsible
  );

drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks
  for delete to authenticated using (is_admin());


-- ─── task_status_log (APPEND-ONLY) ──────────────────────────
alter table task_status_log enable row level security;

drop policy if exists task_status_log_select on task_status_log;
create policy task_status_log_select on task_status_log
  for select to authenticated using (true);

drop policy if exists task_status_log_insert on task_status_log;
create policy task_status_log_insert on task_status_log
  for insert to authenticated
  with check (changed_by = current_user_name());

-- INGEN UPDATE/DELETE → audit-skydd


-- ─── task_comments ─────────────────────────────────────────
alter table task_comments enable row level security;

drop policy if exists task_comments_select on task_comments;
create policy task_comments_select on task_comments
  for select to authenticated using (true);

drop policy if exists task_comments_insert on task_comments;
create policy task_comments_insert on task_comments
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists task_comments_update on task_comments;
create policy task_comments_update on task_comments
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists task_comments_delete on task_comments;
create policy task_comments_delete on task_comments
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());


-- ─── task_checklist ────────────────────────────────────────
alter table task_checklist enable row level security;

drop policy if exists task_checklist_select on task_checklist;
create policy task_checklist_select on task_checklist
  for select to authenticated using (true);

drop policy if exists task_checklist_insert on task_checklist;
create policy task_checklist_insert on task_checklist
  for insert to authenticated
  with check (created_by = current_user_name());

-- UPDATE: alla autentiserade — vem som helst kan toggla "done"
drop policy if exists task_checklist_update on task_checklist;
create policy task_checklist_update on task_checklist
  for update to authenticated using (true) with check (true);

drop policy if exists task_checklist_delete on task_checklist;
create policy task_checklist_delete on task_checklist
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table tasks            disable row level security;
-- alter table task_status_log  disable row level security;
-- alter table task_comments    disable row level security;
-- alter table task_checklist   disable row level security;
