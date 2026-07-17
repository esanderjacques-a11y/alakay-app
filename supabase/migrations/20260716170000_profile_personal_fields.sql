-- Extended profile fields (signup + account settings).
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists middle_name text,
  add column if not exists profession text,
  add column if not exists country text,
  add column if not exists province_state text,
  add column if not exists location_source text,
  add column if not exists preferred_language text,
  add column if not exists accepts_policies boolean,
  add column if not exists accepts_emails boolean,
  add column if not exists birthday date,
  add column if not exists phone text,
  add column if not exists organization text;
