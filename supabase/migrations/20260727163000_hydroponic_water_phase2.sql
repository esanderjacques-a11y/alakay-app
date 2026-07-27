-- Phase 2: hydroponic nutrient-solution parameters + target ranges under water sample type.
-- App UI distinguishes Irrigation vs Nutrient solution via local waterMode; ranges share sample_type_id = 3.

insert into public.sources (source_id, source_name, institution, url)
values (
  10,
  'Hydroponic nutrient solution target bands (general recipe ions)',
  'CULTOSOL hydroponic starter targets; Hoagland-inspired extension guidance',
  null
)
on conflict (source_id) do nothing;

insert into public.parameters (
  parameter_id, parameter_name, symbol, category, default_unit_id, soil, foliar, water
)
values
  (110, 'Hydroponic N (NO3-N)', 'NO3-N-H', 'Hydroponic solution', 2, false, false, true),
  (111, 'Hydroponic P', 'P-H', 'Hydroponic solution', 2, false, false, true),
  (112, 'Hydroponic K', 'K-H', 'Hydroponic solution', 2, false, false, true),
  (113, 'Hydroponic Ca', 'Ca-H', 'Hydroponic solution', 2, false, false, true),
  (114, 'Hydroponic Mg', 'Mg-H', 'Hydroponic solution', 2, false, false, true),
  (115, 'Hydroponic S', 'S-H', 'Hydroponic solution', 2, false, false, true),
  (116, 'Hydroponic Fe', 'Fe-H', 'Hydroponic solution', 2, false, false, true),
  (117, 'Solution EC', 'EC-H', 'Hydroponic solution', 1, false, false, true),
  (118, 'Solution pH', 'pH-H', 'Hydroponic solution', 1, false, false, true)
on conflict (parameter_id) do update
set water = true,
    category = excluded.category,
    parameter_name = excluded.parameter_name,
    symbol = excluded.symbol;

insert into public.parameter_aliases (alias_id, parameter_id, language, alias_name, alias_type, source, priority)
values
  (2100, 110, 'en', 'Hydroponic nitrate-N', 'label', 'seed', 1),
  (2101, 110, 'en', 'Solution NO3-N', 'label', 'seed', 2),
  (2102, 111, 'en', 'Hydroponic phosphorus', 'label', 'seed', 1),
  (2103, 112, 'en', 'Hydroponic potassium', 'label', 'seed', 1),
  (2104, 113, 'en', 'Hydroponic calcium', 'label', 'seed', 1),
  (2105, 114, 'en', 'Hydroponic magnesium', 'label', 'seed', 1),
  (2106, 117, 'en', 'Solution EC', 'label', 'seed', 1),
  (2107, 118, 'en', 'Solution pH', 'label', 'seed', 1),
  (2108, 110, 'es', 'Nitrato-N solución', 'label', 'seed', 1),
  (2109, 117, 'es', 'CE solución', 'label', 'seed', 1),
  (2110, 118, 'es', 'pH solución', 'label', 'seed', 1)
on conflict (alias_id) do nothing;

-- General crop targets (mg/L for ions; EC dS/m; pH unitless)
insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
values
  (999210, 999, 3, 110, 2, 100, 200, 10, 'medium', true, true),
  (999211, 999, 3, 111, 2, 30, 50, 10, 'medium', true, true),
  (999212, 999, 3, 112, 2, 150, 300, 10, 'medium', true, true),
  (999213, 999, 3, 113, 2, 100, 200, 10, 'medium', true, true),
  (999214, 999, 3, 114, 2, 30, 70, 10, 'medium', true, true),
  (999215, 999, 3, 115, 2, 50, 100, 10, 'medium', true, true),
  (999216, 999, 3, 116, 2, 1, 3, 10, 'medium', true, true),
  (999217, 999, 3, 117, 1, 1.2, 2.5, 10, 'medium', true, true),
  (999218, 999, 3, 118, 1, 5.5, 6.5, 10, 'medium', true, true)
on conflict (range_id) do nothing;
