-- Phase 1: irrigation water sample type + parameters + ranges
-- Phase 2 seed (hydroponic) included with water_mode markers via parameter category.

-- 1) sample_types id 3
insert into public.sample_types (sample_type_id, sample_type_code, sample_type_name)
values (3, 'water', 'Water')
on conflict (sample_type_id) do update
set sample_type_code = excluded.sample_type_code,
    sample_type_name = excluded.sample_type_name;

-- Some projects use `code` instead of sample_type_code — ignore if column missing via DO block fallback.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sample_types' and column_name = 'code'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sample_types' and column_name = 'sample_type_code'
  ) then
    execute $q$
      insert into public.sample_types (sample_type_id, code, name)
      values (3, 'water', 'Water')
      on conflict (sample_type_id) do update set code = 'water', name = 'Water'
    $q$;
  end if;
exception when others then
  -- sample_types shape varies; app uses sample_type_id = 3 convention
  null;
end $$;

-- 2) parameters.water boolean
alter table public.parameters
  add column if not exists water boolean not null default false;

-- Flag existing irrigation-relevant params as water where present
update public.parameters
set water = true
where lower(coalesce(symbol, '')) in (
  'ph', 'ec', 'ce', 'na', 'ca', 'mg', 'k', 'b', 'fe', 'mn', 'cl', 'hco3', 'so4', 'sar', 'tds', 'no3-n', 'no3'
)
or lower(coalesce(parameter_name, '')) in (
  'ph', 'electrical conductivity', 'conductivity', 'sodium', 'calcium', 'magnesium',
  'potassium', 'boron', 'iron', 'manganese', 'chloride', 'bicarbonate', 'alkalinity',
  'sulfate', 'sulphate', 'sar', 'sodium adsorption ratio', 'hardness', 'tds',
  'nitrate-n', 'nitrate nitrogen'
);

-- 3) Source for irrigation water guidance
insert into public.sources (source_id, source_name, institution, url)
values (
  9,
  'Irrigation water quality guidelines (FAO / extension-style restriction classes)',
  'FAO Irrigation and Drainage Paper 29; USDA / extension salinity guidance',
  'https://www.fao.org/4/t0234e/t0234e00.htm'
)
on conflict (source_id) do nothing;

-- 4) Seed water-only parameters (high ids to avoid collisions)
insert into public.parameters (
  parameter_id, parameter_name, symbol, category, default_unit_id, soil, foliar, water
)
values
  (101, 'SAR', 'SAR', 'Irrigation water', 1, false, false, true),
  (102, 'Chloride', 'Cl', 'Irrigation water', 2, false, false, true),
  (103, 'Bicarbonate / Alkalinity', 'HCO3', 'Irrigation water', 2, false, false, true),
  (104, 'Sulfate', 'SO4', 'Irrigation water', 2, false, false, true),
  (105, 'Hardness (as CaCO3)', 'Hardness', 'Irrigation water', 2, false, false, true),
  (106, 'TDS', 'TDS', 'Irrigation water', 2, false, false, true),
  (107, 'Nitrate-N', 'NO3-N', 'Irrigation water', 2, false, false, true)
on conflict (parameter_id) do update
set water = true,
    parameter_name = excluded.parameter_name,
    symbol = excluded.symbol,
    category = excluded.category;

-- Ensure pH / EC exist for water (soft update if already present)
update public.parameters set water = true
where parameter_id in (
  select parameter_id from public.parameters
  where lower(symbol) in ('ph', 'ec', 'ce')
     or lower(parameter_name) like '%electrical conductivity%'
     or lower(parameter_name) = 'ph'
);

-- Aliases for OCR / import
insert into public.parameter_aliases (alias_id, parameter_id, language, alias_name, alias_type, source, priority)
values
  (2001, 101, 'en', 'SAR', 'symbol', 'seed', 1),
  (2002, 101, 'en', 'Sodium Adsorption Ratio', 'label', 'seed', 1),
  (2003, 101, 'es', 'RAS', 'symbol', 'seed', 1),
  (2004, 101, 'es', 'Relación de adsorción de sodio', 'label', 'seed', 1),
  (2005, 102, 'en', 'Chloride', 'label', 'seed', 1),
  (2006, 102, 'en', 'Cl', 'symbol', 'seed', 1),
  (2007, 102, 'es', 'Cloruro', 'label', 'seed', 1),
  (2008, 103, 'en', 'Bicarbonate', 'label', 'seed', 1),
  (2009, 103, 'en', 'Alkalinity', 'label', 'seed', 2),
  (2010, 103, 'en', 'HCO3', 'symbol', 'seed', 1),
  (2011, 103, 'es', 'Bicarbonato', 'label', 'seed', 1),
  (2012, 103, 'es', 'Alcalinidad', 'label', 'seed', 2),
  (2013, 104, 'en', 'Sulfate', 'label', 'seed', 1),
  (2014, 104, 'en', 'SO4', 'symbol', 'seed', 1),
  (2015, 104, 'es', 'Sulfato', 'label', 'seed', 1),
  (2016, 105, 'en', 'Hardness', 'label', 'seed', 1),
  (2017, 105, 'en', 'Hardness as CaCO3', 'label', 'seed', 2),
  (2018, 105, 'es', 'Dureza', 'label', 'seed', 1),
  (2019, 106, 'en', 'TDS', 'symbol', 'seed', 1),
  (2020, 106, 'en', 'Total Dissolved Solids', 'label', 'seed', 1),
  (2021, 107, 'en', 'Nitrate-N', 'label', 'seed', 1),
  (2022, 107, 'en', 'NO3-N', 'symbol', 'seed', 1),
  (2023, 107, 'es', 'Nitrato-N', 'label', 'seed', 1)
on conflict (alias_id) do nothing;

-- 5) Irrigation water ranges for General crop 999 (suitable band = min/max)
-- EC dS/m suitable < 0.7 (use unit_id 1 as dimensionless/dS if needed — prefer existing EC unit)
-- Using unit_id 2 (ppm/mg/L) for ions; SAR dimensionless unit_id 1

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
values
  (999101, 999, 3, 101, 1, 0, 3, 9, 'medium', false, true),      -- SAR suitable < 3
  (999102, 999, 3, 102, 2, 0, 140, 9, 'medium', false, true),    -- Cl mg/L
  (999103, 999, 3, 103, 2, 0, 90, 9, 'medium', false, true),     -- HCO3 mg/L
  (999104, 999, 3, 104, 2, 0, 200, 9, 'medium', false, true),    -- SO4
  (999105, 999, 3, 105, 2, 0, 150, 9, 'medium', false, true),    -- Hardness soft-moderate
  (999106, 999, 3, 106, 2, 0, 450, 9, 'medium', false, true),    -- TDS
  (999107, 999, 3, 107, 2, 0, 5, 9, 'medium', false, true)       -- NO3-N mg/L
on conflict (range_id) do nothing;

-- Attach EC / pH / Na / B water ranges when those parameters exist
insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999108, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 1),
  0, 0.7, 9, 'medium', false, true
from public.parameters p
where p.water = true
  and (lower(p.symbol) in ('ec', 'ce') or lower(p.parameter_name) like '%electrical conductivity%')
limit 1
on conflict (range_id) do nothing;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999109, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 1),
  6.5, 8.4, 9, 'medium', false, true
from public.parameters p
where p.water = true and lower(p.symbol) = 'ph'
limit 1
on conflict (range_id) do nothing;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999110, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 2),
  0, 70, 9, 'medium', false, true
from public.parameters p
where p.water = true and lower(p.symbol) = 'na' and p.parameter_id < 100
limit 1
on conflict (range_id) do nothing;

insert into public.crop_parameter_ranges (
  range_id, crop_id, sample_type_id, parameter_id, unit_id,
  min, max, source_id, confidence, is_proxy, active
)
select
  999111, 999, 3, p.parameter_id, coalesce(p.default_unit_id, 2),
  0, 0.7, 9, 'medium', false, true
from public.parameters p
where p.water = true and lower(p.symbol) = 'b'
limit 1
on conflict (range_id) do nothing;

-- 6) Widen custom parameter/range sample_type checks if present
do $$
declare
  con_name text;
begin
  for con_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('user_custom_parameters', 'user_custom_ranges')
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%sample_type%'
  loop
    execute format('alter table public.%I drop constraint if exists %I',
      (select relname from pg_class where oid = (select conrelid from pg_constraint where conname = con_name limit 1)),
      con_name);
  end loop;
exception when others then
  null;
end $$;

alter table public.user_custom_parameters drop constraint if exists user_custom_parameters_sample_type_check;
alter table public.user_custom_ranges drop constraint if exists user_custom_ranges_sample_type_check;

do $$
begin
  alter table public.user_custom_parameters
    add constraint user_custom_parameters_sample_type_check
    check (sample_type in ('soil', 'foliar', 'water'));
exception when others then null;
end $$;

do $$
begin
  alter table public.user_custom_ranges
    add constraint user_custom_ranges_sample_type_check
    check (sample_type in ('soil', 'foliar', 'water'));
exception when others then null;
end $$;

-- 7) Extend get_range_match to accept 'water' when the function exists
-- Recreate a thin wrapper only if we can detect the existing signature.
do $$
declare
  fn_oid oid;
  src text;
begin
  select p.oid into fn_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_range_match'
  limit 1;
  if fn_oid is null then
    raise notice 'get_range_match not found — skip RPC update; map water→3 in app when recreating.';
    return;
  end if;
  src := pg_get_functiondef(fn_oid);
  if src ilike '%water%' then
    raise notice 'get_range_match already mentions water';
    return;
  end if;
  raise notice 'Update get_range_match manually to map input_sample_type ''water'' → sample_type_id 3. Function left unchanged to avoid breaking signature.';
end $$;
