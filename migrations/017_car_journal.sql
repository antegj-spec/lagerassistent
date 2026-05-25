-- ============================================================
-- 017_car_journal.sql  (Fas 8 Etapp B)
-- Körjournal för företagsbilar.
--
-- Tabeller:
--   cars         — bilregister (reg_nr + smeknamn)
--   car_trips    — körningar (inkl. inline-tankning)
--
-- RLS-modell:
--   Alla auth-users får SELECT + INSERT (vem som helst loggar resa).
--   Egen rad: UPDATE/DELETE.
--   Admin: UPDATE/DELETE på allt.
--
-- IDEMPOTENT: kan köras flera gånger utan biverkningar.
-- ============================================================

-- ---- TABELLER ----

create table if not exists cars (
  id          uuid primary key default gen_random_uuid(),
  reg_nr      text not null unique,
  nickname    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text not null default current_user_name()
);

create table if not exists car_trips (
  id               uuid primary key default gen_random_uuid(),
  car_id           uuid not null references cars(id) on delete restrict,
  driver           text not null,
  trip_date        date not null,
  from_loc         text,
  to_loc           text,
  purpose          text,
  odometer_start   integer not null check (odometer_start >= 0),
  odometer_end     integer not null check (odometer_end >= odometer_start),
  is_private       boolean not null default false,
  is_fueling       boolean not null default false,
  liters           numeric(6,2),
  total_price      numeric(8,2),
  image_path       text,
  created_by       text not null default current_user_name(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

-- ---- INDEXES ----

-- Gap-detektion + sortering per bil.
create index if not exists car_trips_car_date_idx
  on car_trips (car_id, trip_date desc, odometer_start desc);

-- Filter per förare.
create index if not exists car_trips_driver_idx
  on car_trips (driver);

-- Filter på tankningar.
create index if not exists car_trips_fueling_idx
  on car_trips (is_fueling) where is_fueling = true;

-- ---- RLS: cars ----

alter table cars enable row level security;

drop policy if exists cars_select on cars;
create policy cars_select on cars
  for select to authenticated using (true);

drop policy if exists cars_insert on cars;
create policy cars_insert on cars
  for insert to authenticated
  with check (is_admin());

drop policy if exists cars_update on cars;
create policy cars_update on cars
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists cars_delete on cars;
create policy cars_delete on cars
  for delete to authenticated using (is_admin());

-- ---- RLS: car_trips ----

alter table car_trips enable row level security;

drop policy if exists car_trips_select on car_trips;
create policy car_trips_select on car_trips
  for select to authenticated using (true);

drop policy if exists car_trips_insert on car_trips;
create policy car_trips_insert on car_trips
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists car_trips_update on car_trips;
create policy car_trips_update on car_trips
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists car_trips_delete on car_trips;
create policy car_trips_delete on car_trips
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());

-- ---- REALTIME PUBLICATION ----

do $$
declare
  t text;
begin
  for t in select unnest(array['cars','car_trips']) loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select * from cars;
-- select * from car_trips order by trip_date desc;
-- select schemaname, tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and tablename in ('cars','car_trips');

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter publication supabase_realtime drop table car_trips;
-- alter publication supabase_realtime drop table cars;
-- drop table if exists car_trips;
-- drop table if exists cars;
