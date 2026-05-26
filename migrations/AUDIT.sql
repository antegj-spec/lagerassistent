-- ============================================================
-- AUDIT.sql — Diagnostik för Lagerassistent Supabase-projekt
--
-- Kör en sektion i taget i Supabase SQL Editor och skicka
-- resultatet tillbaka till mig så kan jag identifiera vad som
-- behöver rensas, fixas eller migreras.
--
-- INGEN av dessa queries muterar något — bara läser.
-- ============================================================

-- ============================================================
-- §1  Alla tabeller i public-schemat
-- Förväntat (Fas 1-8): notes, comments, materials_v2,
-- material_items, material_counts, material_history,
-- material_comments, material_images, material_item_images,
-- borrowed_material, returns, tasks, task_status_log,
-- task_comments, task_checklists, task_info_links,
-- info_articles, info_images, info_comments, info_pdfs,
-- user_pins, user_roles, cars, car_trips, economy_entries,
-- push_subscriptions
-- ============================================================
select tablename
  from pg_tables
  where schemaname = 'public'
  order by tablename;

-- ============================================================
-- §2  Radantal per tabell
-- ============================================================
select
  schemaname, relname as table_name,
  n_live_tup as row_count
  from pg_stat_user_tables
  where schemaname = 'public'
  order by n_live_tup desc, relname;

-- ============================================================
-- §3  Tabeller UTAN row-level security aktiverat
-- (Alla user-data-tabeller MÅSTE ha RLS.)
-- ============================================================
select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
  order by c.relname;
-- → ska vara TOM lista.

-- ============================================================
-- §4  Tabeller i supabase_realtime publication
-- Förväntat: notes, materials_v2, material_counts,
-- material_items, borrowed_material, tasks, returns,
-- cars, car_trips, economy_entries
-- ============================================================
select schemaname, tablename
  from pg_publication_tables
  where pubname = 'supabase_realtime'
  order by tablename;

-- ============================================================
-- §5  Kolumner på cars + car_trips + economy_entries
-- (för att verifiera schema-drift)
-- ============================================================
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('cars','car_trips','economy_entries')
  order by table_name, ordinal_position;

-- ============================================================
-- §6  RLS-policies per tabell (admin/owner-mönster ska finnas)
-- ============================================================
select schemaname, tablename, policyname, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname;

-- ============================================================
-- §7  Indexes per tabell
-- (kolla att gap-detektion + filter-index finns)
-- ============================================================
select schemaname, tablename, indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and tablename in ('cars','car_trips','economy_entries')
  order by tablename, indexname;

-- ============================================================
-- §8  Främmande nycklar — hitta orphaned/broken referenser
-- ============================================================
select
  tc.table_name, kcu.column_name,
  ccu.table_name as foreign_table, ccu.column_name as foreign_column,
  tc.constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
  order by tc.table_name;

-- ============================================================
-- §9  Soft-deleted vs aktiva rader per tabell med deleted_at
-- (kolla om papperskorgen behöver rensas)
-- ============================================================
select 'notes' as t, count(*) filter (where deleted_at is null) as aktiva,
       count(*) filter (where deleted_at is not null) as soft_deleted
  from notes
union all
select 'materials_v2', count(*) filter (where deleted_at is null),
       count(*) filter (where deleted_at is not null)
  from materials_v2
union all
select 'tasks', count(*) filter (where deleted_at is null),
       count(*) filter (where deleted_at is not null)
  from tasks
union all
select 'returns', count(*) filter (where deleted_at is null),
       count(*) filter (where deleted_at is not null)
  from returns
union all
select 'info_articles', count(*) filter (where deleted_at is null),
       count(*) filter (where deleted_at is not null)
  from info_articles;

-- ============================================================
-- §10  Funktioner i public-schemat
-- Förväntat: current_user_name, current_user_role, is_admin,
-- is_intern_or_admin, move_count (+ ev. push/cron-helpers)
-- ============================================================
select n.nspname as schema, p.proname as function_name,
       pg_get_function_arguments(p.oid) as arguments,
       case p.prokind when 'f' then 'function' when 'p' then 'procedure' end as kind
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by p.proname;

-- ============================================================
-- §11  Storage-buckets (lager-images, lager-pdfs)
-- ============================================================
select id, name, public, created_at
  from storage.buckets
  order by name;

-- ============================================================
-- §12  Cron-jobs (om pg_cron är installerad)
-- ============================================================
-- Kommer ge "relation does not exist" om pg_cron inte finns.
select jobid, jobname, schedule, command, active
  from cron.job
  order by jobname;

-- ============================================================
-- §13  Test-rader att rensa (om du vill börja om från noll)
-- ============================================================
-- VARSAMT! Bara läs först. Kör DELETE bara om du vet att du vill.

-- Bilar utan resor (kandidater för cleanup):
-- select c.id, c.reg_nr, c.nickname
--   from cars c
--   left join car_trips t on t.car_id = c.id
--   where t.id is null;

-- Senaste 5 anteckningarna (kolla om testdata):
-- select id, text, created_by, created_at
--   from notes
--   order by created_at desc
--   limit 5;

-- ============================================================
-- §14  KLART — kopiera output och skicka till Claude för analys
-- ============================================================
