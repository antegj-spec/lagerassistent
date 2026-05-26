-- ============================================================
-- 021_drop_dead_tables.sql  (Fas 8 audit-cleanup)
--
-- Droppar två legacy-tabeller som inte längre refereras av
-- kodbasen och båda är tomma (0 rader):
--
--   1. materials       — pre-Fas 1, ersatt av materials_v2
--   2. drive_logs      — användarens manuella körjournal-test
--                        innan car_trips byggdes på riktigt
--
-- DESTRUKTIVT men säkert eftersom båda är tomma och saknar
-- konsumenter i kodbasen. Verifierat via grep mot src/.
--
-- IDEMPOTENT.
-- ============================================================

-- ---- §1  Säkerhetskoll: blockera om tabellerna inte är tomma ----
-- (skydd ifall någon hunnit lägga in data efter audit)
do $$
declare
  mat_count integer;
  drv_count integer;
begin
  -- materials
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'materials') then
    execute 'select count(*) from public.materials' into mat_count;
    if mat_count > 0 then
      raise exception 'ABORT: public.materials har % rader — manuell granskning krävs', mat_count;
    end if;
  end if;
  -- drive_logs
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'drive_logs') then
    execute 'select count(*) from public.drive_logs' into drv_count;
    if drv_count > 0 then
      raise exception 'ABORT: public.drive_logs har % rader — manuell granskning krävs', drv_count;
    end if;
  end if;
end $$;

-- ---- §2  Ta bort tabellerna ----
-- CASCADE rensar även FK-konstraktioner från andra tabeller
-- (drive_logs.car_id → cars.id).
drop table if exists public.materials  cascade;
drop table if exists public.drive_logs cascade;

-- ---- §3  Schema-cache-reload ----
notify pgrst, 'reload schema';

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select tablename from pg_tables
--   where schemaname = 'public' and tablename in ('materials','drive_logs');
-- → ska vara TOM lista.
--
-- select tc.table_name, kcu.column_name, ccu.table_name as foreign_table
--   from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu
--     on tc.constraint_name = kcu.constraint_name
--   join information_schema.constraint_column_usage ccu
--     on ccu.constraint_name = tc.constraint_name
--   where tc.constraint_type = 'FOREIGN KEY'
--     and tc.table_schema = 'public'
--     and ccu.table_name = 'cars';
-- → ska bara visa car_trips.car_id → cars.id

-- ============================================================
-- ROLLBACK (informativt — kan inte återskapas via denna fil)
-- ============================================================
-- materials var pre-Fas 1, inga kvarvarande migrationsfiler.
-- drive_logs skapades manuellt utanför migrations/.
