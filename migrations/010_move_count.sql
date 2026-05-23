-- ============================================================
-- 010_move_count.sql  (Fas 3, steg 3.1)
-- Atomic flytt av count mellan två statusar för ett count-baserat
-- material, plus history-log, inom en enda transaktion.
--
-- Ersätter klient-flödet i actions.ts (3 separata HTTP-anrop:
-- setMatCount(from, -qty), setMatCount(to, +qty), logMatHistory).
-- Om något av de stegen failade halvvägs blev datan korrupt
-- (negativ count, eller flytt utan log-spår).
--
-- Funktionen kallas från klienten via PostgREST RPC:
--   POST /rest/v1/rpc/move_count
--   body: { p_material_id, p_from_status, p_to_status, p_qty, p_comment }
--
-- IDEMPOTENT — kan köras flera gånger (CREATE OR REPLACE).
-- ============================================================

create or replace function move_count(
  p_material_id  bigint,
  p_from_status  text,
  p_to_status    text,
  p_qty          integer,
  p_comment      text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_from_count  integer;
  v_to_count    integer;
  v_user        text := current_user_name();
begin
  -- ---- VALIDERING ----
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty måste vara > 0' using errcode = '22023';
  end if;

  if p_from_status = p_to_status then
    raise exception 'från-status och till-status kan inte vara samma'
      using errcode = '22023';
  end if;

  if v_user = '' then
    raise exception 'ingen inloggad användare' using errcode = '42501';
  end if;

  -- ---- LÅS from-raden (FOR UPDATE) ----
  -- Förhindrar race: två parallella flyttar mot samma material+status
  -- får inte båda läsa "5" och båda dra av "3".
  select count into v_from_count
    from material_counts
    where material_id = p_material_id
      and status = p_from_status
    for update;

  if v_from_count is null then
    raise exception 'ingen rad i material_counts för material % status %',
      p_material_id, p_from_status
      using errcode = 'P0002';
  end if;

  if v_from_count < p_qty then
    raise exception 'försökte flytta % men det finns bara %', p_qty, v_from_count
      using errcode = '23514';
  end if;

  -- ---- LÅS till-raden ifall den finns (annars upserta nedan) ----
  select count into v_to_count
    from material_counts
    where material_id = p_material_id
      and status = p_to_status
    for update;

  -- ---- UPPDATERA from ----
  update material_counts
    set count = v_from_count - p_qty,
        updated_at = now()
    where material_id = p_material_id
      and status = p_from_status;

  -- ---- UPSERT to ----
  if v_to_count is null then
    insert into material_counts (material_id, status, count)
      values (p_material_id, p_to_status, p_qty);
  else
    update material_counts
      set count = v_to_count + p_qty,
          updated_at = now()
      where material_id = p_material_id
        and status = p_to_status;
  end if;

  -- ---- LOGGA ----
  insert into material_history
    (material_id, old_status, new_status, count_change, changed_by, comment)
    values
    (p_material_id, p_from_status, p_to_status, p_qty, v_user, p_comment);
end;
$$;

-- Tillåt alla inloggade att kalla funktionen — RLS på material_counts
-- och material_history skyddar fortfarande raderna (men eftersom funktionen
-- är SECURITY DEFINER kör den med ägarens rättigheter, så RLS bypass:as.
-- Validering av att användaren får göra detta sker via current_user_name()-
-- checken ovan: ingen anon kan kalla).
revoke all on function move_count(bigint, text, text, integer, text) from public;
grant execute on function move_count(bigint, text, text, integer, text) to authenticated;

-- ============================================================
-- VERIFIKATION — kör efter migration
-- ============================================================
-- 1. Hitta ett count-baserat material som har minst 1 tillgänglig:
--    select m.id, m.name, c.status, c.count
--      from materials_v2 m
--      join material_counts c on c.material_id = m.id
--      where m.is_article_based = false and c.count > 0
--      limit 5;
--
-- 2. Flytta 1 från tillgänglig → tvätt (byt id mot rad från ovan):
--    select move_count(<id>, 'tillgänglig', 'tvätt', 1, 'test efter migration');
--
-- 3. Kolla att counts stämmer:
--    select status, count from material_counts where material_id = <id>;
--
-- 4. Kolla att history har en rad:
--    select * from material_history where material_id = <id> order by created_at desc limit 3;
--
-- 5. Försök flytta mer än som finns — ska kasta exception:
--    select move_count(<id>, 'tillgänglig', 'tvätt', 9999, null);
--
-- 6. Flytta tillbaka för att städa:
--    select move_count(<id>, 'tvätt', 'tillgänglig', 1, 'cleanup');

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists move_count(bigint, text, text, integer, text);
