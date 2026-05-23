-- ============================================================
-- 013_realtime_publication.sql  (Fas 3, steg 3.5 / B19)
-- Lägg till tabeller i supabase_realtime-publication så att klienter
-- får postgres_changes-events via WebSocket. RLS gäller fortfarande
-- per event — användare ser bara ändringar på rader de får SELECT:a.
--
-- IDEMPOTENT — DO-block med exception swallow för duplicate_object.
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'notes',
      'materials_v2',
      'material_counts',
      'material_items',
      'borrowed_material',
      'tasks',
      'returns'
    ])
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception
      when duplicate_object then
        -- Tabellen är redan i publication — ignorera
        null;
    end;
  end loop;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- Lista alla tabeller i publication:
--   select schemaname, tablename
--     from pg_publication_tables
--     where pubname = 'supabase_realtime'
--     order by tablename;
-- → ska innehålla alla 7 tabeller från listan ovan.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter publication supabase_realtime drop table notes;
-- alter publication supabase_realtime drop table materials_v2;
-- alter publication supabase_realtime drop table material_counts;
-- alter publication supabase_realtime drop table material_items;
-- alter publication supabase_realtime drop table borrowed_material;
-- alter publication supabase_realtime drop table tasks;
-- alter publication supabase_realtime drop table returns;
