-- Align Mehlich III Ca adequate band with Tabla N.° 1 document (6–16 cmol(+)/kg).
update public.sf_nutrient_interpretation
set
  low_max = 5.9,
  adequate_min = 6,
  adequate_max = 16,
  high_min = 16.1
where source_key = 'sue302_villasenor'
  and extractant = 'mehlich3'
  and parameter_key = 'ca';
