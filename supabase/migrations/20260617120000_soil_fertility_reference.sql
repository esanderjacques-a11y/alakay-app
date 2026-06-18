-- Soil fertility reference tables (SUE302 Tutoría Plan nutricional, Diego R. Villaseñor-Ortiz).
-- Tablas N.° 1–6, enmiendas (Sección 12). Public read-only reference data.

create table if not exists public.sf_reference_source (
  source_key text primary key,
  title text not null,
  version text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tabla N.° 1 — Interpretación de nutrientes (suelo tropical)
create table if not exists public.sf_nutrient_interpretation (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  parameter_key text not null,
  label text not null,
  unit text not null default '',
  low_max numeric,
  adequate_min numeric not null,
  adequate_max numeric not null,
  high_min numeric,
  sort_order int not null default 0,
  unique (source_key, parameter_key)
);

-- Tabla N.° 4 & N.° 6 — Factores de conversión
create table if not exists public.sf_conversion_factor (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  factor_key text not null,
  table_number smallint not null check (table_number in (4, 6)),
  from_nutrient text,
  to_nutrient text,
  factor numeric not null,
  unit_from text,
  unit_to text,
  unique (source_key, factor_key)
);

-- Tabla N.° 5 — Extracción nutricional de cultivos (kg/t rendimiento)
create table if not exists public.sf_crop_extraction (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  crop_key text not null,
  label text not null,
  match_patterns text[] not null default '{}',
  n_kg_per_t numeric not null,
  p2o5_kg_per_t numeric not null,
  k2o_kg_per_t numeric not null,
  cao_kg_per_t numeric not null,
  mgo_kg_per_t numeric not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  unique (source_key, crop_key)
);

-- Sección 12 — Enmiendas agrícolas
create table if not exists public.sf_amendment_material (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  material_key text not null,
  label text not null,
  cao_percent numeric not null,
  mgo_percent numeric not null,
  unique (source_key, material_key)
);

-- Tabla N.° 2 — Bandas de saturación de cationes (% CIC)
create table if not exists public.sf_cic_saturation_band (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  cation text not null check (cation in ('ca', 'mg', 'k', 'na')),
  band text not null,
  min_percent numeric,
  max_percent numeric,
  range_label text not null,
  is_adequate boolean not null default false,
  target_percent numeric,
  sort_order int not null default 0
);

create index if not exists sf_cic_saturation_band_cation_idx
  on public.sf_cic_saturation_band (source_key, cation, sort_order);

-- Tabla N.° 3 — Relaciones catiónicas óptimas
create table if not exists public.sf_cic_ratio_range (
  id bigint generated always as identity primary key,
  source_key text not null references public.sf_reference_source (source_key) on delete cascade,
  relation_key text not null,
  optimal_min numeric not null,
  optimal_max numeric not null,
  low_message_key text,
  high_message_key text,
  unique (source_key, relation_key)
);

-- RLS: public read-only reference data
alter table public.sf_reference_source enable row level security;
alter table public.sf_nutrient_interpretation enable row level security;
alter table public.sf_conversion_factor enable row level security;
alter table public.sf_crop_extraction enable row level security;
alter table public.sf_amendment_material enable row level security;
alter table public.sf_cic_saturation_band enable row level security;
alter table public.sf_cic_ratio_range enable row level security;

drop policy if exists "sf_reference_source_select" on public.sf_reference_source;
create policy "sf_reference_source_select"
  on public.sf_reference_source for select
  to anon, authenticated
  using (active = true);

drop policy if exists "sf_nutrient_interpretation_select" on public.sf_nutrient_interpretation;
create policy "sf_nutrient_interpretation_select"
  on public.sf_nutrient_interpretation for select
  to anon, authenticated
  using (true);

drop policy if exists "sf_conversion_factor_select" on public.sf_conversion_factor;
create policy "sf_conversion_factor_select"
  on public.sf_conversion_factor for select
  to anon, authenticated
  using (true);

drop policy if exists "sf_crop_extraction_select" on public.sf_crop_extraction;
create policy "sf_crop_extraction_select"
  on public.sf_crop_extraction for select
  to anon, authenticated
  using (true);

drop policy if exists "sf_amendment_material_select" on public.sf_amendment_material;
create policy "sf_amendment_material_select"
  on public.sf_amendment_material for select
  to anon, authenticated
  using (true);

drop policy if exists "sf_cic_saturation_band_select" on public.sf_cic_saturation_band;
create policy "sf_cic_saturation_band_select"
  on public.sf_cic_saturation_band for select
  to anon, authenticated
  using (true);

drop policy if exists "sf_cic_ratio_range_select" on public.sf_cic_ratio_range;
create policy "sf_cic_ratio_range_select"
  on public.sf_cic_ratio_range for select
  to anon, authenticated
  using (true);

-- Seed: source metadata
insert into public.sf_reference_source (source_key, title, version, active)
values (
  'sue302_villasenor',
  'Tutoría Plan nutricional — Fertilidad de Suelos (SUE302)',
  '2024',
  true
)
on conflict (source_key) do nothing;

-- Tabla N.° 1
insert into public.sf_nutrient_interpretation
  (source_key, parameter_key, label, unit, low_max, adequate_min, adequate_max, high_min, sort_order)
values
  ('sue302_villasenor', 'ph', 'pH', '', 5.4, 5.5, 6.5, 6.6, 1),
  ('sue302_villasenor', 'acidez_extraible', 'Acidez extraíble (H+Al)', 'cmol(+)/kg', 0.5, 0.5, 2.5, 2.51, 2),
  ('sue302_villasenor', 'k', 'K', 'cmol(+)/kg', 0.15, 0.16, 0.40, 0.41, 3),
  ('sue302_villasenor', 'ca', 'Ca', 'cmol(+)/kg', 2.0, 2.1, 8.0, 8.1, 4),
  ('sue302_villasenor', 'mg', 'Mg', 'cmol(+)/kg', 0.4, 0.5, 2.0, 2.1, 5),
  ('sue302_villasenor', 'p', 'P', 'mg/kg', 9, 10, 25, 26, 6),
  ('sue302_villasenor', 'fe', 'Fe', 'mg/kg', 4, 5, 50, 51, 7),
  ('sue302_villasenor', 'cu', 'Cu', 'mg/kg', 0.4, 0.5, 2.0, 2.1, 8),
  ('sue302_villasenor', 'zn', 'Zn', 'mg/kg', 0.8, 1.0, 3.0, 3.1, 9),
  ('sue302_villasenor', 'mn', 'Mn', 'mg/kg', 4, 5, 30, 31, 10)
on conflict (source_key, parameter_key) do nothing;

-- Tabla N.° 4
insert into public.sf_conversion_factor
  (source_key, factor_key, table_number, from_nutrient, to_nutrient, factor, unit_from, unit_to)
values
  ('sue302_villasenor', 'p_to_p2o5', 4, 'P', 'P2O5', 2.29, 'element', 'oxide'),
  ('sue302_villasenor', 'k_to_k2o', 4, 'K', 'K2O', 1.2, 'element', 'oxide'),
  ('sue302_villasenor', 'ca_to_cao', 4, 'Ca', 'CaO', 1.4, 'element', 'oxide'),
  ('sue302_villasenor', 'mg_to_mgo', 4, 'Mg', 'MgO', 1.66, 'element', 'oxide'),
  ('sue302_villasenor', 'n_to_n', 4, 'N', 'N', 1, 'element', 'element')
on conflict (source_key, factor_key) do nothing;

-- Tabla N.° 6
insert into public.sf_conversion_factor
  (source_key, factor_key, table_number, from_nutrient, to_nutrient, factor, unit_from, unit_to)
values
  ('sue302_villasenor', 'cmol_ca_to_mgkg', 6, 'Ca', 'Ca', 200.4, 'cmol(+)/kg', 'mg/kg'),
  ('sue302_villasenor', 'cmol_mg_to_mgkg', 6, 'Mg', 'Mg', 121.5, 'cmol(+)/kg', 'mg/kg'),
  ('sue302_villasenor', 'cmol_k_to_mgkg', 6, 'K', 'K', 391, 'cmol(+)/kg', 'mg/kg'),
  ('sue302_villasenor', 'cmol_na_to_mgkg', 6, 'Na', 'Na', 229.9, 'cmol(+)/kg', 'mg/kg')
on conflict (source_key, factor_key) do nothing;

-- Tabla N.° 5
insert into public.sf_crop_extraction
  (source_key, crop_key, label, match_patterns, n_kg_per_t, p2o5_kg_per_t, k2o_kg_per_t, cao_kg_per_t, mgo_kg_per_t, is_default, sort_order)
values
  ('sue302_villasenor', 'maiz', 'Maíz', array['\b(maiz|maize|corn)\b'], 22, 4.3, 5.6, 2.0, 0.9, false, 1),
  ('sue302_villasenor', 'arroz', 'Arroz', array['\b(arroz|rice)\b'], 15, 3.5, 4.5, 0.5, 0.4, false, 2),
  ('sue302_villasenor', 'frijol', 'Frijol', array['\b(frijol|bean|frejol|habichuela)\b'], 35, 6.0, 8.0, 3.0, 1.5, false, 3),
  ('sue302_villasenor', 'papa', 'Papa', array['\b(papa|potato|patata)\b'], 4.0, 1.5, 6.0, 0.5, 0.3, false, 4),
  ('sue302_villasenor', 'cana', 'Caña de azúcar', array['\b(cana|caña|sugarcane)\b'], 1.8, 0.4, 2.0, 0.5, 0.3, false, 5),
  ('sue302_villasenor', 'tomate', 'Tomate', array['\b(tomate|tomato)\b'], 3.5, 0.8, 5.0, 2.0, 0.5, false, 6),
  ('sue302_villasenor', 'banano', 'Banano / plátano', array['\b(banano|banana|platano|plantain)\b'], 2.5, 0.6, 8.0, 0.8, 0.4, false, 7),
  ('sue302_villasenor', 'cafe', 'Café', array['\b(cafe|coffee)\b'], 8.0, 1.5, 10.0, 1.5, 0.8, false, 8),
  ('sue302_villasenor', 'soya', 'Soya', array['\b(soya|soja|soybean)\b'], 55, 10.0, 18.0, 4.0, 2.0, false, 9),
  ('sue302_villasenor', 'trigo', 'Trigo', array['\b(trigo|wheat)\b'], 25, 5.0, 6.0, 1.0, 0.5, false, 10),
  ('sue302_villasenor', 'yuca', 'Yuca', array['\b(yuca|cassava|manioca)\b'], 2.5, 0.5, 3.5, 0.4, 0.2, false, 11),
  ('sue302_villasenor', 'general', 'Cultivo general', array[]::text[], 25, 5, 6, 2, 1, true, 99)
on conflict (source_key, crop_key) do nothing;

-- Sección 12 — Enmiendas
insert into public.sf_amendment_material
  (source_key, material_key, label, cao_percent, mgo_percent)
values
  ('sue302_villasenor', 'cal_agricola', 'Cal agrícola', 40, 0),
  ('sue302_villasenor', 'yeso', 'Yeso', 14, 0),
  ('sue302_villasenor', 'dolomita', 'Dolomita', 30, 14)
on conflict (source_key, material_key) do nothing;

-- Tabla N.° 2 — adequate targets (denormalized rows for app bootstrap)
insert into public.sf_cic_saturation_band
  (source_key, cation, band, min_percent, max_percent, range_label, is_adequate, target_percent, sort_order)
values
  ('sue302_villasenor', 'ca', 'very_low', 0, 25, '<25%', false, null, 1),
  ('sue302_villasenor', 'ca', 'low', 25.01, 40, '26–40%', false, null, 2),
  ('sue302_villasenor', 'ca', 'moderately_low', 40.01, 60, '41–60%', false, null, 3),
  ('sue302_villasenor', 'ca', 'adequate', 60.01, 75, '61–75%', true, 68, 4),
  ('sue302_villasenor', 'ca', 'moderately_high', 75.01, 80, '76–80%', false, null, 5),
  ('sue302_villasenor', 'ca', 'high', 80.01, 85, '81–85%', false, null, 6),
  ('sue302_villasenor', 'ca', 'very_high', 85.01, null, '>85%', false, null, 7),
  ('sue302_villasenor', 'mg', 'very_low', 0, 3, '<3%', false, null, 1),
  ('sue302_villasenor', 'mg', 'low', 3.01, 5, '4–5%', false, null, 2),
  ('sue302_villasenor', 'mg', 'moderately_low', 5.01, 10, '6–10%', false, null, 3),
  ('sue302_villasenor', 'mg', 'adequate', 10.01, 15, '11–15%', true, 13, 4),
  ('sue302_villasenor', 'mg', 'moderately_high', 15.01, 20, '16–20%', false, null, 5),
  ('sue302_villasenor', 'mg', 'high', 20.01, 30, '21–30%', false, null, 6),
  ('sue302_villasenor', 'mg', 'very_high', 30.01, null, '>30%', false, null, 7),
  ('sue302_villasenor', 'k', 'very_low', 0, 1, '<1%', false, null, 1),
  ('sue302_villasenor', 'k', 'low', 1.01, 2, '1.1–2%', false, null, 2),
  ('sue302_villasenor', 'k', 'moderately_low', 2.01, 3, '2.1–3%', false, null, 3),
  ('sue302_villasenor', 'k', 'adequate', 3.01, 4, '3.1–4%', true, 3.55, 4),
  ('sue302_villasenor', 'k', 'moderately_high', 4.01, 6, '4.1–6%', false, null, 5),
  ('sue302_villasenor', 'k', 'high', 6.01, 10, '6.1–10%', false, null, 6),
  ('sue302_villasenor', 'k', 'very_high', 10.01, null, '>10%', false, null, 7),
  ('sue302_villasenor', 'na', 'very_low', 0, 1, '<1%', false, null, 1),
  ('sue302_villasenor', 'na', 'low', 1.01, 2, '1–2%', false, null, 2),
  ('sue302_villasenor', 'na', 'moderately_low', 2.01, 3, '2.1–3%', false, null, 3),
  ('sue302_villasenor', 'na', 'adequate', 3.01, 5, '3.1–5%', true, 4, 4),
  ('sue302_villasenor', 'na', 'moderately_high', 5.01, 10, '5.1–10%', false, null, 5),
  ('sue302_villasenor', 'na', 'high', 10.01, 20, '10.1–20%', false, null, 6),
  ('sue302_villasenor', 'na', 'very_high', 20.01, null, '>20%', false, null, 7);

-- Tabla N.° 3
insert into public.sf_cic_ratio_range
  (source_key, relation_key, optimal_min, optimal_max, low_message_key, high_message_key)
values
  ('sue302_villasenor', 'ca_mg', 3, 5, 'cicRatioCaMgLow', 'cicRatioCaMgHigh'),
  ('sue302_villasenor', 'ca_k', 9, 25, 'cicRatioCaKLow', 'cicRatioCaKHigh'),
  ('sue302_villasenor', 'mg_k', 2, 7, 'cicRatioMgKLow', 'cicRatioMgKHigh'),
  ('sue302_villasenor', 'k_na', 1, 15, 'cicRatioKNaLow', 'cicRatioKNaHigh'),
  ('sue302_villasenor', 'ca_na', 9, 25, 'cicRatioCaNaLow', 'cicRatioCaNaHigh')
on conflict (source_key, relation_key) do nothing;
