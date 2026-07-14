-- Allow one analysis/report to be assigned to multiple lots in the same farm.
-- analyses.lot_id remains as the primary lot for backward compatibility.

create table if not exists public.analysis_lots (
  analysis_id bigint not null
    references public.analyses(analysis_id) on delete cascade,
  lot_id bigint not null
    references public.lots(lot_id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (analysis_id, lot_id)
);

create index if not exists analysis_lots_lot_id_idx
  on public.analysis_lots(lot_id);

create unique index if not exists analysis_lots_one_primary_idx
  on public.analysis_lots(analysis_id)
  where is_primary;

insert into public.analysis_lots (analysis_id, lot_id, is_primary)
select analysis_id, lot_id, true
from public.analyses
where lot_id is not null
on conflict (analysis_id, lot_id) do nothing;

alter table public.analysis_lots enable row level security;

create policy "Users can read their analysis lot assignments"
on public.analysis_lots
for select
to authenticated
using (
  exists (
    select 1
    from public.analyses
    where analyses.analysis_id = analysis_lots.analysis_id
      and analyses.user_id = (select auth.uid())
  )
);

create policy "Users can create analysis lot assignments"
on public.analysis_lots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.analyses
    join public.lots on lots.farm_id = analyses.farm_id
    join public.farms on farms.farm_id = lots.farm_id
    where analyses.analysis_id = analysis_lots.analysis_id
      and lots.lot_id = analysis_lots.lot_id
      and analyses.user_id = (select auth.uid())
      and farms.user_id = (select auth.uid())
  )
);

create policy "Users can update their analysis lot assignments"
on public.analysis_lots
for update
to authenticated
using (
  exists (
    select 1
    from public.analyses
    where analyses.analysis_id = analysis_lots.analysis_id
      and analyses.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.analyses
    join public.lots on lots.farm_id = analyses.farm_id
    join public.farms on farms.farm_id = lots.farm_id
    where analyses.analysis_id = analysis_lots.analysis_id
      and lots.lot_id = analysis_lots.lot_id
      and analyses.user_id = (select auth.uid())
      and farms.user_id = (select auth.uid())
  )
);

create policy "Users can delete their analysis lot assignments"
on public.analysis_lots
for delete
to authenticated
using (
  exists (
    select 1
    from public.analyses
    where analyses.analysis_id = analysis_lots.analysis_id
      and analyses.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete
on table public.analysis_lots
to authenticated;
