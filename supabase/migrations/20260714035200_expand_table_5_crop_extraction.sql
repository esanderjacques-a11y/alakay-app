-- Expand Tabla N.° 5 to the complete crop extraction dataset supplied for CULTOSOL.
-- Values are kg nutrient per tonne of harvested product; P, K, Ca and Mg are oxides.

alter table public.sf_crop_extraction
  add column if not exists yield_min_t_ha numeric,
  add column if not exists yield_max_t_ha numeric;

delete from public.sf_crop_extraction
where source_key = 'sue302_villasenor'
  and is_default = false;

insert into public.sf_crop_extraction (
  source_key, crop_key, label, match_patterns,
  n_kg_per_t, p2o5_kg_per_t, k2o_kg_per_t, cao_kg_per_t, mgo_kg_per_t,
  yield_min_t_ha, yield_max_t_ha, is_default, sort_order
)
values
  ('sue302_villasenor', 'maiz_ensilaje', 'Maíz ensilaje', array['maiz ensilaje','corn silage','maize silage','silage corn'], 3.9, 1.6, 2.5, 0.8, 0.4, 70, 90, false, 1),
  ('sue302_villasenor', 'tomate_industrial', 'Tomate industrial', array['tomate industrial','processing tomato'], 3.3, 0.8, 5, 0.8, 0.6, 45, 80, false, 2),
  ('sue302_villasenor', 'tomate_invernadero', 'Tomate invernadero', array['tomate invernadero','greenhouse tomato'], 3.3, 0.8, 5, 0.4, 0.4, 80, 200, false, 3),
  ('sue302_villasenor', 'frijol_negro', 'Frijol negro', array['frijol negro','black bean'], 19.5, 13, 39, 14.5, 9.8, 1.5, 3.5, false, 4),
  ('sue302_villasenor', 'frijol_rojo', 'Frijol rojo', array['frijol rojo','red bean'], 20.5, 13.5, 40.5, 15, 10, 1.5, 3.5, false, 5),
  ('sue302_villasenor', 'frijol_blanco', 'Frijol blanco', array['frijol blanco','white bean'], 20, 13.4, 39.5, 15, 10, 1.5, 3.5, false, 6),
  ('sue302_villasenor', 'frijol_mungo', 'Frijol mungo', array['frijol mungo','mung bean'], 18, 11.5, 30, 10, 7, 1, 2.5, false, 7),
  ('sue302_villasenor', 'caupi', 'Caupí (Frijol de ojo negro)', array['caupi','frijol de ojo negro','cowpea','black eyed pea'], 21, 12, 30, 8, 4, 1, 3, false, 8),
  ('sue302_villasenor', 'batata', 'Batata (Camote)', array['batata','camote','sweet potato'], 4.8, 1.8, 8.8, 1.2, 0.8, 15, 35, false, 9),
  ('sue302_villasenor', 'malanga', 'Malanga (Taro)', array['malanga','taro'], 3.6, 1.4, 6.1, 1.8, 1, 15, 35, false, 10),
  ('sue302_villasenor', 'coco', 'Coco (copra)', array['coco','copra','coconut'], 50, 16.5, 11.8, 3.5, 2.8, 1, 4, false, 11),
  ('sue302_villasenor', 'palma_aceitera', 'Palma aceitera (RFF)', array['palma aceitera','rff','oil palm'], 6, 2, 9.8, 2.6, 1.3, 15, 30, false, 12),
  ('sue302_villasenor', 'pepino', 'Pepino ensalada', array['pepino ensalada','pepino','cucumber'], 1.3, 0.8, 2.8, 0.6, 0.3, 40, 300, false, 13),
  ('sue302_villasenor', 'maiz_grano', 'Maíz grano', array['maiz grano','maiz','maize','corn'], 20, 6.9, 14, 4.5, 2.2, 12, 20, false, 14),
  ('sue302_villasenor', 'tomate_campo', 'Tomate campo', array['tomate campo','tomate','field tomato','tomato'], 3.3, 0.8, 5, 1.2, 0.6, 45, 80, false, 15),
  ('sue302_villasenor', 'frejoles', 'Frejoles', array['frejoles','frejol','frijol','habichuela','beans'], 20, 13.7, 40, 15, 10, 2, 4, false, 16),
  ('sue302_villasenor', 'naranja', 'Naranja', array['naranja','orange'], 2.7, 0.6, 4.2, 1.1, 0.6, 40, 70, false, 17),
  ('sue302_villasenor', 'limon', 'Limón', array['limon','lemon','lime'], 2.7, 0.6, 4.2, 1, 0.6, 40, 80, false, 18),
  ('sue302_villasenor', 'aguacate', 'Aguacate', array['aguacate','avocado','palta'], 6.2, 2.9, 18.2, 4.8, 2.5, 10, 15, false, 19),
  ('sue302_villasenor', 'papaya', 'Papaya', array['papaya'], 6, 2.3, 7, 3, 1.5, 15, 25, false, 20),
  ('sue302_villasenor', 'arandano', 'Arándano', array['arandano','blueberry'], 4.7, 0.8, 5.2, 2, 1.2, 10, 35, false, 21),
  ('sue302_villasenor', 'frambuesa', 'Frambuesa', array['frambuesa','raspberry'], 16.9, 3.6, 10.4, 8, 3.7, 8, 20, false, 22),
  ('sue302_villasenor', 'frutilla', 'Frutilla', array['frutilla','fresa','strawberry'], 2.5, 1.3, 4.5, 1.6, 0.9, 25, 60, false, 23),
  ('sue302_villasenor', 'papa', 'Papas', array['papas','papa','potato','patata'], 3.8, 1, 4, 1.6, 0.9, 25, 50, false, 24),
  ('sue302_villasenor', 'trigo', 'Trigo', array['trigo','wheat'], 24.3, 7.3, 24, 7, 4.3, 5, 9, false, 25),
  ('sue302_villasenor', 'cebada', 'Cebada', array['cebada','barley'], 22.2, 7.1, 22, 8.6, 5.4, 4, 7, false, 26),
  ('sue302_villasenor', 'avena', 'Avena', array['avena','oat','oats'], 22.2, 7.6, 20, 8.5, 5.4, 4, 7, false, 27),
  ('sue302_villasenor', 'arroz', 'Arroz', array['arroz','rice'], 21.4, 7.1, 27, 6.6, 4, 6, 9, false, 28),
  ('sue302_villasenor', 'girasol', 'Girasol', array['girasol','sunflower'], 34.5, 11, 37.4, 15, 8, 3, 4, false, 29),
  ('sue302_villasenor', 'cebolla', 'Cebolla', array['cebolla','onion'], 3.1, 1.2, 4, 1.6, 0.9, 25, 50, false, 30),
  ('sue302_villasenor', 'coliflor', 'Coliflor', array['coliflor','cauliflower'], 4.5, 1.4, 5, 2.7, 1.5, 15, 30, false, 31),
  ('sue302_villasenor', 'brocoli', 'Brócoli', array['brocoli','broccoli'], 4.5, 1.4, 5, 2.7, 1.5, 15, 30, false, 32),
  ('sue302_villasenor', 'sandia', 'Sandía', array['sandia','watermelon'], 3.5, 1.2, 4.5, 1.7, 0.9, 20, 50, false, 33),
  ('sue302_villasenor', 'melon', 'Melón', array['melon','cantaloupe'], 4.5, 1.6, 6.5, 1.3, 0.7, 25, 70, false, 34),
  ('sue302_villasenor', 'lechuga', 'Lechuga', array['lechuga','lettuce'], 2.7, 0.9, 4.5, 1.7, 1, 18, 50, false, 35),
  ('sue302_villasenor', 'arvejas', 'Arvejas', array['arvejas','arveja','guisantes','peas'], 8, 4.2, 8, 7.5, 3.8, 6, 10, false, 36),
  ('sue302_villasenor', 'zanahoria', 'Zanahoria', array['zanahoria','carrot'], 4, 1.4, 6.5, 2, 1, 25, 35, false, 37),
  ('sue302_villasenor', 'banano', 'Banano', array['banano','banana'], 1.9, 0.5, 5.4, 2.3, 3, 20, 60, false, 38),
  ('sue302_villasenor', 'platano', 'Plátano', array['platano','plantain'], 1.8, 0.5, 5, 2, 2.7, 15, 40, false, 39),
  ('sue302_villasenor', 'pina', 'Piña', array['pina','pineapple'], 0.7, 0.5, 2.8, 0.4, 0.2, 40, 90, false, 40),
  ('sue302_villasenor', 'yuca', 'Yuca', array['yuca','cassava','manioca'], 4, 2.9, 6.2, 2.8, 1.7, 15, 40, false, 41),
  ('sue302_villasenor', 'name', 'Ñame', array['name','yam'], 3.8, 1.8, 6.5, 1.9, 1.1, 12, 30, false, 42),
  ('sue302_villasenor', 'yautia', 'Yautía', array['yautia','tannia'], 3.5, 1.5, 6.3, 1.9, 1, 15, 30, false, 43),
  ('sue302_villasenor', 'cana_azucar', 'Caña de azúcar', array['cana de azucar','cana','sugarcane'], 0.8, 0.5, 1.4, 0.4, 0.2, 70, 150, false, 44),
  ('sue302_villasenor', 'cacao', 'Cacao', array['cacao','cocoa'], 10, 5, 23, 1.4, 1.7, 0.5, 2.5, false, 45),
  ('sue302_villasenor', 'cafe', 'Café', array['cafe','coffee'], 25, 6, 20.2, 1.4, 3.3, 0.8, 3.5, false, 46),
  ('sue302_villasenor', 'mango', 'Mango', array['mango'], 1.5, 0.5, 2.4, 0.8, 0.5, 8, 25, false, 47),
  ('sue302_villasenor', 'guayaba', 'Guayaba', array['guayaba','guava'], 2, 0.7, 3.5, 1, 0.6, 10, 35, false, 48),
  ('sue302_villasenor', 'maracuya', 'Maracuyá', array['maracuya','passion fruit'], 3.5, 1.5, 6.5, 2, 1, 15, 35, false, 49),
  ('sue302_villasenor', 'guanabana', 'Guanábana', array['guanabana','soursop'], 2.2, 0.8, 3.8, 1.2, 0.8, 8, 20, false, 50),
  ('sue302_villasenor', 'pitahaya', 'Pitahaya', array['pitahaya','dragon fruit'], 2.8, 1, 4.5, 1.3, 0.8, 10, 30, false, 51),
  ('sue302_villasenor', 'soya', 'Soya', array['soya','soja','soybean'], 65, 15, 22, 6, 3.5, 2, 5, false, 52),
  ('sue302_villasenor', 'garbanzo', 'Garbanzo', array['garbanzo','chickpea'], 32, 8.5, 12, 4, 2, 1, 3, false, 53),
  ('sue302_villasenor', 'lenteja', 'Lenteja', array['lenteja','lentil'], 36, 10, 13, 5, 2.5, 1, 2.5, false, 54);

update public.sf_reference_source
set version = '2026-07-14'
where source_key = 'sue302_villasenor';
