create table if not exists public.crash_reports (
  id uuid primary key default gen_random_uuid(),
  sentry_event_id text not null unique,
  issue_id text,
  project_slug text,
  level text,
  title text not null,
  culprit text,
  platform text,
  environment text,
  release text,
  user_id uuid references auth.users (id) on delete set null,
  sentry_url text,
  event_timestamp timestamptz,
  payload_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crash_reports_created_at_idx
  on public.crash_reports (created_at desc);

create index if not exists crash_reports_user_id_idx
  on public.crash_reports (user_id)
  where user_id is not null;

alter table public.crash_reports enable row level security;

create policy "Users can read their own crash reports"
  on public.crash_reports
  for select
  using (auth.uid() = user_id);
