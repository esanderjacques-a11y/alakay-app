-- Farm bodega (warehouse / on-farm stock) per farm, scoped by user.

create table if not exists public.farm_bodega_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  farm_id bigint not null references public.farms (farm_id) on delete cascade,
  product_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farm_bodega_items_farm_idx
  on public.farm_bodega_items (farm_id, product_name);

create index if not exists farm_bodega_items_user_idx
  on public.farm_bodega_items (user_id, farm_id);

alter table public.farm_bodega_items enable row level security;

create policy "farm_bodega_items_own"
  on public.farm_bodega_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
