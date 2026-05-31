-- ============================================================
-- 023_material_categories.sql  (Material-ombyggnad: kategorier + artikelnr)
--
-- Lägger till två fält på materialmodellen:
--  - materials_v2.category        — redigerbar kategori (GIGS/Golv/Staket/MCCS…)
--  - materials_v2.article_number  — artikelnummer för lagerräknat material
--  - material_items.article_number — artikelnummer per artikel (artikelbaserat)
--
-- article_number är FRITEXT och INTE unikt — Excel-importen har dubbletter
-- (t.ex. 1000003.00 på två GIGS-rader, 1000014.00 på två).
--
-- Alla ändringar är ADDITIVE och IDEMPOTENT (add column if not exists).
-- Säkert att köra flera gånger.
-- ============================================================

alter table materials_v2   add column if not exists category       text;
alter table materials_v2   add column if not exists article_number text;
alter table material_items add column if not exists article_number text;

-- Tvinga PostgREST att ladda om schema-cachen så nya kolumner syns direkt.
notify pgrst, 'reload schema';

-- ============================================================
-- VERIFIKATION (kör manuellt efter)
-- ============================================================
-- select column_name, data_type from information_schema.columns
--   where table_name = 'materials_v2'
--     and column_name in ('category','article_number');
-- select column_name, data_type from information_schema.columns
--   where table_name = 'material_items' and column_name = 'article_number';

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table materials_v2   drop column if exists category;
-- alter table materials_v2   drop column if exists article_number;
-- alter table material_items drop column if exists article_number;
