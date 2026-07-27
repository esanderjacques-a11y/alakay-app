-- Expand crops catalog for analysis + calculator demanda matching.
-- Demanda coefficients already live in sf_crop_extraction (Tabla N.° 5).

update public.sf_crop_extraction
set match_patterns = array['frejoles','frejol','frijol','frijoles','habichuela','beans','bean']
where crop_key = 'frejoles';

update public.sf_crop_extraction
set match_patterns = array['palma aceitera','palma','rff','oil palm']
where crop_key = 'palma_aceitera';

insert into public.crops (crop_id, crop_name, scientific_name, category, crop_type, is_system)
values
  (11, 'Lettuce', 'Lactuca sativa', 'Vegetable', 'annual', true),
  (12, 'Sunflower', 'Helianthus annuus', 'Oilseed', 'annual', true),
  (13, 'Mango', 'Mangifera indica', 'Fruit', 'perennial', true),
  (14, 'Passion Fruit', 'Passiflora edulis', 'Fruit', 'perennial', true),
  (15, 'Oil Palm', 'Elaeis guineensis', 'Oilseed', 'perennial', true),
  (16, 'Cucumber', 'Cucumis sativus', 'Vegetable', 'annual', true),
  (17, 'Watermelon', 'Citrullus lanatus', 'Vegetable', 'annual', true),
  (18, 'Soybean', 'Glycine max', 'Legume', 'annual', true),
  (19, 'Tomato', 'Solanum lycopersicum', 'Vegetable', 'annual', true),
  (20, 'Carrot', 'Daucus carota', 'Vegetable', 'annual', true),
  (21, 'Wheat', 'Triticum aestivum', 'Cereal', 'annual', true),
  (22, 'Sweet Potato', 'Ipomoea batatas', 'Root', 'annual', true),
  (23, 'Rice', 'Oryza sativa', 'Cereal', 'annual', true),
  (24, 'Coffee', 'Coffea arabica', 'Perennial', 'perennial', true),
  (25, 'Sugarcane', 'Saccharum officinarum', 'Perennial', 'perennial', true),
  (26, 'Coconut', 'Cocos nucifera', 'Perennial', 'perennial', true)
on conflict (crop_id) do update set
  crop_name = excluded.crop_name,
  scientific_name = excluded.scientific_name,
  category = excluded.category,
  crop_type = excluded.crop_type,
  is_system = excluded.is_system;

delete from public.crop_aliases where crop_id between 11 and 26;

insert into public.crop_aliases (alias_id, crop_id, language, alias_name, alias_type, priority)
values
  (70, 11, 'en', 'Lettuce', 'common', 1),
  (71, 11, 'es', 'Lechuga', 'common', 1),
  (72, 11, 'fr', 'Laitue', 'common', 1),
  (73, 11, 'ht', 'Leti', 'common', 1),
  (74, 11, 'sci', 'Lactuca sativa', 'scientific', 1),
  (75, 12, 'en', 'Sunflower', 'common', 1),
  (76, 12, 'es', 'Girasol', 'common', 1),
  (77, 12, 'fr', 'Tournesol', 'common', 1),
  (78, 12, 'ht', 'Touwosol', 'common', 1),
  (79, 12, 'sci', 'Helianthus annuus', 'scientific', 1),
  (80, 13, 'en', 'Mango', 'common', 1),
  (81, 13, 'es', 'Mango', 'common', 1),
  (82, 13, 'fr', 'Mangue', 'common', 1),
  (83, 13, 'ht', 'Mango', 'common', 1),
  (84, 13, 'sci', 'Mangifera indica', 'scientific', 1),
  (85, 14, 'en', 'Passion Fruit', 'common', 1),
  (86, 14, 'en', 'Passionfruit', 'common', 2),
  (87, 14, 'es', 'Maracuyá', 'common', 1),
  (88, 14, 'es', 'Maracuya', 'common', 2),
  (89, 14, 'fr', 'Fruit de la passion', 'common', 1),
  (90, 14, 'ht', 'Grenadia', 'common', 1),
  (91, 14, 'sci', 'Passiflora edulis', 'scientific', 1),
  (92, 15, 'en', 'Oil Palm', 'common', 1),
  (93, 15, 'en', 'Palm', 'common', 2),
  (94, 15, 'es', 'Palma', 'common', 1),
  (95, 15, 'es', 'Palma aceitera', 'common', 2),
  (96, 15, 'fr', 'Palmier à huile', 'common', 1),
  (97, 15, 'ht', 'Palmis', 'common', 1),
  (98, 15, 'sci', 'Elaeis guineensis', 'scientific', 1),
  (99, 16, 'en', 'Cucumber', 'common', 1),
  (100, 16, 'es', 'Pepino', 'common', 1),
  (101, 16, 'fr', 'Concombre', 'common', 1),
  (102, 16, 'ht', 'Konkonm', 'common', 1),
  (103, 16, 'sci', 'Cucumis sativus', 'scientific', 1),
  (104, 17, 'en', 'Watermelon', 'common', 1),
  (105, 17, 'es', 'Sandía', 'common', 1),
  (106, 17, 'es', 'Sandia', 'common', 2),
  (107, 17, 'fr', 'Pastèque', 'common', 1),
  (108, 17, 'ht', 'Melon dlo', 'common', 1),
  (109, 17, 'sci', 'Citrullus lanatus', 'scientific', 1),
  (110, 18, 'en', 'Soybean', 'common', 1),
  (111, 18, 'en', 'Soy', 'common', 2),
  (112, 18, 'es', 'Soya', 'common', 1),
  (113, 18, 'es', 'Soja', 'common', 2),
  (114, 18, 'fr', 'Soja', 'common', 1),
  (115, 18, 'ht', 'Soya', 'common', 1),
  (116, 18, 'sci', 'Glycine max', 'scientific', 1),
  (117, 19, 'en', 'Tomato', 'common', 1),
  (118, 19, 'es', 'Tomate', 'common', 1),
  (119, 19, 'fr', 'Tomate', 'common', 1),
  (120, 19, 'ht', 'Tomat', 'common', 1),
  (121, 19, 'sci', 'Solanum lycopersicum', 'scientific', 1),
  (122, 20, 'en', 'Carrot', 'common', 1),
  (123, 20, 'es', 'Zanahoria', 'common', 1),
  (124, 20, 'fr', 'Carotte', 'common', 1),
  (125, 20, 'ht', 'Kawòt', 'common', 1),
  (126, 20, 'sci', 'Daucus carota', 'scientific', 1),
  (127, 21, 'en', 'Wheat', 'common', 1),
  (128, 21, 'es', 'Trigo', 'common', 1),
  (129, 21, 'fr', 'Blé', 'common', 1),
  (130, 21, 'ht', 'Ble', 'common', 1),
  (131, 21, 'sci', 'Triticum aestivum', 'scientific', 1),
  (132, 22, 'en', 'Sweet Potato', 'common', 1),
  (133, 22, 'es', 'Batata', 'common', 1),
  (134, 22, 'es', 'Camote', 'common', 2),
  (135, 22, 'fr', 'Patate douce', 'common', 1),
  (136, 22, 'ht', 'Patat', 'common', 1),
  (137, 22, 'sci', 'Ipomoea batatas', 'scientific', 1),
  (138, 23, 'en', 'Rice', 'common', 1),
  (139, 23, 'es', 'Arroz', 'common', 1),
  (140, 23, 'fr', 'Riz', 'common', 1),
  (141, 23, 'ht', 'Diri', 'common', 1),
  (142, 23, 'sci', 'Oryza sativa', 'scientific', 1),
  (143, 24, 'en', 'Coffee', 'common', 1),
  (144, 24, 'es', 'Café', 'common', 1),
  (145, 24, 'es', 'Cafe', 'common', 2),
  (146, 24, 'fr', 'Café', 'common', 1),
  (147, 24, 'ht', 'Kafe', 'common', 1),
  (148, 24, 'sci', 'Coffea arabica', 'scientific', 1),
  (149, 25, 'en', 'Sugarcane', 'common', 1),
  (150, 25, 'en', 'Sugar cane', 'common', 2),
  (151, 25, 'es', 'Caña de azúcar', 'common', 1),
  (152, 25, 'es', 'Cana de azucar', 'common', 2),
  (153, 25, 'es', 'Caña', 'common', 3),
  (154, 25, 'fr', 'Canne à sucre', 'common', 1),
  (155, 25, 'ht', 'Kann', 'common', 1),
  (156, 25, 'sci', 'Saccharum officinarum', 'scientific', 1),
  (157, 26, 'en', 'Coconut', 'common', 1),
  (158, 26, 'es', 'Coco', 'common', 1),
  (159, 26, 'fr', 'Coco', 'common', 1),
  (160, 26, 'ht', 'Kokoye', 'common', 1),
  (161, 26, 'sci', 'Cocos nucifera', 'scientific', 1);

delete from public.crop_parameter_ranges where crop_id between 11 and 26;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  400 + row_number() over (order by c.crop_id, r.sample_type_id nulls first, r.parameter_id),
  c.crop_id,
  r.sample_type_id,
  r.parameter_id,
  r.unit_id,
  r.min,
  r.max,
  r.source_id,
  'low',
  true,
  r.active
from public.crops c
cross join public.crop_parameter_ranges r
where c.crop_id between 11 and 26
  and r.crop_id = 999;
