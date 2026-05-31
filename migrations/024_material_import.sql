-- ============================================================
-- 024_material_import.sql  (Material-ombyggnad: Excel-import)
--
-- Importerar 129 material fran Inventarie2025.xlsx som LAGERRAKNAT
-- material i st. Hela antalet placeras i status tillganglig.
--
-- Regler:
--  - Summeringsrader (eps Pro Ramp total red/white) hoppas over.
--  - GIGS-fliken -> category GIGS. Cable Cover AMS / Modular Cable
--    Cover System -> namn-prefix MCCS + category MCCS. Cable Cover
--    Red Line lamnas orord. Ovriga -> ingen kategori (NULL).
--  - article_number = artikelnummer (fritext, ej unikt, NULL om tomt).
--  - Namn-bara rader (utan antal) far total_count=0, ingen count-rad.
--
-- IDEMPOTENT: varje insert ar skyddad med NOT EXISTS pa name. Rader
-- som redan finns (samma namn) hoppas over - ingen overskrivning,
-- inga dubbletter. Kraver 023 (category/article_number-kolumner).
-- ============================================================

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Light Panel (pcs)', false, 'st', null, '1000247', 2351
where not exists (select 1 from materials_v2 where name = 'Arena Light Panel (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 2351 from materials_v2 m
where m.name = 'Arena Light Panel (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Light Ramp Bottom 2,10m', false, 'st', null, '1000249', 67
where not exists (select 1 from materials_v2 where name = 'Arena Light Ramp Bottom 2,10m');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 67 from materials_v2 m
where m.name = 'Arena Light Ramp Bottom 2,10m'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Light Ramp Bottom 3,08m', false, 'st', null, '1000248', 35
where not exists (select 1 from materials_v2 where name = 'Arena Light Ramp Bottom 3,08m');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 35 from materials_v2 m
where m.name = 'Arena Light Ramp Bottom 3,08m'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Light Ramp Top 2,10m', false, 'st', null, '1000251', 77
where not exists (select 1 from materials_v2 where name = 'Arena Light Ramp Top 2,10m');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 77 from materials_v2 m
where m.name = 'Arena Light Ramp Top 2,10m'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Light Ramp Top 3,08m', false, 'st', null, '1000250', 40
where not exists (select 1 from materials_v2 where name = 'Arena Light Ramp Top 3,08m');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 40 from materials_v2 m
where m.name = 'Arena Light Ramp Top 3,08m'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Panel (pcs)', false, 'st', null, '1000226', 760
where not exists (select 1 from materials_v2 where name = 'Arena Panel (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 760 from materials_v2 m
where m.name = 'Arena Panel (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Panel Ramp Bottom', false, 'st', null, '1000229', 19
where not exists (select 1 from materials_v2 where name = 'Arena Panel Ramp Bottom');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 19 from materials_v2 m
where m.name = 'Arena Panel Ramp Bottom'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Arena Panel Ramp Top', false, 'st', null, '1000231', 34
where not exists (select 1 from materials_v2 where name = 'Arena Panel Ramp Top');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 34 from materials_v2 m
where m.name = 'Arena Panel Ramp Top'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Armor Deck 1, white (pcs)', false, 'st', null, '1000217', 4705
where not exists (select 1 from materials_v2 where name = 'Armor Deck 1, white (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4705 from materials_v2 m
where m.name = 'Armor Deck 1, white (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Armor Deck 3, white (pcs)', false, 'st', null, '1000219', 5030
where not exists (select 1 from materials_v2 where name = 'Armor Deck 3, white (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 5030 from materials_v2 m
where m.name = 'Armor Deck 3, white (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Armor Deck Ramp, green, female', false, 'st', null, '1000222', 54
where not exists (select 1 from materials_v2 where name = 'Armor Deck Ramp, green, female');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 54 from materials_v2 m
where m.name = 'Armor Deck Ramp, green, female'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Armor Deck Ramp, green, male', false, 'st', null, '1000223', 48
where not exists (select 1 from materials_v2 where name = 'Armor Deck Ramp, green, male');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 48 from materials_v2 m
where m.name = 'Armor Deck Ramp, green, male'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Armor Deck Ramp, white, female', false, 'st', null, '1000220', 19
where not exists (select 1 from materials_v2 where name = 'Armor Deck Ramp, white, female');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 19 from materials_v2 m
where m.name = 'Armor Deck Ramp, white, female'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Armor Deck Ramp, white, male', false, 'st', null, '1000221', 15
where not exists (select 1 from materials_v2 where name = 'Armor Deck Ramp, white, male');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 15 from materials_v2 m
where m.name = 'Armor Deck Ramp, white, male'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS ADA Ramp female, red', false, 'st', 'MCCS', '1000694', 479
where not exists (select 1 from materials_v2 where name = 'MCCS ADA Ramp female, red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 479 from materials_v2 m
where m.name = 'MCCS ADA Ramp female, red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS ADA Ramp male, red', false, 'st', 'MCCS', '1000697', 463
where not exists (select 1 from materials_v2 where name = 'MCCS ADA Ramp male, red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 463 from materials_v2 m
where m.name = 'MCCS ADA Ramp male, red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS Center Section, 5-Channel, red/black', false, 'st', 'MCCS', '1000679', 676
where not exists (select 1 from materials_v2 where name = 'MCCS Center Section, 5-Channel, red/black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 676 from materials_v2 m
where m.name = 'MCCS Center Section, 5-Channel, red/black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS Intermediate Ramp female, red', false, 'st', 'MCCS', '1000690', 60
where not exists (select 1 from materials_v2 where name = 'MCCS Intermediate Ramp female, red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 60 from materials_v2 m
where m.name = 'MCCS Intermediate Ramp female, red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS Intermediate Ramp male, red', false, 'st', 'MCCS', '1000692', 60
where not exists (select 1 from materials_v2 where name = 'MCCS Intermediate Ramp male, red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 60 from materials_v2 m
where m.name = 'MCCS Intermediate Ramp male, red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS Ramp female', false, 'st', 'MCCS', '1000685', 10
where not exists (select 1 from materials_v2 where name = 'MCCS Ramp female');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 10 from materials_v2 m
where m.name = 'MCCS Ramp female'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS Ramp male', false, 'st', 'MCCS', '1000686', 0
where not exists (select 1 from materials_v2 where name = 'MCCS Ramp male');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Cable Cover Red Line, 5-Channel', false, 'st', null, '1000677', 442
where not exists (select 1 from materials_v2 where name = 'Cable Cover Red Line, 5-Channel');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 442 from materials_v2 m
where m.name = 'Cable Cover Red Line, 5-Channel'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'MCCS Center Section XXL, 3-Channel red/black', false, 'st', 'MCCS', '1000683', 90
where not exists (select 1 from materials_v2 where name = 'MCCS Center Section XXL, 3-Channel red/black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 90 from materials_v2 m
where m.name = 'MCCS Center Section XXL, 3-Channel red/black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Crowd Control Barrier C2 Medium (pcs) flat foot', false, 'st', null, '1000194', 475
where not exists (select 1 from materials_v2 where name = 'Crowd Control Barrier C2 Medium (pcs) flat foot');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 475 from materials_v2 m
where m.name = 'Crowd Control Barrier C2 Medium (pcs) flat foot'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Crowd Control Barrier C2 Standard (pcs) old', false, 'st', null, '1000195', 161
where not exists (select 1 from materials_v2 where name = 'Crowd Control Barrier C2 Standard (pcs) old');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 161 from materials_v2 m
where m.name = 'Crowd Control Barrier C2 Standard (pcs) old'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps Pro Ramp, female, red', false, 'st', null, '1000346', 618
where not exists (select 1 from materials_v2 where name = 'eps Pro Ramp, female, red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 618 from materials_v2 m
where m.name = 'eps Pro Ramp, female, red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps Pro Ramp, female, white', false, 'st', null, '1001319', 226
where not exists (select 1 from materials_v2 where name = 'eps Pro Ramp, female, white');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 226 from materials_v2 m
where m.name = 'eps Pro Ramp, female, white'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps Pro Ramp, male, red', false, 'st', null, '1000347', 800
where not exists (select 1 from materials_v2 where name = 'eps Pro Ramp, male, red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 800 from materials_v2 m
where m.name = 'eps Pro Ramp, male, red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps Pro Ramp, male, white', false, 'st', null, '1001320', 408
where not exists (select 1 from materials_v2 where name = 'eps Pro Ramp, male, white');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 408 from materials_v2 m
where m.name = 'eps Pro Ramp, male, white'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps PRO Ramp ADA, White', false, 'st', null, null, 97
where not exists (select 1 from materials_v2 where name = 'eps PRO Ramp ADA, White');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 97 from materials_v2 m
where m.name = 'eps PRO Ramp ADA, White'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps PRO Ramp ADA, Red', false, 'st', null, null, 495
where not exists (select 1 from materials_v2 where name = 'eps PRO Ramp ADA, Red');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 495 from materials_v2 m
where m.name = 'eps PRO Ramp ADA, Red'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'eps Pro, white (pcs)  12600sqm =', false, 'st', null, '1000337', 5040
where not exists (select 1 from materials_v2 where name = 'eps Pro, white (pcs)  12600sqm =');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 5040 from materials_v2 m
where m.name = 'eps Pro, white (pcs)  12600sqm ='
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'I-Trac (pcs)', false, 'st', null, '1001764', 714
where not exists (select 1 from materials_v2 where name = 'I-Trac (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 714 from materials_v2 m
where m.name = 'I-Trac (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'I-Trac, long female', false, 'st', null, '1002031', 12
where not exists (select 1 from materials_v2 where name = 'I-Trac, long female');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 12 from materials_v2 m
where m.name = 'I-Trac, long female'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'I-Trac, long male', false, 'st', null, '1002032', 12
where not exists (select 1 from materials_v2 where name = 'I-Trac, long male');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 12 from materials_v2 m
where m.name = 'I-Trac, long male'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'I-Trac, short female', false, 'st', null, '1002034', 22
where not exists (select 1 from materials_v2 where name = 'I-Trac, short female');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 22 from materials_v2 m
where m.name = 'I-Trac, short female'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'I-Trac, short male', false, 'st', null, '1002035', 22
where not exists (select 1 from materials_v2 where name = 'I-Trac, short male');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 22 from materials_v2 m
where m.name = 'I-Trac, short male'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Folding Chair Big Boy, B1, black', false, 'st', null, '1000412', 7055
where not exists (select 1 from materials_v2 where name = 'Folding Chair Big Boy, B1, black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 7055 from materials_v2 m
where m.name = 'Folding Chair Big Boy, B1, black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Hexagon 1/2, grey, bottom', false, 'st', null, '1000279', 179
where not exists (select 1 from materials_v2 where name = 'Hexagon 1/2, grey, bottom');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 179 from materials_v2 m
where m.name = 'Hexagon 1/2, grey, bottom'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Hexagon 1/2, grey, top', false, 'st', null, '1000278', 180
where not exists (select 1 from materials_v2 where name = 'Hexagon 1/2, grey, top');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 180 from materials_v2 m
where m.name = 'Hexagon 1/2, grey, top'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Hexagon, grey (pcs) 1148sqm 4251pc', false, 'st', null, '1000276', 10577
where not exists (select 1 from materials_v2 where name = 'Hexagon, grey (pcs) 1148sqm 4251pc');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 10577 from materials_v2 m
where m.name = 'Hexagon, grey (pcs) 1148sqm 4251pc'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'LD 20 Roll (pcs)', false, 'st', null, '1000284', 17
where not exists (select 1 from materials_v2 where name = 'LD 20 Roll (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 17 from materials_v2 m
where m.name = 'LD 20 Roll (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Police Barrier 2,00m, heavy duty (pcs)', false, 'st', null, '1000205', 342
where not exists (select 1 from materials_v2 where name = 'Police Barrier 2,00m, heavy duty (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 342 from materials_v2 m
where m.name = 'Police Barrier 2,00m, heavy duty (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Remopla, 1,20 x 0,80m, blue (pcs)', false, 'st', null, null, 570
where not exists (select 1 from materials_v2 where name = 'Remopla, 1,20 x 0,80m, blue (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 570 from materials_v2 m
where m.name = 'Remopla, 1,20 x 0,80m, blue (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Remopla, 1,20 x 0,80m, grey (pcs)', false, 'st', null, '1000299', 3900
where not exists (select 1 from materials_v2 where name = 'Remopla, 1,20 x 0,80m, grey (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 3900 from materials_v2 m
where m.name = 'Remopla, 1,20 x 0,80m, grey (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Remopla 0,80 x 0,60m, grey (pcs)', false, 'st', null, '1000301', 377
where not exists (select 1 from materials_v2 where name = 'Remopla 0,80 x 0,60m, grey (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 377 from materials_v2 m
where m.name = 'Remopla 0,80 x 0,60m, grey (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Universal Ramp Panels 1,00m, PVC', false, 'st', null, '1000319', 380
where not exists (select 1 from materials_v2 where name = 'Universal Ramp Panels 1,00m, PVC');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 380 from materials_v2 m
where m.name = 'Universal Ramp Panels 1,00m, PVC'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Universal Ramp Panels 2,15m', false, 'st', null, '1000317', 0
where not exists (select 1 from materials_v2 where name = 'Universal Ramp Panels 2,15m');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Universal Ramp Panels 3,00m', false, 'st', null, '1000316', 37
where not exists (select 1 from materials_v2 where name = 'Universal Ramp Panels 3,00m');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 37 from materials_v2 m
where m.name = 'Universal Ramp Panels 3,00m'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Vaccum Truck Knickmob', false, 'st', null, '1001332', 4
where not exists (select 1 from materials_v2 where name = 'Vaccum Truck Knickmob');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'Vaccum Truck Knickmob'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Easy Mat pcs', false, 'st', null, '1000265', 646
where not exists (select 1 from materials_v2 where name = 'Easy Mat pcs');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 646 from materials_v2 m
where m.name = 'Easy Mat pcs'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Easy Mat Markskydd', false, 'st', null, null, 105
where not exists (select 1 from materials_v2 where name = 'Easy Mat Markskydd');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 105 from materials_v2 m
where m.name = 'Easy Mat Markskydd'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'NSS Bar Barrikad', false, 'st', null, null, 179
where not exists (select 1 from materials_v2 where name = 'NSS Bar Barrikad');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 179 from materials_v2 m
where m.name = 'NSS Bar Barrikad'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Klaffbord, grå', false, 'st', null, null, 65
where not exists (select 1 from materials_v2 where name = 'Klaffbord, grå');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 65 from materials_v2 m
where m.name = 'Klaffbord, grå'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Golfbil 2 seat', false, 'st', null, null, 11
where not exists (select 1 from materials_v2 where name = 'Golfbil 2 seat');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 11 from materials_v2 m
where m.name = 'Golfbil 2 seat'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Golfbil 4 seat', false, 'st', null, null, 4
where not exists (select 1 from materials_v2 where name = 'Golfbil 4 seat');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'Golfbil 4 seat'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'EM Grå Transition', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'EM Grå Transition');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Kravall bult', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Kravall bult');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Tält', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Tält');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Maskiner, mutterknack, vinkel', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Maskiner, mutterknack, vinkel');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Bult och verktyg', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Bult och verktyg');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Pipes ''N Drapes', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Pipes ''N Drapes');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Dragvagn OLD', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Dragvagn OLD');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Dragvagn', false, 'st', null, null, 0
where not exists (select 1 from materials_v2 where name = 'Dragvagn');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Back Step', false, 'st', 'GIGS', '1000063', 26
where not exists (select 1 from materials_v2 where name = 'GIGS Back Step');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 26 from materials_v2 m
where m.name = 'GIGS Back Step'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Back Step, black', false, 'st', 'GIGS', null, 4
where not exists (select 1 from materials_v2 where name = 'GIGS Back Step, black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Back Step, black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Barrier Straight (pcs)', false, 'st', 'GIGS', '1000002', 1081
where not exists (select 1 from materials_v2 where name = 'GIGS Barrier Straight (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 1081 from materials_v2 m
where m.name = 'GIGS Barrier Straight (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Barrier Straight, black (pcs)', false, 'st', 'GIGS', '1000003', 324
where not exists (select 1 from materials_v2 where name = 'GIGS Barrier Straight, black (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 324 from materials_v2 m
where m.name = 'GIGS Barrier Straight, black (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Barrier Straight Flatfoot, black (pcs)', false, 'st', 'GIGS', '1000003', 10
where not exists (select 1 from materials_v2 where name = 'GIGS Barrier Straight Flatfoot, black (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 10 from materials_v2 m
where m.name = 'GIGS Barrier Straight Flatfoot, black (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Barrier Straight 0,5m (pcs)', false, 'st', 'GIGS', null, 7
where not exists (select 1 from materials_v2 where name = 'GIGS Barrier Straight 0,5m (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 7 from materials_v2 m
where m.name = 'GIGS Barrier Straight 0,5m (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Barrier Straight 0,5, black (pcs)', false, 'st', 'GIGS', null, 4
where not exists (select 1 from materials_v2 where name = 'GIGS Barrier Straight 0,5, black (pcs)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Barrier Straight 0,5, black (pcs)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Bartop', false, 'st', 'GIGS', '1000055', 60
where not exists (select 1 from materials_v2 where name = 'GIGS Bartop');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 60 from materials_v2 m
where m.name = 'GIGS Bartop'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Cable Access ( Multicore)', false, 'st', 'GIGS', '1000014', 26
where not exists (select 1 from materials_v2 where name = 'GIGS Cable Access ( Multicore)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 26 from materials_v2 m
where m.name = 'GIGS Cable Access ( Multicore)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Cable Access ( Multicore)  BLACK', false, 'st', 'GIGS', '1000014', 4
where not exists (select 1 from materials_v2 where name = 'GIGS Cable Access ( Multicore)  BLACK');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Cable Access ( Multicore)  BLACK'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Cable Access 0,54m', false, 'st', 'GIGS', '1000016', 4
where not exists (select 1 from materials_v2 where name = 'GIGS Cable Access 0,54m');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Cable Access 0,54m'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Cable Access 0,54m, black', false, 'st', 'GIGS', '1000017', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Cable Access 0,54m, black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Cable Access Gate  ( MAG)', false, 'st', 'GIGS', '1000019', 33
where not exists (select 1 from materials_v2 where name = 'GIGS Cable Access Gate  ( MAG)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 33 from materials_v2 m
where m.name = 'GIGS Cable Access Gate  ( MAG)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Cable Access Gate ,Black MAG', false, 'st', 'GIGS', '1000020', 17
where not exists (select 1 from materials_v2 where name = 'GIGS Cable Access Gate ,Black MAG');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 17 from materials_v2 m
where m.name = 'GIGS Cable Access Gate ,Black MAG'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Dollie Double', false, 'st', 'GIGS', '1000089', 6
where not exists (select 1 from materials_v2 where name = 'GIGS Dollie Double');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 6 from materials_v2 m
where m.name = 'GIGS Dollie Double'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Dollie for 10pcs.', false, 'st', 'GIGS', '1000079', 167
where not exists (select 1 from materials_v2 where name = 'GIGS Dollie for 10pcs.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 167 from materials_v2 m
where m.name = 'GIGS Dollie for 10pcs.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Dollie for 10pcs OLD', false, 'st', 'GIGS', null, 20
where not exists (select 1 from materials_v2 where name = 'GIGS Dollie for 10pcs OLD');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 20 from materials_v2 m
where m.name = 'GIGS Dollie for 10pcs OLD'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Dollie for 6 pcs.', false, 'st', 'GIGS', '1000084', 46
where not exists (select 1 from materials_v2 where name = 'GIGS Dollie for 6 pcs.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 46 from materials_v2 m
where m.name = 'GIGS Dollie for 6 pcs.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Klubbvagn', false, 'st', 'GIGS', null, 14
where not exists (select 1 from materials_v2 where name = 'GIGS Klubbvagn');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 14 from materials_v2 m
where m.name = 'GIGS Klubbvagn'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Emergency Gate', false, 'st', 'GIGS', '1000010', 10
where not exists (select 1 from materials_v2 where name = 'GIGS Emergency Gate');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 10 from materials_v2 m
where m.name = 'GIGS Emergency Gate'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Emergency Gate, black', false, 'st', 'GIGS', '1000011', 10
where not exists (select 1 from materials_v2 where name = 'GIGS Emergency Gate, black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 10 from materials_v2 m
where m.name = 'GIGS Emergency Gate, black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Flex', false, 'st', 'GIGS', '1000035', 38
where not exists (select 1 from materials_v2 where name = 'GIGS Flex');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 38 from materials_v2 m
where m.name = 'GIGS Flex'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Flex, black', false, 'st', 'GIGS', '1000036', 21
where not exists (select 1 from materials_v2 where name = 'GIGS Flex, black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 21 from materials_v2 m
where m.name = 'GIGS Flex, black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 22,5 deg.', false, 'st', 'GIGS', '1000051', 8
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 22,5 deg.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 8 from materials_v2 m
where m.name = 'GIGS Inside Corner, 22,5 deg.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 22,5 deg., black', false, 'st', 'GIGS', '1000052', 6
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 22,5 deg., black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 6 from materials_v2 m
where m.name = 'GIGS Inside Corner, 22,5 deg., black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 45 deg.', false, 'st', 'GIGS', '1000049', 12
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 45 deg.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 12 from materials_v2 m
where m.name = 'GIGS Inside Corner, 45 deg.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 45 deg., black', false, 'st', 'GIGS', '1000050', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 45 deg., black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 5 deg.', false, 'st', 'GIGS', '1000053', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 5 deg.');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 5 deg., black', false, 'st', 'GIGS', '1000054', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 5 deg., black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 90 deg.', false, 'st', 'GIGS', '1000046', 12
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 90 deg.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 12 from materials_v2 m
where m.name = 'GIGS Inside Corner, 90 deg.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Inside Corner, 90 deg., black', false, 'st', 'GIGS', '1000047', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Inside Corner, 90 deg., black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Level Piece', false, 'st', 'GIGS', '1000072', 27
where not exists (select 1 from materials_v2 where name = 'GIGS Level Piece');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 27 from materials_v2 m
where m.name = 'GIGS Level Piece'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Level Piece Black', false, 'st', 'GIGS', null, 11
where not exists (select 1 from materials_v2 where name = 'GIGS Level Piece Black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 11 from materials_v2 m
where m.name = 'GIGS Level Piece Black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Line Up Double Gate Centre Piece', false, 'st', 'GIGS', '1000113', 6
where not exists (select 1 from materials_v2 where name = 'GIGS Line Up Double Gate Centre Piece');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 6 from materials_v2 m
where m.name = 'GIGS Line Up Double Gate Centre Piece'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Line Up Double Gate with door', false, 'st', 'GIGS', '1000111', 6
where not exists (select 1 from materials_v2 where name = 'GIGS Line Up Double Gate with door');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 6 from materials_v2 m
where m.name = 'GIGS Line Up Double Gate with door'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Line Up Gate Connector 25%', false, 'st', 'GIGS', '1000115', 10
where not exists (select 1 from materials_v2 where name = 'GIGS Line Up Gate Connector 25%');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 10 from materials_v2 m
where m.name = 'GIGS Line Up Gate Connector 25%'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Line Up Gate Connector 50%', false, 'st', 'GIGS', '1000117', 65
where not exists (select 1 from materials_v2 where name = 'GIGS Line Up Gate Connector 50%');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 65 from materials_v2 m
where m.name = 'GIGS Line Up Gate Connector 50%'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Line Up Gate long', false, 'st', 'GIGS', '1000103', 4
where not exists (select 1 from materials_v2 where name = 'GIGS Line Up Gate long');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Line Up Gate long'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Mega Cable Access Gate (Mega MAG)', false, 'st', 'GIGS', '1001300', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Mega Cable Access Gate (Mega MAG)');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Mega Cable Access Gate (Mega MAG), black', false, 'st', 'GIGS', '1000022', 9
where not exists (select 1 from materials_v2 where name = 'GIGS Mega Cable Access Gate (Mega MAG), black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 9 from materials_v2 m
where m.name = 'GIGS Mega Cable Access Gate (Mega MAG), black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 22,5 deg.', false, 'st', 'GIGS', '1000041', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 22,5 deg.');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 22,5 deg., black', false, 'st', 'GIGS', '1000042', 6
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 22,5 deg., black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 6 from materials_v2 m
where m.name = 'GIGS Outside Corner, 22,5 deg., black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 45 deg.', false, 'st', 'GIGS', '1000039', 12
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 45 deg.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 12 from materials_v2 m
where m.name = 'GIGS Outside Corner, 45 deg.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 45 deg., black', false, 'st', 'GIGS', '1000040', 14
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 45 deg., black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 14 from materials_v2 m
where m.name = 'GIGS Outside Corner, 45 deg., black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 5 deg.', false, 'st', 'GIGS', '1000044', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 5 deg.');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 5 deg., black', false, 'st', 'GIGS', '1000045', 19
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 5 deg., black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 19 from materials_v2 m
where m.name = 'GIGS Outside Corner, 5 deg., black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 90 deg.', false, 'st', 'GIGS', '1000037', 4
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 90 deg.');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Outside Corner, 90 deg.'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Outside Corner, 90 deg., black', false, 'st', 'GIGS', '1000038', 4
where not exists (select 1 from materials_v2 where name = 'GIGS Outside Corner, 90 deg., black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 4 from materials_v2 m
where m.name = 'GIGS Outside Corner, 90 deg., black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Service Access Gate (SAG)', false, 'st', 'GIGS', '1000029', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Service Access Gate (SAG)');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Service Access Gate (SAG), black', false, 'st', 'GIGS', '1000030', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Service Access Gate (SAG), black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Short Line Up Gate', false, 'st', 'GIGS', '1000107', 48
where not exists (select 1 from materials_v2 where name = 'GIGS Short Line Up Gate');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 48 from materials_v2 m
where m.name = 'GIGS Short Line Up Gate'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Short Line Up Gate, black', false, 'st', 'GIGS', '1000108', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Short Line Up Gate, black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Sight Kill 30= eps UK 8 since before', false, 'st', 'GIGS', '1000057', 34
where not exists (select 1 from materials_v2 where name = 'GIGS Sight Kill 30= eps UK 8 since before');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 34 from materials_v2 m
where m.name = 'GIGS Sight Kill 30= eps UK 8 since before'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS T-Barricade', false, 'st', 'GIGS', '1000031', 2
where not exists (select 1 from materials_v2 where name = 'GIGS T-Barricade');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 2 from materials_v2 m
where m.name = 'GIGS T-Barricade'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS T-Barricade, black', false, 'st', 'GIGS', '1000032', 0
where not exists (select 1 from materials_v2 where name = 'GIGS T-Barricade, black');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Truck Gate', false, 'st', 'GIGS', '1000007', 12
where not exists (select 1 from materials_v2 where name = 'GIGS Truck Gate');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 12 from materials_v2 m
where m.name = 'GIGS Truck Gate'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Vario', false, 'st', 'GIGS', '1000033', 124
where not exists (select 1 from materials_v2 where name = 'GIGS Vario');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 124 from materials_v2 m
where m.name = 'GIGS Vario'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Vario, black', false, 'st', 'GIGS', '1000034', 73
where not exists (select 1 from materials_v2 where name = 'GIGS Vario, black');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 73 from materials_v2 m
where m.name = 'GIGS Vario, black'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'GIGS Wheelchair Gate', false, 'st', 'GIGS', '1000109', 0
where not exists (select 1 from materials_v2 where name = 'GIGS Wheelchair Gate');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Boltcase 150 (300bult)', false, 'st', 'GIGS', '1000093', 2
where not exists (select 1 from materials_v2 where name = 'Boltcase 150 (300bult)');
insert into material_counts (material_id, status, count)
select m.id, 'tillgänglig', 2 from materials_v2 m
where m.name = 'Boltcase 150 (300bult)'
  and not exists (select 1 from material_counts c where c.material_id = m.id and c.status = 'tillgänglig');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Boltcase 50 (100Bult)', false, 'st', 'GIGS', null, 0
where not exists (select 1 from materials_v2 where name = 'Boltcase 50 (100Bult)');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Bulthink, 150 bult', false, 'st', 'GIGS', null, 0
where not exists (select 1 from materials_v2 where name = 'Bulthink, 150 bult');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Bult lösa', false, 'st', 'GIGS', null, 0
where not exists (select 1 from materials_v2 where name = 'Bult lösa');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Mega MC Räkna', false, 'st', 'GIGS', null, 0
where not exists (select 1 from materials_v2 where name = 'Mega MC Räkna');

insert into materials_v2 (name, is_article_based, unit, category, article_number, total_count)
select 'Skivvagn för GIGS', false, 'st', 'GIGS', null, 0
where not exists (select 1 from materials_v2 where name = 'Skivvagn för GIGS');

-- Ladda om PostgREST schema-cache.
notify pgrst, 'reload schema';
