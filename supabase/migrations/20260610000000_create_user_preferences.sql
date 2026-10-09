-- ============================================================================
-- Migration: 20260610000000_create_user_preferences.sql
-- Description: Create unified user preference storage.
--
-- This table consolidates all user-level preferences into a single table.
-- Each preference type is identified by a unique key (preference_key).
-- The payload column stores the preference data as JSONB.
-- ============================================================================

create table if not exists public.user_preferences (
  user_id uuid references auth.users (id) on delete cascade,
  preference_key text not null,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, preference_key)
);

-- Create trigger for updated_at and version
drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row
  execute function public.set_user_data_updated_at_and_version();

-- Enable Row Level Security
alter table public.user_preferences enable row level security;

-- Create RLS policies
create policy "Users can read their own preferences"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on public.user_preferences
  for delete
  using (auth.uid() = user_id);

-- Create index for efficient querying
create index if not exists idx_user_preferences_user_id on public.user_preferences (user_id);
create index if not exists idx_user_preferences_key on public.user_preferences (preference_key);

-- ============================================================================
-- Migration data: Migrate existing preferences to the new table
-- ============================================================================

-- Migrate route preferences
insert into public.user_preferences (user_id, preference_key, payload, version, created_at, updated_at)
select
  user_id,
  'route' as preference_key,
  payload,
  version,
  created_at,
  updated_at
from public.user_route_preferences
on conflict (user_id, preference_key) do nothing;

-- Migrate expense preferences
insert into public.user_preferences (user_id, preference_key, payload, version, created_at, updated_at)
select
  user_id,
  'expense' as preference_key,
  payload,
  version,
  created_at,
  updated_at
from public.user_expense_preferences
on conflict (user_id, preference_key) do nothing;

-- ============================================================================
-- Note: After confirming the migration is successful, you can drop the old tables:
-- drop table if exists public.user_route_preferences;
-- drop table if exists public.user_expense_preferences;
-- ============================================================================