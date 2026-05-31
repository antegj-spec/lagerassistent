-- ============================================================
-- 025_material_info_link.sql
-- Låter ett material länka vidare till EN info-artikel (Info-fliken).
-- Används av material-detaljvyn ("KOPPLAD INFO" + ev. PDF) och sätts
-- via Redigera material-formuläret.
--
-- ON DELETE SET NULL: om info-artikeln tas bort nollas länken, materialet
-- påverkas inte i övrigt.
-- ============================================================

ALTER TABLE materials_v2
  ADD COLUMN IF NOT EXISTS info_article_id BIGINT
  REFERENCES info_articles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_materials_v2_info_article_id
  ON materials_v2(info_article_id);
