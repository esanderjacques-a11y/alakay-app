-- Align irrigation water ranges with EARTH Unidad 4 (Villaseñor / AGUA.pdf)
-- Severity “Ninguna” bands + Ayers & Westcot EC + Vidal Na/Cl/B.

update public.sources
set source_name = 'EARTH Unidad 4 — Evaluación del agua de riego (Villaseñor); Ayers & Westcot; Vidal',
    institution = 'Universidad EARTH / US Salinity Lab / FAO-style guidance',
    url = null
where source_id = 9;

-- Existing seeded water-only parameter ranges
update public.crop_parameter_ranges set min = 0, max = 3 where range_id = 999101;   -- SAR
update public.crop_parameter_ranges set min = 0, max = 68 where range_id = 999102;  -- Cl (Vidal)
update public.crop_parameter_ranges set min = 0, max = 40 where range_id = 999103;  -- HCO3
update public.crop_parameter_ranges set min = 0, max = 32, unit_id = 1 where range_id = 999105; -- Hardness °f
update public.crop_parameter_ranges set min = 0, max = 480 where range_id = 999106; -- TDS
update public.crop_parameter_ranges set min = 0, max = 50 where range_id = 999107;  -- NO3

-- pH / B when those dynamic inserts exist
update public.crop_parameter_ranges set min = 5.5, max = 7.0 where range_id = 999109;
update public.crop_parameter_ranges set min = 0, max = 0.5 where range_id = 999111;

-- Extra water parameters
insert into public.parameters (
  parameter_id, parameter_name, symbol, category, default_unit_id, soil, foliar, water
)
values
  (108, 'Carbonate', 'CO3', 'Irrigation water', 2, false, false, true),
  (109, 'Fluoride', 'F', 'Irrigation water', 2, false, false, true),
  (110, 'Kelly index', 'Kelly', 'Irrigation water', 1, false, false, true)
on conflict (parameter_id) do update
set water = true,
    parameter_name = excluded.parameter_name,
    symbol = excluded.symbol,
    category = excluded.category;

update public.parameters
set parameter_name = 'Hardness (French °f)',
    symbol = 'Hardness'
where parameter_id = 105;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
values
  (999112, 999, 3, 108, 2, 0, 5, 9, 'medium', false, true),
  (999113, 999, 3, 109, 2, 0, 0.25, 9, 'medium', false, true),
  (999114, 999, 3, 110, 1, 35, 100, 9, 'medium', false, true)
on conflict (range_id) do nothing;

-- Fe water range when Fe is flagged water
insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999115, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 2),
  0, 0.2, 9, 'medium', false, true
from public.parameters p
where p.water = true and lower(p.symbol) = 'fe'
limit 1
on conflict (range_id) do nothing;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999116, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 2),
  20, 100, 9, 'medium', false, true
from public.parameters p
where p.water = true and lower(p.symbol) = 'ca' and p.parameter_id < 200
limit 1
on conflict (range_id) do nothing;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999117, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 2),
  0, 63, 9, 'medium', false, true
from public.parameters p
where p.water = true and lower(p.symbol) = 'mg' and p.parameter_id < 200
limit 1
on conflict (range_id) do nothing;
