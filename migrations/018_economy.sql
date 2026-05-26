-- ============================================================
-- 018_economy.sql  (Fas 8 Etapp C)
-- Ekonomi-modul — utgiftsspårning per kategori och år.
--
-- Tabell:
--   economy_entries — en rad per utgift
--
-- RLS-modell:
--   Endast admin får SELECT/INSERT/UPDATE/DELETE.
--   (Resten av appen ska inte se ekonomi-data.)
--
-- IDEMPOTENT.
-- ============================================================

create table if not exists economy_entries (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  year        integer not null check (year between 2000 and 2099),
  title       text not null,
  price       numeric(10,2) not null default 0,
  comment     text,
  created_by  text not null default current_user_name(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

-- Filter per år + kategori (mest använda queries).
create index if not exists economy_entries_year_category_idx
  on economy_entries (year desc, category);

-- ---- RLS: admin-only ----

alter table economy_entries enable row level security;

drop policy if exists economy_select on economy_entries;
create policy economy_select on economy_entries
  for select to authenticated using (is_admin());

drop policy if exists economy_insert on economy_entries;
create policy economy_insert on economy_entries
  for insert to authenticated
  with check (is_admin());

drop policy if exists economy_update on economy_entries;
create policy economy_update on economy_entries
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists economy_delete on economy_entries;
create policy economy_delete on economy_entries
  for delete to authenticated using (is_admin());

-- ---- REALTIME ----

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table economy_entries';
  exception
    when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select category, sum(price) as total
--   from economy_entries
--   where year = 2026
--   group by category
--   order by total desc;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter publication supabase_realtime drop table economy_entries;
-- drop table if exists economy_entries;
