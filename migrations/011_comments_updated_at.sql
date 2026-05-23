-- ============================================================
-- 011_comments_updated_at.sql  (Fas 3, steg 3.9)
-- Lägg till updated_at-kolumn på comments-tabellen.
--
-- Bakgrund: editComment i src/legacy/supabase.ts skickar en PATCH-body
-- med { text, updated_at }. comments-tabellen saknade kolumnen vilket
-- gav 400 Bad Request. Andra comment-tabeller (task_comments,
-- material_comments) har kolumnen sedan tidigare — denna migration
-- gör comments konsistent.
--
-- IDEMPOTENT — `add column if not exists` är säkert att köra om.
-- ============================================================

alter table comments
  add column if not exists updated_at timestamptz;

-- Initiera updated_at = created_at för befintliga rader så att sortering
-- och visning blir vettig direkt (inte null för äldre kommentarer).
update comments
  set updated_at = created_at
  where updated_at is null;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. Kolla att kolumnen finns:
--    select column_name, data_type from information_schema.columns
--      where table_name = 'comments' and column_name = 'updated_at';
--
-- 2. Kolla att alla rader har värde:
--    select count(*) filter (where updated_at is null) as nulls,
--           count(*) as total
--      from comments;
--    → nulls ska vara 0.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table comments drop column if exists updated_at;
