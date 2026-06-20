-- ============================================================
-- 030_return_items.sql  (Retur-formulär: rad per material)
-- En rad per returnerat material i en retur.
--
-- Bakgrund: returns.content var ett enda fritext-fält ("20 pall EPS PRO,
-- 40 m kabelskydd, 4 LD20..."). Det byts mot en strukturerad lista där
-- varje material är en egen rad med antal + kommentar. ALLT är fri text
-- (ingen FK mot materials_v2) — returen är en fri logg, inte kopplad till
-- lagersiffrorna (medvetet uppskjutet, se project_todo).
--
-- returns.content/comment behålls i tabellen för bakåtkompatibel visning
-- av gamla returer som ännu inte redigerats om till rader.
--
-- IDEMPOTENT — CREATE TABLE IF NOT EXISTS + drop policy if exists.
-- ============================================================

-- ---- TABELL ----
create table if not exists return_items (
  id          bigint generated always as identity primary key,
  return_id   bigint not null references returns(id) on delete cascade,
  -- Fri text, alla tre. quantity är text ("40 m", "ca 20", "1 rulle"), inte numerisk.
  material    text not null,
  quantity    text,
  comment     text,
  sort_order  integer not null default 0,
  created_by  text not null default current_user_name(),
  created_at  timestamptz not null default now()
);

create index if not exists return_items_return_idx
  on return_items (return_id, sort_order);

-- ---- RLS (speglar returns: alla läser; skapare skriver; admin allt) ----
alter table return_items enable row level security;

drop policy if exists return_items_select on return_items;
create policy return_items_select on return_items
  for select to authenticated using (true);

drop policy if exists return_items_insert on return_items;
create policy return_items_insert on return_items
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists return_items_update on return_items;
create policy return_items_update on return_items
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

-- Radering sker vid redigering (ersätt alla rader) — skaparen av raden eller
-- admin. (returns_delete är admin-only, men rad-ersättning måste fungera för
-- den som äger returen.)
drop policy if exists return_items_delete on return_items;
create policy return_items_delete on return_items
  for delete to authenticated
  using (created_by = current_user_name() or is_admin());

-- ---- REALTIME ----
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table return_items';
  exception
    when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. select * from return_items order by return_id, sort_order limit 10;
-- 2. Skapa en testretur i appen → kontrollera att raderna dyker upp här.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter publication supabase_realtime drop table return_items;
-- drop table if exists return_items;
