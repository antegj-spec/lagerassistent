-- ============================================================
-- 026_car_trips_shared_update.sql  (Fas 8 — körjournal v2-fix)
-- Öppnar UPDATE på car_trips för alla inloggade.
--
-- BAKGRUND / BUGG:
--   Körjournalen är delad: en person inleder en resa, en annan avslutar
--   den. "Avsluta resa" är tekniskt en UPDATE (status='closed' + slut-km).
--   Den gamla policyn (017) tillät bara skaparen eller admin att UPDATE:a:
--       using (created_by = current_user_name() or is_admin())
--   Resultat: startade Admin resan kunde t.ex. Andreas inte avsluta den.
--   PostgREST uppdaterade 0 rader men svarade 204 No Content (inget fel),
--   så appen visade falskt "✓ Resa avslutad" medan resan stod kvar öppen.
--
--   Beslut: körjournalen är ett delat arbetsverktyg bland betrodd personal
--   — vem som helst som är inloggad ska kunna avsluta/redigera en resa.
--   created_by bevaras oförändrat som historik (vem som la in raden).
--
--   INSERT behålls som tidigare (created_by = current_user_name() — du
--   loggar som dig själv). DELETE behålls restriktivt (skapare eller admin)
--   eftersom radering är mer destruktiv.
--
-- IDEMPOTENT: kan köras flera gånger utan biverkningar.
-- ============================================================

drop policy if exists car_trips_update on car_trips;
create policy car_trips_update on car_trips
  for update to authenticated
  using (true)
  with check (true);

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select polname, pg_get_expr(polqual, polrelid) as using_expr
--   from pg_policy where polrelid = 'car_trips'::regclass and polname = 'car_trips_update';
-- -- using_expr ska vara "true"

-- ============================================================
-- ROLLBACK (återställ skapare/admin-begränsningen från 017)
-- ============================================================
-- drop policy if exists car_trips_update on car_trips;
-- create policy car_trips_update on car_trips
--   for update to authenticated
--   using (created_by = current_user_name() or is_admin())
--   with check (created_by = current_user_name() or is_admin());
