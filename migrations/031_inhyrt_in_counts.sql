-- ============================================================
-- 031_inhyrt_in_counts.sql
-- Inhyrt material räknas som tillgängligt.
--
-- Bakgrund: inhyrt material låg i borrowed_material och deltog INTE i
-- material_counts. Reservera/Hyr ut/Flytta antal går via counts
-- (create_allocation/move_count), så inhyrt antal gick inte att agera på —
-- det blåste bara upp den visade totalen (total_count + inhyrt) utan att
-- ligga i någon status.
--
-- Lösning: fäll in inhyrt-antalet i material_counts.tillgänglig. Då fungerar
-- all befintlig allokerings-/flytt-maskineri automatiskt. total_count förblir
-- "eget"; den nya invarianten är:
--
--   summa(material_counts) == total_count + summa(aktivt inhyrt)
--
-- 'okänd' absorberar mellanskillnaden, precis som tidigare fast med inhyrt
-- inräknat.
--
-- Kräver 030 (set_total_count med aggregat-fix för v_prev_okand).
-- IDEMPOTENT — CREATE OR REPLACE + markör-guard på engångs-folden.
-- ============================================================

-- ============================================================
-- RPC: add_borrowed
-- Skapar en inhyrt-post OCH ökar tillgänglig atomiskt (mönster från
-- create_allocation i 028). Returnerar nya borrowed-id:t.
-- ============================================================
create or replace function add_borrowed(
  p_material_id  bigint,
  p_quantity     integer,
  p_supplier     text  default null,
  p_start_date   date  default null,
  p_end_date     date  default null,
  p_reason       text  default null,
  p_comment      text  default null
) returns bigint
  language plpgsql security definer set search_path = public
as $$
declare
  v_user      text := current_user_name();
  v_borrow_id bigint;
  v_avail     integer;
begin
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'antal måste vara > 0' using errcode = '22023';
  end if;

  -- Lås materialraden (race-skydd, samma materialfönster som counts nedan).
  perform 1 from materials_v2 where id = p_material_id for update;
  if not found then
    raise exception 'material % saknas', p_material_id using errcode = 'P0002';
  end if;

  insert into borrowed_material
    (material_id, quantity, supplier, start_date, end_date, reason, comment, created_by)
    values
    (p_material_id, p_quantity, p_supplier, p_start_date, p_end_date, p_reason, p_comment, v_user)
    returning id into v_borrow_id;

  -- Öka tillgänglig (skapa raden om den saknas).
  select count into v_avail
    from material_counts
    where material_id = p_material_id and status = 'tillgänglig'
    for update;
  if v_avail is null then
    insert into material_counts (material_id, status, count)
      values (p_material_id, 'tillgänglig', p_quantity);
  else
    update material_counts
      set count = v_avail + p_quantity, updated_at = now()
      where material_id = p_material_id and status = 'tillgänglig';
  end if;

  insert into material_history
    (material_id, old_status, new_status, count_change, changed_by, comment)
    values
    (p_material_id, null, 'tillgänglig', p_quantity, v_user,
     'Inhyrt material tillagt — +' || p_quantity || ' tillgänglig');

  return v_borrow_id;
end;
$$;

-- ============================================================
-- RPC: remove_borrowed
-- Tar bort (soft-delete) en inhyrt-post OCH minskar tillgänglig atomiskt.
-- Kräver att tillräckligt ligger i 'tillgänglig' — annars måste användaren
-- återlämna/flytta tillbaka först (slipper negativa counts och gissningar om
-- vilka enheter som är inhyrda).
-- ============================================================
create or replace function remove_borrowed(
  p_borrow_id  bigint
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_user      text := current_user_name();
  v_mat       bigint;
  v_qty       integer;
  v_deleted   timestamptz;
  v_avail     integer;
begin
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;

  select material_id, quantity, deleted_at
    into v_mat, v_qty, v_deleted
    from borrowed_material where id = p_borrow_id for update;
  if not found then
    raise exception 'inhyrt-post % saknas', p_borrow_id using errcode = 'P0002';
  end if;
  if v_deleted is not null then
    raise exception 'inhyrt-posten är redan borttagen' using errcode = '22023';
  end if;
  v_qty := coalesce(v_qty, 0);

  -- Lås + kontrollera tillgänglig.
  select count into v_avail
    from material_counts
    where material_id = v_mat and status = 'tillgänglig'
    for update;
  if coalesce(v_avail, 0) < v_qty then
    raise exception
      'kan inte ta bort % inhyrt: bara % tillgängliga. Återlämna/flytta tillbaka till Tillgänglig först.',
      v_qty, coalesce(v_avail, 0) using errcode = '23514';
  end if;

  update material_counts
    set count = v_avail - v_qty, updated_at = now()
    where material_id = v_mat and status = 'tillgänglig';

  update borrowed_material
    set deleted_at = now()
    where id = p_borrow_id;

  insert into material_history
    (material_id, old_status, new_status, count_change, changed_by, comment)
    values
    (v_mat, 'tillgänglig', null, -v_qty, v_user,
     'Inhyrt material borttaget — −' || v_qty || ' tillgänglig');
end;
$$;

-- ============================================================
-- RPC: set_total_count  (vidareutveckling av 030)
-- Räknar nu mot total_count (eget) + aktivt inhyrt. okänd absorberar
-- mellanskillnaden mot DEN effektiva totalen.
-- ============================================================
create or replace function set_total_count(
  p_material_id  bigint,
  p_new_total    integer
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_user        text := current_user_name();
  v_borrowed    integer;
  v_effective   integer;
  v_allocated   integer;
  v_prev_okand  integer;
  v_new_okand   integer;
begin
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;

  if p_new_total is null or p_new_total < 0 then
    raise exception 'totalen kan inte vara negativ' using errcode = '22023';
  end if;

  perform 1 from materials_v2 where id = p_material_id for update;
  if not found then
    raise exception 'material % saknas', p_material_id using errcode = 'P0002';
  end if;

  perform 1 from material_counts where material_id = p_material_id for update;

  -- Aktivt inhyrt ingår i den effektiva totalen (counts innehåller inhyrt).
  select coalesce(sum(quantity), 0) into v_borrowed
    from borrowed_material
    where material_id = p_material_id and deleted_at is null;

  v_effective := p_new_total + v_borrowed;

  -- Summa av allt öronmärkt (exkl. 'okänd').
  select coalesce(sum(count), 0) into v_allocated
    from material_counts
    where material_id = p_material_id and status <> 'okänd';

  -- 030-fix: aggregat → 0 (inte NULL) när 'okänd'-raden saknas.
  select coalesce(sum(count), 0) into v_prev_okand
    from material_counts
    where material_id = p_material_id and status = 'okänd';

  -- Effektiva totalen får inte underskrida det redan fördelade.
  if v_effective < v_allocated then
    raise exception 'totalen (% eget + % inhyrt) kan inte vara mindre än redan fördelat (%) — flytta tillbaka antal först',
      p_new_total, v_borrowed, v_allocated using errcode = '23514';
  end if;

  update materials_v2 set total_count = p_new_total where id = p_material_id;

  v_new_okand := v_effective - v_allocated;

  if v_new_okand <> v_prev_okand then
    if exists (select 1 from material_counts
                 where material_id = p_material_id and status = 'okänd') then
      update material_counts
        set count = v_new_okand, updated_at = now()
        where material_id = p_material_id and status = 'okänd';
    else
      insert into material_counts (material_id, status, count)
        values (p_material_id, 'okänd', v_new_okand);
    end if;

    insert into material_history
      (material_id, old_status, new_status, count_change, changed_by, comment)
      values
      (p_material_id, null, 'okänd', v_new_okand - v_prev_okand, v_user,
       'Totalt antal ändrat — avstämt mot Okänd');
  end if;
end;
$$;

-- ---- GRANTS ----
revoke all on function add_borrowed(bigint, integer, text, date, date, text, text) from public;
grant execute on function add_borrowed(bigint, integer, text, date, date, text, text) to authenticated;
revoke all on function remove_borrowed(bigint) from public;
grant execute on function remove_borrowed(bigint) to authenticated;
revoke all on function set_total_count(bigint, integer) from public;
grant execute on function set_total_count(bigint, integer) to authenticated;

-- ============================================================
-- ENGÅNGS-FOLD: befintligt inhyrt in i tillgänglig
-- ============================================================
-- Material som har aktivt inhyrt men ännu inte fått inhyrt infällt i counts.
-- Idempotent via markör-historikrad — om-körning gör inget andra gången.
do $$
declare
  r record;
  v_borrowed integer;
  v_avail    integer;
  c_marker   constant text := 'Migration 031: inhyrt infällt i Tillgänglig';
begin
  for r in
    select distinct b.material_id
      from borrowed_material b
      join materials_v2 m on m.id = b.material_id
      where b.deleted_at is null
        and m.is_article_based = false
        and not exists (
          select 1 from material_history h
          where h.material_id = b.material_id and h.comment = c_marker
        )
  loop
    select coalesce(sum(quantity), 0) into v_borrowed
      from borrowed_material
      where material_id = r.material_id and deleted_at is null;

    if v_borrowed <= 0 then
      continue;
    end if;

    select count into v_avail
      from material_counts
      where material_id = r.material_id and status = 'tillgänglig';
    if v_avail is null then
      insert into material_counts (material_id, status, count)
        values (r.material_id, 'tillgänglig', v_borrowed);
    else
      update material_counts
        set count = v_avail + v_borrowed, updated_at = now()
        where material_id = r.material_id and status = 'tillgänglig';
    end if;

    insert into material_history
      (material_id, old_status, new_status, count_change, changed_by, comment)
      values
      (r.material_id, null, 'tillgänglig', v_borrowed, 'system', c_marker);
  end loop;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. GIGS Back Step: tillgänglig ska nu inkludera inhyrt:
--    select status, count from material_counts
--      where material_id = (select id from materials_v2
--                             where name = 'GIGS Back Step');
-- 2. Lägg till inhyrt via RPC (ökar tillgänglig):
--    select add_borrowed(<id>, 5, 'Testleverantör', current_date, null, null, null);
-- 3. Ta bort inhyrt (minskar tillgänglig; fel om för lite tillgängligt):
--    select remove_borrowed(<borrow_id>);
-- 4. Ändra eget total — okänd stäms av mot eget + inhyrt:
--    select set_total_count(<id>, 30);

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists add_borrowed(bigint, integer, text, date, date, text, text);
-- drop function if exists remove_borrowed(bigint);
-- (set_total_count: kör om 030 för att återställa den varianten.)
-- OBS: engångs-folden kan inte auto-rullas tillbaka — minska tillgänglig
-- manuellt med summan av aktivt inhyrt per material om du backar ut.
