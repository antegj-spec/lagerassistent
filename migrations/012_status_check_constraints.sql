-- ============================================================
-- 012_status_check_constraints.sql  (Fas 3, steg 3.2 / B1)
-- CHECK constraints på alla status-kolumner.
--
-- Skyddar mot bugs där en typo eller felaktig kod-väg skriver
-- ogiltigt värde till DB. Constraint kastar då 23514 redan i
-- INSERT/UPDATE, så datan blir aldrig korrupt.
--
-- VIKTIGT: Migrationen failar om det redan finns rader med
-- ogiltiga statusar. Kör pre-flight-querysen längst ner FÖRST
-- för att hitta sådana rader. Om träffar: fixa data först, kör
-- sen migrationen.
--
-- IDEMPOTENT — drop+create på alla constraints.
-- ============================================================

-- ---- MATERIAL ----
-- Tillåtna statusar: 'okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'
-- (se MaterialStatus i src/domain/types.d.ts)

alter table material_counts
  drop constraint if exists material_counts_status_check;
alter table material_counts
  add constraint material_counts_status_check
  check (status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));

alter table material_items
  drop constraint if exists material_items_status_check;
alter table material_items
  add constraint material_items_status_check
  check (status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));

-- material_history har gamla rader där old/new_status kan vara null
-- (initial-INSERT av nytt material), så NULL tillåts explicit.
alter table material_history
  drop constraint if exists material_history_old_status_check;
alter table material_history
  add constraint material_history_old_status_check
  check (old_status is null or old_status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));

alter table material_history
  drop constraint if exists material_history_new_status_check;
alter table material_history
  add constraint material_history_new_status_check
  check (new_status is null or new_status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));

-- ---- NOTES ----
-- Tillåtna statusar: 'ny', 'pågår', 'klar' (se NoteStatus)

alter table notes
  drop constraint if exists notes_status_check;
alter table notes
  add constraint notes_status_check
  check (status in ('ny', 'pågår', 'klar'));

-- ---- TASKS ----
-- Tillåtna statusar: 'ny', 'pågår', 'klar' (se TaskStatus)

alter table tasks
  drop constraint if exists tasks_status_check;
alter table tasks
  add constraint tasks_status_check
  check (status in ('ny', 'pågår', 'klar'));

-- task_status_log har old_status nullable (första loggraden), new_status NOT NULL.
alter table task_status_log
  drop constraint if exists task_status_log_old_status_check;
alter table task_status_log
  add constraint task_status_log_old_status_check
  check (old_status is null or old_status in ('ny', 'pågår', 'klar'));

alter table task_status_log
  drop constraint if exists task_status_log_new_status_check;
alter table task_status_log
  add constraint task_status_log_new_status_check
  check (new_status in ('ny', 'pågår', 'klar'));

-- ============================================================
-- PRE-FLIGHT — kör FÖRE migrationen för att hitta rader som
-- skulle bryta constraint. Förväntat: alla returnerar 0 rader.
-- ============================================================
-- select 'material_counts' as t, id, status from material_counts
--   where status not in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation');
-- select 'material_items' as t, id, status from material_items
--   where status not in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation');
-- select 'material_history old' as t, id, old_status from material_history
--   where old_status is not null
--     and old_status not in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation');
-- select 'material_history new' as t, id, new_status from material_history
--   where new_status is not null
--     and new_status not in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation');
-- select 'notes' as t, id, status from notes
--   where status not in ('ny', 'pågår', 'klar');
-- select 'tasks' as t, id, status from tasks
--   where status not in ('ny', 'pågår', 'klar');
-- select 'task_status_log old' as t, id, old_status from task_status_log
--   where old_status is not null and old_status not in ('ny', 'pågår', 'klar');
-- select 'task_status_log new' as t, id, new_status from task_status_log
--   where new_status not in ('ny', 'pågår', 'klar');

-- ============================================================
-- VERIFIKATION — kör EFTER migrationen
-- ============================================================
-- 1. Lista alla CHECK constraints från denna migration:
--    select conname, conrelid::regclass as tbl
--      from pg_constraint
--      where contype = 'c'
--        and conname like any (array['%status_check', '%status_log_%_check']);
--
-- 2. Försök bryta en — ska kasta 23514:
--    insert into material_counts (material_id, status, count)
--      values (3, 'BOGUS', 1);
--    → ERROR: 23514 ... violates check constraint "material_counts_status_check"

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table material_counts     drop constraint if exists material_counts_status_check;
-- alter table material_items      drop constraint if exists material_items_status_check;
-- alter table material_history    drop constraint if exists material_history_old_status_check;
-- alter table material_history    drop constraint if exists material_history_new_status_check;
-- alter table notes               drop constraint if exists notes_status_check;
-- alter table tasks               drop constraint if exists tasks_status_check;
-- alter table task_status_log     drop constraint if exists task_status_log_old_status_check;
-- alter table task_status_log     drop constraint if exists task_status_log_new_status_check;
