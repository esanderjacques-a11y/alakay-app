-- Add Sodium (Na / Sodio) for soil (cmol(+)/kg default) and foliar (ppm via mg/kg ranges).

insert into public.sources (source_id, source_name, institution, url)
values
  (
    7,
    'Exchangeable sodium / sodicity guidance (ESP and exchangeable Na quantity)',
    'NSW DPI Soil Health; AgriTest exchangeable cations; CULTOSOL Na thresholds',
    'https://www.dpi.nsw.gov.au/about-us/services/laboratory-services/soil-health/interpret'
  ),
  (
    8,
    'Leaf tissue sodium high/excess bands (citrus / plant tissue)',
    'UF/IFAS SL253 / HS1355; NCDA&CS Plant Tissue Analysis Guide',
    'https://ask.ifas.ufl.edu/publication/HS1355'
  );

insert into public.parameters (
  parameter_id,
  parameter_name,
  symbol,
  category,
  default_unit_id,
  soil,
  foliar
)
values (
  27,
  'Sodium',
  'Na',
  'Base cation',
  3,
  true,
  true
);

insert into public.parameter_aliases (alias_id, parameter_id, language, alias_name, alias_type, source, priority)
values
  (164, 27, 'en', 'Sodium', 'label', 'seed', 1),
  (165, 27, 'en', 'Na', 'symbol', 'seed', 1),
  (166, 27, 'en', 'Exchangeable Na', 'label', 'seed', 2),
  (167, 27, 'en', 'Exchangeable Sodium', 'label', 'seed', 3),
  (168, 27, 'es', 'Sodio', 'label', 'seed', 1),
  (169, 27, 'es', 'Na', 'symbol', 'seed', 1),
  (170, 27, 'es', 'Sodio intercambiable', 'label', 'seed', 2),
  (171, 27, 'fr', 'Sodium', 'label', 'seed', 1),
  (172, 27, 'fr', 'Na', 'symbol', 'seed', 1),
  (173, 27, 'ht', 'Sodyòm', 'label', 'seed', 1),
  (174, 27, 'ht', 'Sodyom', 'label', 'seed', 2);

-- Soil safe band: 0–0.5 cmol(+)/kg
insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  380 + row_number() over (order by c.crop_id),
  c.crop_id,
  1,
  27,
  3,
  0,
  0.5,
  7,
  'medium',
  true,
  true
from public.crops c
where c.crop_id between 1 and 10;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
values (999039, 999, 1, 27, 3, 0, 0.5, 7, 'medium', true, true);

-- Foliar acceptable tissue Na: 0–1500 mg/kg (= ppm)
insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  390 + row_number() over (order by c.crop_id),
  c.crop_id,
  2,
  27,
  2,
  0,
  1500,
  8,
  'medium',
  true,
  true
from public.crops c
where c.crop_id between 1 and 10;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
values (999040, 999, 2, 27, 2, 0, 1500, 8, 'medium', true, true);
