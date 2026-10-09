-- ============================================================================
-- Migration: 20260603000000_create_user_expense_preferences.sql
-- Description: Create user-level expense preference storage.
--
-- Expense preferences are account settings rather than trip entities. Each user
-- gets one JSONB payload row, protected by RLS and updated through Supabase REST.
-- ============================================================================

create table if not exists public.user_expense_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists set_user_expense_preferences_updated_at on public.user_expense_preferences;
create trigger set_user_expense_preferences_updated_at
  before update on public.user_expense_preferences
  for each row
  execute function public.set_user_data_updated_at_and_version();
alter table public.user_expense_preferences enable row level security;
create policy "Users can read their own expense preferences"
  on public.user_expense_preferences
  for select
  using (auth.uid() = user_id);
create policy "Users can insert their own expense preferences"
  on public.user_expense_preferences
  for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own expense preferences"
  on public.user_expense_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own expense preferences"
  on public.user_expense_preferences
  for delete
  using (auth.uid() = user_id);
