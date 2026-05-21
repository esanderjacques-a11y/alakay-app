-- Track when a report was moved to trash (30-day retention before permanent delete).
alter table public.analyses
  add column if not exists deleted_at timestamptz;

create index if not exists analyses_deleted_at_idx
  on public.analyses (user_id, is_deleted, deleted_at)
  where is_deleted = true;
