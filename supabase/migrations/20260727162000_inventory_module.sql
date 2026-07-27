-- Full inventory ledger alongside farm_bodega_items (on-hand balance).

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  product_key text,
  default_unit text not null default 'kg',
  min_stock numeric not null default 0,
  unit_cost numeric,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_products_user_idx
  on public.inventory_products (user_id, active);

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.inventory_products (id) on delete cascade,
  farm_id bigint not null references public.farms (farm_id) on delete cascade,
  lot_code text,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  unit_cost numeric,
  expires_on date,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_batches_farm_product_idx
  on public.inventory_batches (user_id, farm_id, product_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.inventory_products (id) on delete cascade,
  farm_id bigint not null references public.farms (farm_id) on delete cascade,
  batch_id uuid references public.inventory_batches (id) on delete set null,
  movement_type text not null check (
    movement_type in ('receive', 'use', 'adjust', 'transfer_out', 'transfer_in')
  ),
  quantity numeric not null,
  unit text not null default 'kg',
  unit_cost numeric,
  related_farm_id bigint references public.farms (farm_id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_farm_idx
  on public.inventory_movements (user_id, farm_id, created_at desc);

alter table public.inventory_products enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "inventory_products_own" on public.inventory_products;
create policy "inventory_products_own"
  on public.inventory_products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "inventory_batches_own" on public.inventory_batches;
create policy "inventory_batches_own"
  on public.inventory_batches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "inventory_movements_own" on public.inventory_movements;
create policy "inventory_movements_own"
  on public.inventory_movements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
