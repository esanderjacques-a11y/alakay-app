-- Named saved fertilization calendars + link events via calendar_id

create table if not exists public.saved_calendars (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  farm_name text not null default '',
  lot_name text,
  crop_name text,
  start_date date,
  end_date date,
  purpose text,
  cycle_mode text,
  responsible text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_calendars_user_farm_idx
  on public.saved_calendars (user_id, farm_name);

alter table public.saved_calendars enable row level security;

drop policy if exists "saved_calendars_own" on public.saved_calendars;
create policy "saved_calendars_own"
  on public.saved_calendars for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.calendar_events
  add column if not exists calendar_id text;

create index if not exists calendar_events_user_calendar_idx
  on public.calendar_events (user_id, calendar_id);
