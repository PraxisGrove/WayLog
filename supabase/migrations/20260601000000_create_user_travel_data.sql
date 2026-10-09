create table if not exists public.user_trips (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  title text not null default '',
  destination text not null default '',
  status text not null default '',
  start_date date,
  end_date date,
  pinned_at timestamptz,
  payload jsonb not null,
  version bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists user_trips_user_updated_at_idx
  on public.user_trips (user_id, updated_at desc);
create index if not exists user_trips_user_deleted_at_idx
  on public.user_trips (user_id, deleted_at);
create table if not exists public.user_favorite_places (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null default '',
  category text not null default '',
  area text,
  address text,
  latitude double precision,
  longitude double precision,
  provider_place_id text,
  payload jsonb not null,
  version bigint not null default 1,
  deleted_at timestamptz,
  favorited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists user_favorite_places_user_updated_at_idx
  on public.user_favorite_places (user_id, updated_at desc);
create index if not exists user_favorite_places_user_deleted_at_idx
  on public.user_favorite_places (user_id, deleted_at);
create index if not exists user_favorite_places_user_provider_idx
  on public.user_favorite_places (user_id, provider_place_id);
create or replace function public.set_user_data_updated_at_and_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if tg_op = 'UPDATE' then
    new.version = old.version + 1;
  end if;

  return new;
end;
$$;
drop trigger if exists set_user_trips_updated_at on public.user_trips;
create trigger set_user_trips_updated_at
  before update on public.user_trips
  for each row
  execute function public.set_user_data_updated_at_and_version();
drop trigger if exists set_user_favorite_places_updated_at on public.user_favorite_places;
create trigger set_user_favorite_places_updated_at
  before update on public.user_favorite_places
  for each row
  execute function public.set_user_data_updated_at_and_version();
alter table public.user_trips enable row level security;
alter table public.user_favorite_places enable row level security;
create policy "Users can read their own trips"
  on public.user_trips
  for select
  using (auth.uid() = user_id);
create policy "Users can insert their own trips"
  on public.user_trips
  for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own trips"
  on public.user_trips
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own trips"
  on public.user_trips
  for delete
  using (auth.uid() = user_id);
create policy "Users can read their own favorite places"
  on public.user_favorite_places
  for select
  using (auth.uid() = user_id);
create policy "Users can insert their own favorite places"
  on public.user_favorite_places
  for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own favorite places"
  on public.user_favorite_places
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own favorite places"
  on public.user_favorite_places
  for delete
  using (auth.uid() = user_id);
