create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '旅行者',
  avatar_url text,
  bio text,
  home_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can read their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('phone', 'wechat')),
  provider_uid text not null,
  union_id text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_uid)
);
alter table public.auth_identities enable row level security;
create policy "Users can read their own auth identities"
  on public.auth_identities
  for select
  using (auth.uid() = user_id);
drop trigger if exists set_auth_identities_updated_at on public.auth_identities;
create trigger set_auth_identities_updated_at
  before update on public.auth_identities
  for each row
  execute function public.set_updated_at();
