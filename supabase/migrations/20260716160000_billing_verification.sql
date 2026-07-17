-- Billing, subscriptions, payment methods, invoices, and verification programs.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free'
    check (plan_id in ('free', 'plus', 'premium', 'business')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'paused')),
  billing_cycle text not null default 'none'
    check (billing_cycle in ('monthly', 'yearly', 'none')),
  price_monthly numeric(10, 2),
  renewal_date timestamptz,
  cancelled_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null
    check (brand in ('visa', 'mastercard', 'amex', 'paypal', 'apple_pay', 'google_pay', 'stripe')),
  label text not null,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean not null default false,
  billing_address jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_number text not null,
  amount_cents int not null,
  currency text not null default 'USD',
  status text not null default 'paid'
    check (status in ('paid', 'open', 'void', 'draft')),
  issued_at timestamptz not null default now(),
  download_url text
);

create unique index if not exists invoices_user_number_idx
  on public.invoices (user_id, invoice_number);

create table if not exists public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program text not null
    check (program in ('haiti_farmer', 'earth_university')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  full_name text not null,
  email text not null,
  country text not null,
  institution text,
  student_id text,
  message text,
  admin_notes text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_applications_user_idx
  on public.verification_applications (user_id, created_at desc);

create index if not exists verification_applications_status_idx
  on public.verification_applications (status, created_at desc);

alter table public.profiles
  add column if not exists verification_program text,
  add column if not exists verification_status text default 'none',
  add column if not exists verification_badge text;

create or replace function public.set_billing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_billing_updated_at();

drop trigger if exists verification_applications_updated_at on public.verification_applications;
create trigger verification_applications_updated_at
  before update on public.verification_applications
  for each row
  execute function public.set_billing_updated_at();

alter table public.subscriptions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.invoices enable row level security;
alter table public.verification_applications enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
  on public.subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
  on public.subscriptions for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "payment_methods_select_own" on public.payment_methods;
create policy "payment_methods_select_own"
  on public.payment_methods for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "payment_methods_insert_own" on public.payment_methods;
create policy "payment_methods_insert_own"
  on public.payment_methods for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "payment_methods_update_own" on public.payment_methods;
create policy "payment_methods_update_own"
  on public.payment_methods for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "payment_methods_delete_own" on public.payment_methods;
create policy "payment_methods_delete_own"
  on public.payment_methods for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own"
  on public.invoices for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "verification_select_own" on public.verification_applications;
create policy "verification_select_own"
  on public.verification_applications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "verification_insert_own" on public.verification_applications;
create policy "verification_insert_own"
  on public.verification_applications for insert to authenticated
  with check (auth.uid() = user_id);
