-- Server-side farm merge (name + location). SECURITY DEFINER so analysis_lots
-- remapping is not blocked by partial RLS during multi-step cleanup.

create or replace function public.merge_duplicate_farms_for_user(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged integer := 0;
  r record;
  v_keeper bigint;
  v_donor bigint;
  dlot record;
  v_klot bigint;
begin
  if p_user_id is null then
    return 0;
  end if;
  -- Only the owning user (or service role) may run this.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not allowed';
  end if;

  for r in
    with normalized as (
      select
        farm_id,
        created_at,
        lower(trim(both from farm_name))
          || '||'
          || lower(trim(both from coalesce(location, ''))) as identity_key
      from farms
      where user_id = p_user_id
    ),
    ranked as (
      select
        farm_id as donor_farm_id,
        first_value(farm_id) over (
          partition by identity_key
          order by created_at nulls last, farm_id
        ) as keep_farm_id,
        row_number() over (
          partition by identity_key
          order by created_at nulls last, farm_id
        ) as rn
      from normalized
    )
    select donor_farm_id, keep_farm_id
    from ranked
    where rn > 1
    order by keep_farm_id, donor_farm_id
  loop
    v_keeper := r.keep_farm_id;
    v_donor := r.donor_farm_id;

    for dlot in
      select lot_id, lot_name from lots where farm_id = v_donor
    loop
      select l.lot_id into v_klot
      from lots l
      where l.farm_id = v_keeper
        and lower(trim(both from l.lot_name)) = lower(trim(both from dlot.lot_name))
      limit 1;

      if v_klot is not null then
        update analyses set lot_id = v_klot where lot_id = dlot.lot_id;

        -- Never create a second primary lot assignment for the same analysis.
        insert into analysis_lots (analysis_id, lot_id, is_primary)
        select al.analysis_id, v_klot, false
        from analysis_lots al
        where al.lot_id = dlot.lot_id
          and not exists (
            select 1 from analysis_lots x
            where x.analysis_id = al.analysis_id and x.lot_id = v_klot
          );

        delete from analysis_lots where lot_id = dlot.lot_id;
        delete from lots where lot_id = dlot.lot_id;
      else
        update lots set farm_id = v_keeper where lot_id = dlot.lot_id;
      end if;
    end loop;

    update analyses set farm_id = v_keeper where farm_id = v_donor;

    if to_regclass('public.farm_bodega_items') is not null then
      update farm_bodega_items set farm_id = v_keeper where farm_id = v_donor;
    end if;

    delete from farms where farm_id = v_donor and user_id = p_user_id;
    v_merged := v_merged + 1;
  end loop;

  return v_merged;
end;
$$;

revoke all on function public.merge_duplicate_farms_for_user(uuid) from public;
grant execute on function public.merge_duplicate_farms_for_user(uuid) to authenticated;
grant execute on function public.merge_duplicate_farms_for_user(uuid) to service_role;
