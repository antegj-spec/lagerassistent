-- ============================================================
-- 027_info_articles_category_material.sql
-- Lägg till "Material" (och säkra alla fem) i kategori-constrainten
-- på info_articles.
--
-- BAKGRUND / BUGG:
--   INFO_CATS i config.ts har fem kategorier:
--     Utrustning, Maskiner, Rutiner, Platser och Arenor, Material
--   men check-constrainten info_articles_category_check i databasen
--   saknade "Material". Att spara ett info-förslag i kategorin Material
--   gav:  new row for relation "info_articles" violates check
--         constraint "info_articles_category_check"
--   Constrainten skapades direkt i Supabase (finns inte i någon tidigare
--   migration), så denna migration återskapar den med alla fem värden.
--
-- IDEMPOTENT: droppar valfri befintlig check-constraint på category
-- (oavsett namn) och återskapar en namngiven variant.
-- ============================================================

do $$
declare
  c text;
begin
  -- Droppa alla check-constraints på info_articles som rör category-kolumnen.
  for c in
    select conname from pg_constraint
    where conrelid = 'info_articles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table info_articles drop constraint %I', c);
  end loop;
end $$;

alter table info_articles
  add constraint info_articles_category_check
  check (category in (
    'Utrustning',
    'Maskiner',
    'Rutiner',
    'Platser och Arenor',
    'Material'
  ));

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'info_articles'::regclass
--     and conname = 'info_articles_category_check';
-- select distinct category from info_articles;

-- ============================================================
-- ROLLBACK (återgå till de fyra ursprungliga kategorierna)
-- ============================================================
-- alter table info_articles drop constraint if exists info_articles_category_check;
-- alter table info_articles
--   add constraint info_articles_category_check
--   check (category in ('Utrustning','Maskiner','Rutiner','Platser och Arenor'));
