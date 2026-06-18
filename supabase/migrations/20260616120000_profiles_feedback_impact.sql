-- Profiles (avatar sync), public feedback comments, and impact-friendly indexes.
-- Run in Supabase SQL editor or via: supabase db push

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public feedback / comments
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text,
  email text,
  country text,
  message text not null check (char_length(trim(message)) between 3 and 2000),
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  language text,
  is_approved boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists app_feedback_created_at_idx
  on public.app_feedback (created_at desc);

create index if not exists app_feedback_featured_idx
  on public.app_feedback (is_featured, is_approved, created_at desc)
  where is_featured = true and is_approved = true;

alter table public.app_feedback enable row level security;

drop policy if exists "app_feedback_select_approved" on public.app_feedback;
create policy "app_feedback_select_approved"
  on public.app_feedback for select
  to anon, authenticated
  using (is_approved = true);

drop policy if exists "app_feedback_insert_auth" on public.app_feedback;
create policy "app_feedback_insert_auth"
  on public.app_feedback for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Impact: speed up country aggregation on saved analyses
create index if not exists analyses_country_impact_idx
  on public.analyses (country, province_state)
  where is_deleted = false and country is not null;
