-- Planning modules (create if missing) with text ids + schedule metadata.
-- Also link bodega items to catalog product keys for cost optimization.

create table if not exists public.calendar_events (
  id text primary key,
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
  sequence int,
  stage_key text,
  stage_label text,
  plan_id text,
  farm_id bigint,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notes (
  id text primary key,
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
  id text primary key,
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

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'calendar_events_own'
  ) then
    create policy "calendar_events_own" on public.calendar_events for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_notes' and policyname = 'user_notes_own'
  ) then
    create policy "user_notes_own" on public.user_notes for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_notifications' and policyname = 'app_notifications_own'
  ) then
    create policy "app_notifications_own" on public.app_notifications for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- If an older uuid-based draft exists locally, coerce to text + add columns.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'id'
      and data_type = 'uuid'
  ) then
    alter table public.calendar_events alter column id drop default;
    alter table public.calendar_events alter column id type text using id::text;
  end if;
end $$;

alter table public.calendar_events
  add column if not exists sequence int,
  add column if not exists stage_key text,
  add column if not exists stage_label text,
  add column if not exists plan_id text,
  add column if not exists farm_id bigint,
  add column if not exists lines jsonb not null default '[]'::jsonb;

alter table public.farm_bodega_items
  add column if not exists product_key text;

create index if not exists farm_bodega_items_product_key_idx
  on public.farm_bodega_items (farm_id, product_key)
  where product_key is not null;
