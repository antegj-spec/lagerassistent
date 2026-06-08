-- ============================================================
-- 028_material_allocations.sql  (Fas 6.9 / Reserverat + Uthyrt)
-- Per-post-records för RESERVERAT och UTHYRT material.
--
-- Bakgrund: material_counts lagrar bara aggregerade antal per status
-- ("5 st reserverad") — ingen info om VAD det är reserverat/uthyrt till,
-- vart eller när det skickades. Den här tabellen lägger ett metadata-
-- lager ovanpå: en rad per reservation/uthyrning, med target, datum och
-- en livscykel reserverad → uthyrd → återlämnad.
--
-- material_counts förblir källan för aggregaten; RPC-funktionerna nedan
-- håller counts i synk ATOMISKT (samma mönster som 010_move_count.sql)
-- så vi aldrig får negativa counts eller allokeringar utan count-flytt.
--
-- target: target_text (fritext, små gig) ELLER place_id (FK till framtida
-- places-tabell — ligger som plain bigint nu, ingen FK ännu).
--
-- IDEMPOTENT — CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE.
-- ============================================================

-- ---- TABELL ----
create table if not exists material_allocations (
  id            bigint generated always as identity primary key,
  material_id   bigint not null references materials_v2(id) on delete cascade,
  -- NULL för lagerräknat material; satt för artikelbaserat (en rad per artikel).
  item_id       bigint references material_items(id) on delete cascade,
  kind          text not null check (kind in ('reserverad', 'uthyrd')),
  quantity      integer not null default 1 check (quantity > 0),
  -- Fritext-mål (små gig / kund). Används när place_id är NULL.
  target_text   text,
  -- Strukturerad plats-koppling (större gig). Plain bigint tills places-
  -- tabellen byggs i en senare etapp; då läggs FK + index till.
  place_id      bigint,
  status        text not null default 'aktiv'
                  check (status in ('aktiv', 'återlämnad', 'avbruten')),
  reserved_at   timestamptz not null default now(),
  -- När uthyrt skickades iväg. Sätts vid create om kind='uthyrd', annars
  -- vid promote_allocation (reserverad → uthyrd).
  sent_at       timestamptz,
  expected_return date,
  returned_at   timestamptz,
  comment       text,
  created_by    text not null default current_user_name(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

create index if not exists material_allocations_material_idx
  on material_allocations (material_id);
create index if not exists material_allocations_active_idx
  on material_allocations (status, kind);

-- ---- RLS ----
alter table material_allocations enable row level security;

drop policy if exists material_allocations_select on material_allocations;
create policy material_allocations_select on material_allocations
  for select to authenticated using (true);

-- Direkta mutationer (t.ex. redigera target_text) — skapare eller admin.
-- Skapande/flyttar går normalt via SECURITY DEFINER-RPC nedan (bypassar RLS).
drop policy if exists material_allocations_insert on material_allocations;
create policy material_allocations_insert on material_allocations
  for insert to authenticated
  with check (created_by = current_user_name());

drop policy if exists material_allocations_update on material_allocations;
create policy material_allocations_update on material_allocations
  for update to authenticated
  using (created_by = current_user_name() or is_admin())
  with check (created_by = current_user_name() or is_admin());

drop policy if exists material_allocations_delete on material_allocations;
create policy material_allocations_delete on material_allocations
  for delete to authenticated using (is_admin());

-- ============================================================
-- RPC: create_allocation
-- Skapar en reservation/uthyrning och flyttar counts/status atomiskt.
--   Lagerräknat (p_item_id null): flyttar p_qty tillgänglig → kind.
--   Artikelbaserat (p_item_id satt): sätter artikelns status = kind.
-- ============================================================
create or replace function create_allocation(
  p_material_id     bigint,
  p_kind            text,
  p_qty             integer  default 1,
  p_item_id         bigint   default null,
  p_target_text     text     default null,
  p_place_id        bigint   default null,
  p_expected_return date     default null,
  p_comment         text     default null
) returns bigint
  language plpgsql security definer set search_path = public
as $$
declare
  v_user        text := current_user_name();
  v_alloc_id    bigint;
  v_avail       integer;
  v_kind_count  integer;
  v_item_status text;
  v_article_id  text;
  v_sent        timestamptz := case when p_kind = 'uthyrd' then now() else null end;
begin
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;
  if p_kind not in ('reserverad', 'uthyrd') then
    raise exception 'ogiltig kind: %', p_kind using errcode = '22023';
  end if;

  if p_item_id is not null then
    -- ---- ARTIKELBASERAT (en artikel) ----
    select status, article_id into v_item_status, v_article_id
      from material_items where id = p_item_id for update;
    if not found then
      raise exception 'artikel % saknas', p_item_id using errcode = 'P0002';
    end if;

    update material_items
      set status = p_kind,
          reserved_for = case when p_kind = 'reserverad' then p_target_text else reserved_for end,
          updated_at = now()
      where id = p_item_id;

    insert into material_allocations
      (material_id, item_id, kind, quantity, target_text, place_id, expected_return, comment, created_by, sent_at)
      values (p_material_id, p_item_id, p_kind, 1, p_target_text, p_place_id, p_expected_return, p_comment, v_user, v_sent)
      returning id into v_alloc_id;

    insert into material_history
      (material_id, item_id, article_id, old_status, new_status, changed_by, comment)
      values (p_material_id, p_item_id, v_article_id, v_item_status, p_kind, v_user, p_comment);
  else
    -- ---- LAGERRÄKNAT (flytta antal tillgänglig → kind) ----
    if p_qty is null or p_qty <= 0 then
      raise exception 'qty måste vara > 0' using errcode = '22023';
    end if;

    select count into v_avail
      from material_counts
      where material_id = p_material_id and status = 'tillgänglig'
      for update;

    if v_avail is null or v_avail < p_qty then
      raise exception 'försökte allokera % men bara % tillgängliga',
        p_qty, coalesce(v_avail, 0) using errcode = '23514';
    end if;

    update material_counts
      set count = v_avail - p_qty, updated_at = now()
      where material_id = p_material_id and status = 'tillgänglig';

    select count into v_kind_count
      from material_counts
      where material_id = p_material_id and status = p_kind
      for update;

    if v_kind_count is null then
      insert into material_counts (material_id, status, count)
        values (p_material_id, p_kind, p_qty);
    else
      update material_counts
        set count = v_kind_count + p_qty, updated_at = now()
        where material_id = p_material_id and status = p_kind;
    end if;

    insert into material_allocations
      (material_id, item_id, kind, quantity, target_text, place_id, expected_return, comment, created_by, sent_at)
      values (p_material_id, null, p_kind, p_qty, p_target_text, p_place_id, p_expected_return, p_comment, v_user, v_sent)
      returning id into v_alloc_id;

    insert into material_history
      (material_id, old_status, new_status, count_change, changed_by, comment)
      values (p_material_id, 'tillgänglig', p_kind, p_qty, v_user, p_comment);
  end if;

  return v_alloc_id;
end;
$$;

-- ============================================================
-- RPC: promote_allocation  (reserverad → uthyrd)
-- "Skicka vidare till uthyrt"-knappen.
-- ============================================================
create or replace function promote_allocation(
  p_allocation_id bigint,
  p_comment       text default null
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_user        text := current_user_name();
  a             material_allocations;
  v_res         integer;
  v_uth         integer;
  v_item_status text;
  v_article_id  text;
begin
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;

  select * into a from material_allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'allokering % saknas', p_allocation_id using errcode = 'P0002';
  end if;
  if a.kind <> 'reserverad' or a.status <> 'aktiv' then
    raise exception 'bara aktiva reservationer kan skickas vidare' using errcode = '22023';
  end if;

  if a.item_id is not null then
    select status, article_id into v_item_status, v_article_id
      from material_items where id = a.item_id for update;
    update material_items set status = 'uthyrd', updated_at = now() where id = a.item_id;
    insert into material_history
      (material_id, item_id, article_id, old_status, new_status, changed_by, comment)
      values (a.material_id, a.item_id, v_article_id, v_item_status, 'uthyrd', v_user, p_comment);
  else
    select count into v_res
      from material_counts
      where material_id = a.material_id and status = 'reserverad'
      for update;
    if v_res is null or v_res < a.quantity then
      raise exception 'inkonsekvent: reserverad-count för lågt' using errcode = '23514';
    end if;
    update material_counts
      set count = v_res - a.quantity, updated_at = now()
      where material_id = a.material_id and status = 'reserverad';

    select count into v_uth
      from material_counts
      where material_id = a.material_id and status = 'uthyrd'
      for update;
    if v_uth is null then
      insert into material_counts (material_id, status, count) values (a.material_id, 'uthyrd', a.quantity);
    else
      update material_counts
        set count = v_uth + a.quantity, updated_at = now()
        where material_id = a.material_id and status = 'uthyrd';
    end if;

    insert into material_history
      (material_id, old_status, new_status, count_change, changed_by, comment)
      values (a.material_id, 'reserverad', 'uthyrd', a.quantity, v_user, p_comment);
  end if;

  update material_allocations
    set kind = 'uthyrd', sent_at = now(),
        comment = coalesce(p_comment, comment), updated_at = now()
    where id = p_allocation_id;
end;
$$;

-- ============================================================
-- RPC: close_allocation  (avsluta — flytta tillbaka till lagret)
-- "Återlämna"-knappen. p_to_status = vart antalet/artikeln hamnar.
-- ============================================================
create or replace function close_allocation(
  p_allocation_id bigint,
  p_to_status     text default 'tillgänglig',
  p_comment       text default null
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_user        text := current_user_name();
  a             material_allocations;
  v_from        integer;
  v_to          integer;
  v_item_status text;
  v_article_id  text;
begin
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;
  if p_to_status not in ('tillgänglig', 'tvätt', 'reparation', 'okänd') then
    raise exception 'ogiltig återlämningsstatus: %', p_to_status using errcode = '22023';
  end if;

  select * into a from material_allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'allokering % saknas', p_allocation_id using errcode = 'P0002';
  end if;
  if a.status <> 'aktiv' then
    raise exception 'allokeringen är redan avslutad' using errcode = '22023';
  end if;

  if a.item_id is not null then
    select status, article_id into v_item_status, v_article_id
      from material_items where id = a.item_id for update;
    update material_items
      set status = p_to_status, reserved_for = null, updated_at = now()
      where id = a.item_id;
    insert into material_history
      (material_id, item_id, article_id, old_status, new_status, changed_by, comment)
      values (a.material_id, a.item_id, v_article_id, v_item_status, p_to_status, v_user, p_comment);
  else
    select count into v_from
      from material_counts
      where material_id = a.material_id and status = a.kind
      for update;
    if v_from is null or v_from < a.quantity then
      raise exception 'inkonsekvent: %-count för lågt', a.kind using errcode = '23514';
    end if;
    update material_counts
      set count = v_from - a.quantity, updated_at = now()
      where material_id = a.material_id and status = a.kind;

    select count into v_to
      from material_counts
      where material_id = a.material_id and status = p_to_status
      for update;
    if v_to is null then
      insert into material_counts (material_id, status, count) values (a.material_id, p_to_status, a.quantity);
    else
      update material_counts
        set count = v_to + a.quantity, updated_at = now()
        where material_id = a.material_id and status = p_to_status;
    end if;

    insert into material_history
      (material_id, old_status, new_status, count_change, changed_by, comment)
      values (a.material_id, a.kind, p_to_status, a.quantity, v_user, p_comment);
  end if;

  update material_allocations
    set status = 'återlämnad', returned_at = now(),
        comment = coalesce(p_comment, comment), updated_at = now()
    where id = p_allocation_id;
end;
$$;

-- ---- GRANTS ----
revoke all on function create_allocation(bigint, text, integer, bigint, text, bigint, date, text) from public;
grant execute on function create_allocation(bigint, text, integer, bigint, text, bigint, date, text) to authenticated;
revoke all on function promote_allocation(bigint, text) from public;
grant execute on function promote_allocation(bigint, text) to authenticated;
revoke all on function close_allocation(bigint, text, text) from public;
grant execute on function close_allocation(bigint, text, text) to authenticated;

-- ---- REALTIME ----
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table material_allocations';
  exception
    when duplicate_object then null;
  end;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. Hitta count-baserat material med tillgängliga:
--    select m.id, m.name, c.count from materials_v2 m
--      join material_counts c on c.material_id=m.id
--      where m.is_article_based=false and c.status='tillgänglig' and c.count>0 limit 5;
-- 2. Reservera 3 till ett gig:
--    select create_allocation(<id>, 'reserverad', 3, null, 'Tons of Rock 2026');
-- 3. Kolla counts (tillgänglig -3, reserverad +3) + allokeringsraden:
--    select status,count from material_counts where material_id=<id>;
--    select * from material_allocations where material_id=<id>;
-- 4. Skicka vidare till uthyrt:
--    select promote_allocation(<alloc_id>, 'Lastat på bil');
-- 5. Återlämna:
--    select close_allocation(<alloc_id>, 'tillgänglig', 'Tillbaka i lager');

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists close_allocation(bigint, text, text);
-- drop function if exists promote_allocation(bigint, text);
-- drop function if exists create_allocation(bigint, text, integer, bigint, text, bigint, date, text);
-- alter publication supabase_realtime drop table material_allocations;
-- drop table if exists material_allocations;
