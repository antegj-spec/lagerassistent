-- ============================================================
-- 014_reserved_status_thresholds_service.sql  (Fas 6 Milstolpe 2)
--
-- Lägger till tre features:
--  - 6.5: ny status 'reserverad' + material_items.reserved_for (vem/vad)
--  - 6.6: materials_v2.min_threshold (lagernivå-varning, lagerräknande)
--  - 6.8: material_items.service_interval_days (service-intervall i dagar)
--
-- Alla ändringar är ADDITIVE — befintliga rader påverkas inte.
-- IDEMPOTENT — kan köras flera gånger utan biverkningar.
--
-- VIKTIGT: Migrationen uppdaterar status-CHECK constraints från 012.
-- Pre-flight längst ner är onödig (vi ADDERAR ett tillåtet värde, inte
-- tar bort) — men kvar för konsistens.
-- ============================================================

-- ---- 6.5 RESERVERAD-STATUS ----

-- Uppdatera CHECK constraints så 'reserverad' tillåts överallt status finns.

alter table material_counts
  drop constraint if exists material_counts_status_check;
alter table material_counts
  add constraint material_counts_status_check
  check (status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation', 'reserverad'));

alter table material_items
  drop constraint if exists material_items_status_check;
alter table material_items
  add constraint material_items_status_check
  check (status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation', 'reserverad'));

alter table material_history
  drop constraint if exists material_history_old_status_check;
alter table material_history
  add constraint material_history_old_status_check
  check (old_status is null or old_status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation', 'reserverad'));

alter table material_history
  drop constraint if exists material_history_new_status_check;
alter table material_history
  add constraint material_history_new_status_check
  check (new_status is null or new_status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation', 'reserverad'));

-- Reservationsmål (vem/vad artikeln är reserverad till). NULL när inte reserverad.
alter table material_items
  add column if not exists reserved_for text;

-- ---- 6.6 LAGERNIVÅ-VARNINGAR ----

-- Tröskel för "lågt lager"-varning. NULL = ingen varning aktiverad.
-- Endast meningsfull för lagerräknande material (is_article_based = false).
alter table materials_v2
  add column if not exists min_threshold integer;

-- ---- 6.8 SERVICE-INTERVALL PER ARTIKEL ----

-- Antal dagar sedan last_washed innan service-varning. NULL = ingen varning.
-- Endast meningsfull för artikel-baserade material (per item).
alter table material_items
  add column if not exists service_interval_days integer;

-- ============================================================
-- VERIFIKATION — kör EFTER migrationen
-- ============================================================
-- 1. Kontrollera att nya kolumner finns:
--    select column_name, data_type from information_schema.columns
--      where table_name = 'material_items'
--        and column_name in ('reserved_for', 'service_interval_days');
--    select column_name, data_type from information_schema.columns
--      where table_name = 'materials_v2'
--        and column_name = 'min_threshold';
--
-- 2. Kontrollera CHECK constraints — försök sätta ogiltig status:
--    update material_items set status = 'BOGUS' where id = (select id from material_items limit 1);
--    → ERROR: 23514 ... violates check constraint
--
-- 3. Sätt en reservation:
--    update material_items set status = 'reserverad', reserved_for = 'Festivalen 2026'
--      where article_id = '<välj-en>' and material_id = <id>;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- Återställ status-constraints till 012:s lista (utan 'reserverad').
-- Tar BORT alla rader med status='reserverad' först (annars failar constraint).
--
-- update material_items set status = 'tillgänglig' where status = 'reserverad';
-- update material_counts set status = 'tillgänglig' where status = 'reserverad';
--
-- alter table material_counts drop constraint if exists material_counts_status_check;
-- alter table material_counts add constraint material_counts_status_check
--   check (status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));
-- alter table material_items drop constraint if exists material_items_status_check;
-- alter table material_items add constraint material_items_status_check
--   check (status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));
-- alter table material_history drop constraint if exists material_history_old_status_check;
-- alter table material_history add constraint material_history_old_status_check
--   check (old_status is null or old_status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));
-- alter table material_history drop constraint if exists material_history_new_status_check;
-- alter table material_history add constraint material_history_new_status_check
--   check (new_status is null or new_status in ('okänd', 'tillgänglig', 'uthyrd', 'tvätt', 'reparation'));
--
-- alter table material_items   drop column if exists reserved_for;
-- alter table material_items   drop column if exists service_interval_days;
-- alter table materials_v2     drop column if exists min_threshold;
