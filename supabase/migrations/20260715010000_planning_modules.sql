-- Planning modules: calendar events, notes/reminders, in-app notifications
-- RLS by authenticated user. Guests keep localStorage-only for now.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  event_date date not null,
  farm_name text,
  lot_name text,
  nutrient text,
  rate text,
  method text,
  place_note text,
  source text not null default 'manual' check (source in ('recommended', 'manual')),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  farm_name text,
  lot_name text,
  remind_at timestamptz,
  source text not null default 'manual' check (source in ('recommended', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'general',
  href_step text,
  related_id text,
  due_at timestamptz,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_date_idx
  on public.calendar_events (user_id, event_date);

create index if not exists user_notes_user_remind_idx
  on public.user_notes (user_id, remind_at);

create index if not exists app_notifications_user_read_idx
  on public.app_notifications (user_id, read, due_at);

alter table public.calendar_events enable row level security;
alter table public.user_notes enable row level security;
alter table public.app_notifications enable row level security;

create policy "calendar_events_own"
  on public.calendar_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_notes_own"
  on public.user_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "app_notifications_own"
  on public.app_notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- TODO(depot): farm stock / inventory tables will link to cost optimizer later.
