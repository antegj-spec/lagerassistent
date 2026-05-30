-- ============================================================
-- 022_car_trip_open_state.sql  (Fas 8 — körjournal v2)
-- Gör om car_trips från "hel resa på en gång" till ett tillstånd:
--   inled resa (status='open', odometer_end null) → avsluta (status='closed').
-- Plus explicit lucka-rad (needs_purpose=true) för oförklarad körning
-- som upptäcks när start-km inte stämmer med senast kända ställning.
--
-- IDEMPOTENT: kan köras flera gånger utan biverkningar.
-- BAKÅTKOMPATIBELT: befintliga rader blir status='closed' (båda km satta).
-- ============================================================

-- ---- 1. odometer_end blir nullable (öppen resa saknar slut) ----

alter table car_trips alter column odometer_end drop not null;

-- Den gamla check-constrainten (odometer_end >= odometer_start) tillåter
-- inte null. Hitta + droppa den (oavsett auto-genererat namn) och ersätt
-- med en variant som släpper igenom öppna resor.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'car_trips'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%odometer_end%odometer_start%'
  loop
    execute format('alter table car_trips drop constraint %I', c);
  end loop;
end $$;

alter table car_trips
  add constraint car_trips_odo_end_chk
  check (odometer_end is null or odometer_end >= odometer_start);

-- ---- 2. Nya kolumner ----

alter table car_trips
  add column if not exists status text not null default 'closed';

alter table car_trips
  add column if not exists needs_purpose boolean not null default false;

-- status får bara vara open|closed
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'car_trips'::regclass and conname = 'car_trips_status_chk'
  ) then
    alter table car_trips
      add constraint car_trips_status_chk check (status in ('open','closed'));
  end if;
end $$;

-- ---- 3. Index ----

-- Max EN öppen resa per bil (annars blir "pågående resa" tvetydigt).
create unique index if not exists car_trips_one_open_per_car
  on car_trips (car_id) where status = 'open';

-- Snabb uppslagning av luckor att fylla i.
create index if not exists car_trips_needs_purpose_idx
  on car_trips (needs_purpose) where needs_purpose = true;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select status, count(*) from car_trips group by status;
-- select * from car_trips where status = 'open';
-- select * from car_trips where needs_purpose;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop index if exists car_trips_one_open_per_car;
-- drop index if exists car_trips_needs_purpose_idx;
-- alter table car_trips drop constraint if exists car_trips_status_chk;
-- alter table car_trips drop column if exists needs_purpose;
-- alter table car_trips drop column if exists status;
-- alter table car_trips drop constraint if exists car_trips_odo_end_chk;
-- update car_trips set odometer_end = odometer_start where odometer_end is null;
-- alter table car_trips alter column odometer_end set not null;
-- alter table car_trips add check (odometer_end >= odometer_start);
