create or replace function public.set_poi_cache_updated_at_and_version()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();

  if tg_op = 'UPDATE' then
    new.version = old.version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists set_poi_cache_updated_at on public.poi_cache;

create trigger set_poi_cache_updated_at
  before update on public.poi_cache
  for each row
  execute function public.set_poi_cache_updated_at_and_version();;
