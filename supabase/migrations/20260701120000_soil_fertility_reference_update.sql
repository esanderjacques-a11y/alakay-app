-- Soil fertility reference update (SUE302 Tutoría Plan nutricional, Diego R. Villaseñor-Ortiz).
-- Adds extractant-aware Tabla N.° 1 (Olsen Modificado/KCl 1N vs Mehlich III, incl. S y Na),
-- corrects Tabla N.° 5 (extracción/cultivos) with the values published in los anexos,
-- and adds Tabla N.° 7 (eficiencia de nutrientes por sistema de riego).

-- 1) Tabla N.° 1 — make it extractant-aware ------------------------------------------------

alter table public.sf_nutrient_interpretation
  add column if not exists extractant text not null default 'general';

alter table public.sf_nutrient_interpretation
  drop constraint if exists sf_nutrient_interpretation_source_key_parameter_key_key;

alter table public.sf_nutrient_interpretation
  add constraint sf_nutrient_interpretation_source_extractant_param_key
  unique (source_key, extractant, parameter_key);

-- Olsen Modificado / KCl 1N (Tabla N.° 1, columna izquierda)
insert into public.sf_nutrient_interpretation
  (source_key, extractant, parameter_key, label, unit, low_max, adequate_min, adequate_max, high_min, sort_order)
values
  ('sue302_villasenor', 'olsen_kcl', 'ph', 'pH', '', 5.4, 5.5, 6.5, 6.6, 1),
  ('sue302_villasenor', 'olsen_kcl', 'acidez_extraible', 'Acidez extraíble (H+Al)', 'cmol(+)/kg', null, 0, 0.5, 0.51, 2),
  ('sue302_villasenor', 'olsen_kcl', 'ca', 'Ca', 'cmol(+)/kg', 3.9, 4, 20, 20.1, 3),
  ('sue302_villasenor', 'olsen_kcl', 'k', 'K', 'cmol(+)/kg', 0.19, 0.2, 0.6, 0.61, 4),
  ('sue302_villasenor', 'olsen_kcl', 'mg', 'Mg', 'cmol(+)/kg', 0.9, 1, 5, 5.1, 5),
  ('sue302_villasenor', 'olsen_kcl', 'p', 'P', 'mg/kg', 9, 10, 20, 21, 6),
  ('sue302_villasenor', 'olsen_kcl', 'fe', 'Fe', 'mg/kg', 9, 10, 100, 101, 7),
  ('sue302_villasenor', 'olsen_kcl', 'cu', 'Cu', 'mg/kg', 1.9, 2, 20, 20.1, 8),
  ('sue302_villasenor', 'olsen_kcl', 'mn', 'Mn', 'mg/kg', 4, 5, 50, 51, 9),
  ('sue302_villasenor', 'olsen_kcl', 'zn', 'Zn', 'mg/kg', 1.9, 2, 10, 10.1, 10)
on conflict (source_key, extractant, parameter_key) do update set
  label = excluded.label, unit = excluded.unit, low_max = excluded.low_max,
  adequate_min = excluded.adequate_min, adequate_max = excluded.adequate_max,
  high_min = excluded.high_min, sort_order = excluded.sort_order;

-- Mehlich III (Tabla N.° 1, columna derecha)
insert into public.sf_nutrient_interpretation
  (source_key, extractant, parameter_key, label, unit, low_max, adequate_min, adequate_max, high_min, sort_order)
values
  ('sue302_villasenor', 'mehlich3', 'ph', 'pH', '', 5.4, 5.5, 6.5, 6.6, 1),
  ('sue302_villasenor', 'mehlich3', 'acidez_extraible', 'Acidez extraíble (H+Al)', 'cmol(+)/kg', null, 0, 0.5, 0.51, 2),
  ('sue302_villasenor', 'mehlich3', 'ca', 'Ca', 'cmol(+)/kg', 3.9, 4, 16, 16.1, 3),
  ('sue302_villasenor', 'mehlich3', 'k', 'K', 'cmol(+)/kg', 0.49, 0.5, 0.8, 0.81, 4),
  ('sue302_villasenor', 'mehlich3', 'mg', 'Mg', 'cmol(+)/kg', 2.9, 3, 6, 6.1, 5),
  ('sue302_villasenor', 'mehlich3', 'na', 'Na', 'cmol(+)/kg', 0.29, 0.3, 0.7, 0.71, 6),
  ('sue302_villasenor', 'mehlich3', 'p', 'P', 'mg/kg', 19, 20, 50, 51, 7),
  ('sue302_villasenor', 'mehlich3', 's', 'S', 'mg/kg', 19, 20, 50, 51, 8),
  ('sue302_villasenor', 'mehlich3', 'fe', 'Fe', 'mg/kg', 49, 50, 100, 101, 9),
  ('sue302_villasenor', 'mehlich3', 'cu', 'Cu', 'mg/kg', 1.9, 2, 20, 20.1, 10),
  ('sue302_villasenor', 'mehlich3', 'mn', 'Mn', 'mg/kg', 9, 10, 50, 51, 11),
  ('sue302_villasenor', 'mehlich3', 'zn', 'Zn', 'mg/kg', 1.9, 2, 10, 10.1, 12)
on conflict (source_key, extractant, parameter_key) do update set
  label = excluded.label, unit = excluded.unit, low_max = excluded.low_max,
  adequate_min = excluded.adequate_min, adequate_max = excluded.adequate_max,
  high_min = excluded.high_min, sort_order = excluded.sort_order;

-- 2) Tabla N.° 5 — corregir/ampliar extracción nutricional de cultivos --------------------

-- Corrige cultivos previamente cargados con valores estimados por los publicados en el anexo.
update public.sf_crop_extraction set
  label = 'Maíz grano', n_kg_per_t = 20.0, p2o5_kg_per_t = 6.9, k2o_kg_per_t = 14.0, cao_kg_per_t = 4.5, mgo_kg_per_t = 2.2,
  match_patterns = array['\b(maiz|maize|corn)\b'], sort_order = 1
where source_key = 'sue302_villasenor' and crop_key = 'maiz';

update public.sf_crop_extraction set
  label = 'Arroz', n_kg_per_t = 21.4, p2o5_kg_per_t = 7.1, k2o_kg_per_t = 27.0, cao_kg_per_t = 6.6, mgo_kg_per_t = 4.0
where source_key = 'sue302_villasenor' and crop_key = 'arroz';

update public.sf_crop_extraction set
  label = 'Frejoles', n_kg_per_t = 20.0, p2o5_kg_per_t = 13.7, k2o_kg_per_t = 40.0, cao_kg_per_t = 15.0, mgo_kg_per_t = 10.0
where source_key = 'sue302_villasenor' and crop_key = 'frijol';

update public.sf_crop_extraction set
  label = 'Papas', n_kg_per_t = 3.8, p2o5_kg_per_t = 1.0, k2o_kg_per_t = 4.0, cao_kg_per_t = 1.6, mgo_kg_per_t = 0.9
where source_key = 'sue302_villasenor' and crop_key = 'papa';

update public.sf_crop_extraction set
  label = 'Trigo', n_kg_per_t = 24.3, p2o5_kg_per_t = 7.3, k2o_kg_per_t = 24.0, cao_kg_per_t = 7.0, mgo_kg_per_t = 4.3
where source_key = 'sue302_villasenor' and crop_key = 'trigo';

update public.sf_crop_extraction set
  label = 'Tomate campo', n_kg_per_t = 3.3, p2o5_kg_per_t = 0.8, k2o_kg_per_t = 5.0, cao_kg_per_t = 1.2, mgo_kg_per_t = 0.6,
  match_patterns = array['\btomate\b(?!.*(industrial|invernadero))', '\btomato\b(?!.*(processing|greenhouse))'], sort_order = 26
where source_key = 'sue302_villasenor' and crop_key = 'tomate';

-- Nuevos cultivos publicados en la Tabla N.° 5 del anexo (frutales, hortalizas y granos).
insert into public.sf_crop_extraction
  (source_key, crop_key, label, match_patterns, n_kg_per_t, p2o5_kg_per_t, k2o_kg_per_t, cao_kg_per_t, mgo_kg_per_t, is_default, sort_order)
values
  ('sue302_villasenor', 'maiz_ensilaje', 'Maíz ensilaje', array['\bmaiz ensilaje\b', '\b(corn|maize) silage\b', '\bsilage corn\b'], 3.9, 1.6, 2.5, 0.8, 0.4, false, 2),
  ('sue302_villasenor', 'cebada', 'Cebada', array['\bcebada\b', '\bbarley\b'], 22.2, 7.1, 22.0, 8.6, 5.4, false, 12),
  ('sue302_villasenor', 'avena', 'Avena', array['\bavena\b', '\boat(s)?\b'], 22.2, 7.6, 20.0, 8.5, 5.4, false, 13),
  ('sue302_villasenor', 'girasol', 'Girasol', array['\bgirasol\b', '\bsunflower\b'], 34.5, 11.0, 37.4, 15.0, 8.0, false, 14),
  ('sue302_villasenor', 'tomate_industrial', 'Tomate industrial', array['\btomate industrial\b', '\bprocessing tomato\b'], 3.3, 0.8, 5.0, 0.8, 0.6, false, 24),
  ('sue302_villasenor', 'tomate_invernadero', 'Tomate invernadero', array['\btomate invernadero\b', '\bgreenhouse tomato\b'], 3.3, 0.8, 5.0, 0.4, 0.4, false, 25),
  ('sue302_villasenor', 'naranja', 'Naranja', array['\bnaranja\b', '\borange\b'], 2.7, 0.6, 4.2, 1.1, 0.6, false, 30),
  ('sue302_villasenor', 'limon', 'Limón', array['\blimon\b', '\blemon\b', '\blime\b'], 2.7, 0.6, 4.2, 1.0, 0.6, false, 31),
  ('sue302_villasenor', 'aguacate', 'Aguacate', array['\baguacate\b', '\bavocado\b', '\bpalta\b'], 6.2, 2.9, 18.2, 4.8, 2.5, false, 32),
  ('sue302_villasenor', 'papaya', 'Papaya', array['\bpapaya\b'], 6.0, 2.3, 7.0, 3.0, 1.5, false, 33),
  ('sue302_villasenor', 'arandano', 'Arándano', array['\barandano\b', '\bblueberry\b'], 4.7, 0.8, 5.2, 2.0, 1.2, false, 34),
  ('sue302_villasenor', 'frambuesa', 'Frambuesa', array['\bframbuesa\b', '\braspberry\b'], 16.9, 3.6, 10.4, 8.0, 3.7, false, 35),
  ('sue302_villasenor', 'frutilla', 'Frutilla', array['\bfrutilla\b', '\bfresa\b', '\bstrawberry\b'], 2.5, 1.3, 4.5, 1.6, 0.9, false, 36),
  ('sue302_villasenor', 'cebolla', 'Cebolla', array['\bcebolla\b', '\bonion\b'], 3.1, 1.2, 4.0, 1.6, 0.9, false, 40),
  ('sue302_villasenor', 'coliflor', 'Coliflor', array['\bcoliflor\b', '\bcauliflower\b'], 4.5, 1.4, 5.0, 2.7, 1.5, false, 41),
  ('sue302_villasenor', 'brocoli', 'Brócoli', array['\bbrocoli\b', '\bbroccoli\b'], 4.5, 1.4, 5.0, 2.7, 1.5, false, 42),
  ('sue302_villasenor', 'sandia', 'Sandía', array['\bsandia\b', '\bwatermelon\b'], 3.5, 1.2, 4.5, 1.7, 0.9, false, 43),
  ('sue302_villasenor', 'melon', 'Melón', array['\bmelon\b', '\bcantaloupe\b'], 4.5, 1.6, 6.5, 1.3, 0.7, false, 44),
  ('sue302_villasenor', 'pepino', 'Pepino ensalada', array['\bpepino\b', '\bcucumber\b'], 1.3, 0.8, 2.8, 0.6, 0.3, false, 45),
  ('sue302_villasenor', 'lechuga', 'Lechugas', array['\blechuga(s)?\b', '\blettuce\b'], 2.7, 0.9, 4.5, 1.7, 1.0, false, 46),
  ('sue302_villasenor', 'arveja', 'Arvejas', array['\barveja(s)?\b', '\bguisante(s)?\b', '\bpea(s)?\b'], 8.0, 4.2, 8.0, 7.5, 3.8, false, 47),
  ('sue302_villasenor', 'zanahoria', 'Zanahoria', array['\bzanahoria\b', '\bcarrot\b'], 4.0, 1.4, 6.5, 2.0, 1.0, false, 48)
on conflict (source_key, crop_key) do update set
  label = excluded.label, match_patterns = excluded.match_patterns,
  n_kg_per_t = excluded.n_kg_per_t, p2o5_kg_per_t = excluded.p2o5_kg_per_t,
  k2o_kg_per_t = excluded.k2o_kg_per_t, cao_kg_per_t = excluded.cao_kg_per_t,
  mgo_kg_per_t = excluded.mgo_kg_per_t, sort_order = excluded.sort_order;

-- 3) Tabla N.° 7 — eficiencia de nutrientes según sistema de riego ------------------------

create table if not exists public.sf_irrigation_efficiency (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  nutrient_key text not null,
  irrigation_system text not null check (irrigation_system in ('surco_inundacion', 'aspersion_pivote', 'goteo_microaspersion')),
  min_percent numeric not null,
  max_percent numeric not null,
  sort_order int not null default 0,
  unique (source_key, nutrient_key, irrigation_system)
);

alter table public.sf_irrigation_efficiency enable row level security;

drop policy if exists "sf_irrigation_efficiency_select" on public.sf_irrigation_efficiency;
create policy "sf_irrigation_efficiency_select"
  on public.sf_irrigation_efficiency for select
  to anon, authenticated
  using (true);

insert into public.sf_irrigation_efficiency
  (source_key, nutrient_key, irrigation_system, min_percent, max_percent, sort_order)
values
  ('sue302_villasenor', 'n', 'surco_inundacion', 40, 60, 1),
  ('sue302_villasenor', 'n', 'aspersion_pivote', 60, 70, 1),
  ('sue302_villasenor', 'n', 'goteo_microaspersion', 75, 85, 1),
  ('sue302_villasenor', 'p', 'surco_inundacion', 10, 20, 2),
  ('sue302_villasenor', 'p', 'aspersion_pivote', 15, 25, 2),
  ('sue302_villasenor', 'p', 'goteo_microaspersion', 25, 45, 2),
  ('sue302_villasenor', 'k', 'surco_inundacion', 60, 75, 3),
  ('sue302_villasenor', 'k', 'aspersion_pivote', 70, 80, 3),
  ('sue302_villasenor', 'k', 'goteo_microaspersion', 85, 85, 3),
  ('sue302_villasenor', 'mg', 'surco_inundacion', 60, 75, 4),
  ('sue302_villasenor', 'mg', 'aspersion_pivote', 70, 80, 4),
  ('sue302_villasenor', 'mg', 'goteo_microaspersion', 85, 85, 4),
  ('sue302_villasenor', 'ca', 'surco_inundacion', 60, 75, 5),
  ('sue302_villasenor', 'ca', 'aspersion_pivote', 70, 80, 5),
  ('sue302_villasenor', 'ca', 'goteo_microaspersion', 85, 85, 5),
  ('sue302_villasenor', 's', 'surco_inundacion', 40, 60, 6),
  ('sue302_villasenor', 's', 'aspersion_pivote', 50, 50, 6),
  ('sue302_villasenor', 's', 'goteo_microaspersion', 70, 85, 6),
  ('sue302_villasenor', 'b', 'surco_inundacion', 40, 60, 7),
  ('sue302_villasenor', 'b', 'aspersion_pivote', 50, 50, 7),
  ('sue302_villasenor', 'b', 'goteo_microaspersion', 70, 85, 7),
  ('sue302_villasenor', 'zn', 'surco_inundacion', 40, 60, 8),
  ('sue302_villasenor', 'zn', 'aspersion_pivote', 50, 50, 8),
  ('sue302_villasenor', 'zn', 'goteo_microaspersion', 70, 85, 8)
on conflict (source_key, nutrient_key, irrigation_system) do update set
  min_percent = excluded.min_percent, max_percent = excluded.max_percent, sort_order = excluded.sort_order;
