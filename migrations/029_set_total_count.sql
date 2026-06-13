-- ============================================================
-- 029_set_total_count.sql  (Fix: atomiskt "Ändra total")
-- Sätter total_count för ett count-baserat material OCH stämmer av
-- mellanskillnaden mot status 'okänd' — i en enda transaktion.
--
-- Bakgrund: klient-flödet i saveTotal() gjorde två separata HTTP-anrop
-- efter varandra: först saveMat({ total_count }), sedan setMatCount('okänd').
-- Om anrop 1 lyckades men anrop 2 aldrig gick igenom (t.ex. mobil som
-- låser skärmen / byter app / tappar täckning mitt i sparandet, så att
-- bakgrunds-fetch:en avbryts) blev datan korrupt: totalen uppdaterad men
-- mellanskillnaden hamnade ingenstans → "saknat" antal som inte syns i
-- någon status. Den här funktionen gör båda stegen atomiskt så det aldrig
-- kan halv-spara.
--
-- Invariant (samma som saveTotal hade): allt UTOM 'okänd' är öronmärkt
-- (Tillgänglig/Uthyrd/Reserverad/Tvätt/Reparation). 'okänd' absorberar
-- mellanskillnaden mot totalen. Totalen får aldrig vara mindre än det
-- öronmärkta.
--
-- Funktionen kallas från klienten via PostgREST RPC:
--   POST /rest/v1/rpc/set_total_count
--   body: { p_material_id, p_new_total }
--
-- IDEMPOTENT — kan köras flera gånger (CREATE OR REPLACE).
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
  -- FOR UPDATE går inte ihop med aggregat, så vi låser raderna först med
  -- en PERFORM och summerar sedan i separata queries.
  perform 1 from materials_v2 where id = p_material_id for update;
  if not found then
    raise exception 'material % saknas', p_material_id using errcode = 'P0002';
  end if;

  perform 1 from material_counts where material_id = p_material_id for update;

  -- Summa av allt öronmärkt (exkl. 'okänd').
  select coalesce(sum(count), 0) into v_allocated
    from material_counts
    where material_id = p_material_id and status <> 'okänd';

  select coalesce(count, 0) into v_prev_okand
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
    -- v_prev_okand = 0 betyder antingen att raden saknas eller är 0.
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

-- SECURITY DEFINER → kör med ägarens rättigheter (bypassar RLS på
-- materials_v2/material_counts/material_history). current_user_name()-checken
-- ovan ser till att ingen anon kan kalla funktionen.
revoke all on function set_total_count(bigint, integer) from public;
grant execute on function set_total_count(bigint, integer) to authenticated;

-- ============================================================
-- ENGÅNGS-REPARATION av redan trasig data
-- ============================================================
-- Läker poster som drabbades av den gamla (icke-atomiska) buggen: total_count
-- uppdaterades men mellanskillnaden hamnade aldrig i någon status. Symptom:
-- total_count > summan av alla counts. Vi skjuter glappet till 'okänd'.
--
-- Endast count-baserade material. Idempotent: rör bara poster där det finns
-- ett positivt glapp, så att köra om migrationen gör inget andra gången.
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
       'Engångsreparation: saknat antal återställt till Okänd (migration 029)');
  end loop;
end $$;

-- ============================================================
-- VERIFIKATION — kör efter migration
-- ============================================================
-- 1. Hitta ett count-baserat material:
--    select id, name, total_count from materials_v2 where is_article_based = false limit 5;
--
-- 2. Sätt totalen — mellanskillnaden ska hamna i 'okänd':
--    select set_total_count(<id>, 12);
--    select status, count from material_counts where material_id = <id>;
--    -- okänd ska nu vara 12 minus summan av övriga statusar.
--
-- 3. Försök sätta totalen lägre än det fördelade — ska kasta exception:
--    select set_total_count(<id>, 0);  -- om något är öronmärkt
--
-- 4. Kolla history-spår:
--    select * from material_history where material_id = <id> order by created_at desc limit 3;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists set_total_count(bigint, integer);
