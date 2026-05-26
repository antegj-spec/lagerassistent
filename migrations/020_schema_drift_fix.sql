-- ============================================================
-- 020_schema_drift_fix.sql  (Fas 8 Etapp B/C fixpack)
--
-- Self-contained: kör fullständig setup för cars + car_trips
-- även om 017 aldrig körts. Vid drift (befintlig cars-tabell utan
-- alla kolumner) läggs saknade kolumner till. Helt idempotent.
--
-- Bakgrund:
--   - Användare rapporterade PGRST204 vid 'lägg till bil':
--     "Could not find the 'active' column of 'cars' in the schema cache"
--   - cars-tabellen skapades manuellt under test innan migration kördes
--   - car_trips fanns inte alls
--
-- Säkert att köra flera gånger.
-- ============================================================

-- ============================================================
-- §1  CARS — skapa om saknas, fyll på drift-kolumner
-- ============================================================

create table if not exists cars (
  id          uuid primary key default gen_random_uuid(),
  reg_nr      text not null unique,
  nickname    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text not null default current_user_name()
);

-- Drift-fixar för det fall tabellen fanns innan med färre kolumner.
alter table cars add column if not exists nickname   text;
alter table cars add column if not exists active     boolean not null default true;
alter table cars add column if not exists created_at timestamptz not null default now();
alter table cars add column if not exists created_by text not null default current_user_name();

-- ============================================================
-- §2  CAR_TRIPS — skapa
-- ============================================================

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

-- Drift-fixar (om car_trips fanns innan med färre kolumner).
alter table car_trips add column if not exists from_loc    text;
alter table car_trips add column if not exists to_loc      text;
alter table car_trips add column if not exists purpose     text;
alter table car_trips add column if not exists is_private  boolean not null default false;
alter table car_trips add column if not exists is_fueling  boolean not null default false;
alter table car_trips add column if not exists liters      numeric(6,2);
alter table car_trips add column if not exists total_price numeric(8,2);
alter table car_trips add column if not exists image_path  text;
alter table car_trips add column if not exists updated_at  timestamptz;

-- ============================================================
-- §3  INDEXES
-- ============================================================

create index if not exists car_trips_car_date_idx
  on car_trips (car_id, trip_date desc, odometer_start desc);

create index if not exists car_trips_driver_idx
  on car_trips (driver);

create index if not exists car_trips_fueling_idx
  on car_trips (is_fueling) where is_fueling = true;

-- ============================================================
-- §4  RLS — cars
-- ============================================================

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

-- ============================================================
-- §5  RLS — car_trips
-- ============================================================

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

-- ============================================================
-- §6  REALTIME PUBLICATION
-- ============================================================

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
-- §7  Tvinga PostgREST att ladda om schema-cache
-- ============================================================

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFIKATION (kör manuellt efter)
-- ============================================================
-- select table_name, column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name in ('cars','car_trips')
--   order by table_name, ordinal_position;
--
-- → cars: 6 kolumner (id, reg_nr, nickname, active, created_at, created_by)
-- → car_trips: 17 kolumner
