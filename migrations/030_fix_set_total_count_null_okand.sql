-- ============================================================
-- 030_fix_set_total_count_null_okand.sql
-- Fix: set_total_count() läckte data för material UTAN 'okänd'-rad.
--
-- Bakgrund: migration 029 hämtade föregående okänd-värde så här:
--     select coalesce(count, 0) into v_prev_okand
--       from material_counts where material_id = X and status = 'okänd';
-- coalesce(count, 0) skyddar bara mot NULL *i en rad*. Om materialet
-- inte har NÅGON 'okänd'-rad returnerar SELECT INTO noll rader och
-- v_prev_okand blir NULL (inte 0). Sedan:
--     if v_new_okand <> v_prev_okand   -- 7 <> NULL → NULL → FALSE
-- → hela avstämnings-blocket hoppas över. total_count sätts till 7 men
-- ingen 'okänd'-rad skapas. Resultat: total=7, alla statusar 0, inget
-- att flytta.
--
-- Drabbar t.ex. importerade material som kom in med total_count=0 utan
-- count-rad (se 024) — varje gång deras total höjs återskapas buggen,
-- vilket är varför 029:s engångsreparation inte räckte ("samma problem
-- igen").
--
-- Fix: använd ett aggregat (sum) så queryn alltid ger exakt en rad →
-- coalesce ger 0 när raden saknas. Speglar v_allocated-raden ovanför.
--
-- IDEMPOTENT — CREATE OR REPLACE. Kräver 029 (current_user_name m.m.).
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
  v_allocated   integer;
  v_prev_okand  integer;
  v_new_okand   integer;
begin
  -- ---- VALIDERING ----
  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;

  if p_new_total is null or p_new_total < 0 then
    raise exception 'totalen kan inte vara negativ' using errcode = '22023';
  end if;

  -- ---- LÅS materialraden + alla count-rader (race-skydd) ----
  perform 1 from materials_v2 where id = p_material_id for update;
  if not found then
    raise exception 'material % saknas', p_material_id using errcode = 'P0002';
  end if;

  perform 1 from material_counts where material_id = p_material_id for update;

  -- Summa av allt öronmärkt (exkl. 'okänd').
  select coalesce(sum(count), 0) into v_allocated
    from material_counts
    where material_id = p_material_id and status <> 'okänd';

  -- FIX (030): sum() är ett aggregat → alltid exakt en rad → 0 när
  -- 'okänd'-raden saknas. Tidigare gav SELECT INTO här NULL vid 0 rader.
  select coalesce(sum(count), 0) into v_prev_okand
    from material_counts
    where material_id = p_material_id and status = 'okänd';

  -- Totalen får inte underskrida det redan fördelade.
  if p_new_total < v_allocated then
    raise exception 'totalen (%) kan inte vara mindre än redan fördelat (%) — flytta tillbaka antal först',
      p_new_total, v_allocated using errcode = '23514';
  end if;

  -- ---- SÄTT TOTALEN ----
  update materials_v2 set total_count = p_new_total where id = p_material_id;

  -- ---- STÄM AV 'okänd' ----
  v_new_okand := p_new_total - v_allocated;

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

revoke all on function set_total_count(bigint, integer) from public;
grant execute on function set_total_count(bigint, integer) to authenticated;

-- ============================================================
-- ENGÅNGS-REPARATION av data som drabbades av NULL-buggen
-- ============================================================
-- Samma logik som 029:s reparation: total_count > summan av alla counts
-- betyder att ett glapp aldrig hamnade i någon status. Skjut glappet till
-- 'okänd'. Idempotent — rör bara count-baserade material med positivt glapp.
do $$
declare
  r record;
  v_gap integer;
begin
  for r in
    select m.id,
           m.total_count,
           coalesce(sum(c.count), 0) as sum_counts
      from materials_v2 m
      left join material_counts c on c.material_id = m.id
      where m.is_article_based = false
      group by m.id, m.total_count
      having m.total_count > coalesce(sum(c.count), 0)
  loop
    v_gap := r.total_count - r.sum_counts;

    if exists (select 1 from material_counts
                 where material_id = r.id and status = 'okänd') then
      update material_counts
        set count = count + v_gap, updated_at = now()
        where material_id = r.id and status = 'okänd';
    else
      insert into material_counts (material_id, status, count)
        values (r.id, 'okänd', v_gap);
    end if;

    insert into material_history
      (material_id, old_status, new_status, count_change, changed_by, comment)
      values
      (r.id, null, 'okänd', v_gap, 'system',
       'Engångsreparation: saknat antal återställt till Okänd (migration 030)');
  end loop;
end $$;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. Material utan okänd-rad, höj totalen — okänd ska nu fyllas:
--    select set_total_count(<id>, 7);
--    select status, count from material_counts where material_id = <id>;
--    -- okänd ska vara 7 (minus ev. öronmärkt).
--
-- 2. GIGS Mega MAG specifikt:
--    select status, count from material_counts
--      where material_id = (select id from materials_v2
--                             where name = 'GIGS Mega Cable Access Gate (Mega MAG)');

-- ============================================================
-- ROLLBACK
-- ============================================================
-- Återställ 029:s (buggiga) version genom att köra om 029_set_total_count.sql.
