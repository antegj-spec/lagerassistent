-- ============================================================
-- 019_seed_economy_2026.sql  (Fas 8 Etapp C)
-- Seed-data: alla utgifter från Utgifter 2026.xlsx (67 rader,
-- 8 kategorier, ~165 000 kr totalt).
--
-- Kör BARA en gång efter 018_economy.sql — annars dubblerar du
-- historiken. Vid behov rensa med:
--   delete from economy_entries where year = 2026 and created_by = 'Admin';
-- och kör om.
-- ============================================================

insert into economy_entries (category, year, title, price, comment, created_by) values
  ('lunchrum', 2026, 'Kök', 11116, 'Adexa', 'Admin'),
  ('lunchrum', 2026, 'Kyl/Frys', 11996, 'Elgiganten', 'Admin'),
  ('lunchrum', 2026, 'Köksblandare', 449, 'Biltema, kostade egenltligen 949kr', 'Admin'),
  ('lunchrum', 2026, 'Akustikpaneler', 2867, 'Kompositlagret', 'Admin'),
  ('lunchrum', 2026, 'Hylla', 100, 'SH', 'Admin'),
  ('lunchrum', 2026, 'Bänk till kaffemaskin', 350, 'SH', 'Admin'),
  ('lunchrum', 2026, 'Tavla till toalett', 125, 'SH', 'Admin'),
  ('lunchrum', 2026, 'Skåp till toalett', 400, 'SH', 'Admin'),
  ('lunchrum', 2026, 'Spegel', 75, 'SH', 'Admin'),
  ('lunchrum', 2026, 'Kök, övrigt', 500, 'Installation av blandare/avlopp, Biltema', 'Admin'),
  ('lunchrum', 2026, 'Tvål och papper', 665, 'Biltema', 'Admin'),
  ('lunchrum', 2026, 'Diskmaskin', 2236, 'Elgiganten', 'Admin'),
  ('lunchrum', 2026, 'Vatten/rör koppling', 750, NULL, 'Admin'),
  ('övrigt', 2026, 'Plåstertejp för lager/verktygscase', 160, NULL, 'Admin'),
  ('övrigt', 2026, 'Magnet för skyltning av stallage', 350, NULL, 'Admin'),
  ('övrigt', 2026, 'Bälte', 80, 'Jula', 'Admin'),
  ('övrigt', 2026, 'Skor, Andreas och Nicklas', 2359, NULL, 'Admin'),
  ('övrigt', 2026, 'Sulor till skor', 270, 'Apotek', 'Admin'),
  ('övrigt', 2026, 'Underställ till kalllager', 196, NULL, 'Admin'),
  ('övrigt', 2026, 'Termometer', 68, '6 st', 'Admin'),
  ('övrigt', 2026, 'Titthålskamera', 43, 'För inspektering och felsökning av knickmop/maskiner/ kolla in där man inte ser.', 'Admin'),
  ('övrigt', 2026, 'Djuphålspenna', 18, '4 st, ', 'Admin'),
  ('övrigt', 2026, 'Städvagn', 300, 'SH', 'Admin'),
  ('övrigt', 2026, 'Skyltning enligt ISO', 1516, 'Nödut, truckladdning, "blockera ej"', 'Admin'),
  ('övrigt', 2026, 'ISO + Kökstillbehör', 821, 'Jula', 'Admin'),
  ('övrigt', 2026, 'Snurra till batterivatten', 868.2, 'Saknar sen Mats flyttade', 'Admin'),
  ('övrigt', 2026, 'Lackering av verktygsvagn', 7750, 'RAL3020, Traffic Red, SQ Industrilackering', 'Admin'),
  ('övrigt', 2026, 'Lysrör till insektsdödare', 271.32, NULL, 'Admin'),
  ('övrigt', 2026, 'Robot förrukningsmaterial', 2777, NULL, 'Admin'),
  ('övrigt', 2026, 'Skrot-Anders', 35366, 'Vickerkulla skrotning…..', 'Admin'),
  ('övrigt', 2026, 'Städrobot', 19989, 'Hyra 260119-260531,  plus övrigt', 'Admin'),
  ('övrigt', 2026, 'Kaffemaskin', 6893, 'Hyra plus kaffe, ca 250kr/kg', 'Admin'),
  ('övrigt', 2026, 'Skrot-Anders', 3726, 'Kassera träskrot från gården.', 'Admin'),
  ('övrigt', 2026, 'Plastbackar', 6600, '3x32 st', 'Admin'),
  ('övrigt', 2026, 'Kaffe till kaffemaskin..', 3888, '12 kg, lev. Utan efterfrågan..', 'Admin'),
  ('vatten_tvätt', 2026, 'Vattenslang', 4570, '50m, Till golvtvätt, Swedol', 'Admin'),
  ('vatten_tvätt', 2026, 'Kopplingar, vatten', 2800, 'Hydroscand', 'Admin'),
  ('vatten_tvätt', 2026, '32A Kabel, 25m', 1990, NULL, 'Admin'),
  ('vatten_tvätt', 2026, 'Rulllist, 14st', 1050, 'För test vid tvätt av golv.', 'Admin'),
  ('vatten_tvätt', 2026, 'Handskar till tvätt', 2651, 'Handskar till tvätt', 'Admin'),
  ('vatten_tvätt', 2026, 'Rullbanor', 7200, NULL, 'Admin'),
  ('knickmop', 2026, 'Cam-lock vakuum-koppling', 700, 'Hydroscand', 'Admin'),
  ('knickmop', 2026, 'Smörjfett', 1404, 'Swedol', 'Admin'),
  ('knickmop', 2026, 'Kitta dollys', 2557.88, 'Jula', 'Admin'),
  ('knickmop', 2026, 'Gummilist, 20st', 4700, NULL, 'Admin'),
  ('knickmop', 2026, 'Vakuumslang 40m', 7656, '10m till vardera knickmop', 'Admin'),
  ('knickmop', 2026, 'Service, Nickbob1', 8044, 'Byte hydraulolja', 'Admin'),
  ('knickmop', 2026, 'Service', 5283.36, NULL, 'Admin'),
  ('knickmop', 2026, 'Service', 5283.36, NULL, 'Admin'),
  ('knickmop', 2026, 'Service', 5587.36, NULL, 'Admin'),
  ('knickmop', 2026, 'Vakuumpump Service', 11119, NULL, 'Admin'),
  ('verkstad_verktyg', 2026, 'Svets', 16500, 'ESAB Rustler EM 203C', 'Admin'),
  ('verkstad_verktyg', 2026, 'Alutråd, 7kg', 1600, NULL, 'Admin'),
  ('verkstad_verktyg', 2026, 'Vanlig tråd, 18kg', 729, NULL, 'Admin'),
  ('verkstad_verktyg', 2026, 'Gas, Argon', 5319, 'Jula 8L', 'Admin'),
  ('verkstad_verktyg', 2026, 'Gummiklubba', 244, '5 st, 225g', 'Admin'),
  ('lagerutbyggnad', 2026, 'Bärbalk P90 3400 mm, 28st beg.', 11900, 'Stallage för golfbilar', 'Admin'),
  ('lagerutbyggnad', 2026, 'Nätplan 42st beg.', 7203, 'Stallage för golfbilar', 'Admin'),
  ('lagerutbyggnad', 2026, 'Bärbalk EAB 2750, 8st beg.', 1652, 'Fler pallplatser', 'Admin'),
  ('lagerutbyggnad', 2026, 'Betsil', 12499.18, 'Betongförsegning för att minska damm', 'Admin'),
  ('lagerutbyggnad', 2026, 'Gavel P90, 5,5m', 6900, 'Stallage för golfbilar', 'Admin'),
  ('reparation', 2026, 'Damsugare', 656, 'Ny motor, FixPart.se', 'Admin'),
  ('reparation', 2026, 'Tvättmaskin', 256, 'Pump returnerad, satt fel del i tvättmaskin…', 'Admin'),
  ('reparation', 2026, 'Tvättmaskin', 215, 'Ny pump, FixPart.se', 'Admin'),
  ('reparation', 2026, 'Blå hjul', 1452, '5 Hjul med broms,  hjul utan. Industrihjul.se', 'Admin'),
  ('reparation', 2026, 'Epoxy', 1055.8, '7,5 kg, Lagning av betonggolv', 'Admin'),
  ('reparation', 2026, 'Spackel', 994, 'Lagning av betonggolv, Paintpro.se', 'Admin');

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- select category, count(*) as rader, sum(price) as total
--   from economy_entries
--   where year = 2026
--   group by category
--   order by total desc;
