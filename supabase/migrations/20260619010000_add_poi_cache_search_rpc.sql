alter table public.poi_cache add column if not exists latitude double precision;
alter table public.poi_cache add column if not exists longitude double precision;
alter table public.poi_cache add column if not exists area text;
alter table public.poi_cache add column if not exists "iconKey" text;
alter table public.poi_cache add column if not exists "poiGroup" text;
alter table public.poi_cache add column if not exists "poiType" text;
alter table public.poi_cache add column if not exists "externalRefs" jsonb;
alter table public.poi_cache add column if not exists "updatedAt" timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'lat'
  ) then
    execute 'update public.poi_cache set latitude = coalesce(latitude, lat) where latitude is null and lat is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'lng'
  ) then
    execute 'update public.poi_cache set longitude = coalesce(longitude, lng) where longitude is null and lng is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'icon_key'
  ) then
    execute 'update public.poi_cache set "iconKey" = coalesce("iconKey", icon_key) where "iconKey" is null and icon_key is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'poi_group'
  ) then
    execute 'update public.poi_cache set "poiGroup" = coalesce("poiGroup", poi_group) where "poiGroup" is null and poi_group is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'poi_type'
  ) then
    execute 'update public.poi_cache set "poiType" = coalesce("poiType", poi_type) where "poiType" is null and poi_type is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'external_refs'
  ) then
    execute 'update public.poi_cache set "externalRefs" = coalesce("externalRefs", external_refs) where "externalRefs" is null and external_refs is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_cache' and column_name = 'updated_at'
  ) then
    execute 'update public.poi_cache set "updatedAt" = coalesce("updatedAt", updated_at) where "updatedAt" is null and updated_at is not null';
  end if;
end $$;

create index if not exists idx_poi_cache_lat_lng on public.poi_cache (latitude, longitude);
create index if not exists idx_poi_cache_area on public.poi_cache (area);

create or replace function public.search_poi_cache_entries(
  p_query text default '',
  p_region text default null,
  p_category text default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_limit integer default 8
)
returns table (
  amap_poi_id text,
  name text,
  address text,
  area text,
  latitude double precision,
  longitude double precision,
  category text,
  "iconKey" text,
  "poiGroup" text,
  "poiType" text,
  details jsonb,
  photos jsonb,
  "externalRefs" jsonb,
  "updatedAt" timestamptz,
  score double precision,
  distance_km double precision
)
language sql
stable
security invoker
as $$
with params as (
  select
    lower(regexp_replace(coalesce(trim(p_query), ''), '\s+', '', 'g')) as query_text,
    lower(regexp_replace(coalesce(trim(p_region), ''), '\s+', '', 'g')) as region_text,
    nullif(trim(p_category), '') as category_text,
    case
      when p_center_lat between -90 and 90 and p_center_lng between -180 and 180
      then p_center_lat
      else null
    end as center_lat,
    case
      when p_center_lat between -90 and 90 and p_center_lng between -180 and 180
      then p_center_lng
      else null
    end as center_lng,
    greatest(1, least(coalesce(p_limit, 8), 20)) as result_limit
),
prepared as (
  select
    poi.amap_poi_id,
    poi.name,
    poi.address,
    coalesce(poi.area, poi."externalRefs"->>'amapCityName') as area,
    poi.latitude as latitude,
    poi.longitude as longitude,
    poi.category,
    poi."iconKey" as "iconKey",
    poi."poiGroup" as "poiGroup",
    poi."poiType" as "poiType",
    poi.details,
    poi.photos,
    poi."externalRefs" as "externalRefs",
    poi."updatedAt",
    params.query_text,
    params.region_text,
    params.category_text,
    params.center_lat,
    params.center_lng,
    params.result_limit,
    lower(regexp_replace(coalesce(poi.name, ''), '\s+', '', 'g')) as name_text,
    lower(regexp_replace(coalesce(poi.address, ''), '\s+', '', 'g')) as address_text,
    lower(regexp_replace(coalesce(poi.area, poi."externalRefs"->>'amapCityName', ''), '\s+', '', 'g')) as area_text
  from public.poi_cache poi
  cross join params
),
scored as (
  select
    prepared.*,
    case
      when prepared.center_lat is not null
        and prepared.center_lng is not null
        and prepared.latitude is not null
        and prepared.longitude is not null
      then 6371 * 2 * asin(sqrt(
        power(sin(radians((prepared.latitude - prepared.center_lat) / 2)), 2)
        + cos(radians(prepared.center_lat))
        * cos(radians(prepared.latitude))
        * power(sin(radians((prepared.longitude - prepared.center_lng) / 2)), 2)
      ))
      else null
    end as distance_km
  from prepared
  where
    (prepared.category_text is null or prepared.category = prepared.category_text)
    and (
      prepared.query_text = ''
      or prepared.name_text like '%' || prepared.query_text || '%'
      or prepared.address_text like '%' || prepared.query_text || '%'
      or prepared.area_text like '%' || prepared.query_text || '%'
    )
)
select
  scored.amap_poi_id,
  scored.name,
  scored.address,
  scored.area,
  scored.latitude,
  scored.longitude,
  scored.category,
  scored."iconKey",
  scored."poiGroup",
  scored."poiType",
  scored.details,
  scored.photos,
  scored."externalRefs",
  scored."updatedAt",
  (
    case
      when scored.query_text = '' then 20
      when scored.name_text = scored.query_text then 120
      when scored.name_text like scored.query_text || '%' then 82
      when scored.name_text like '%' || scored.query_text || '%' then 64
      when scored.address_text like '%' || scored.query_text || '%' then 42
      when scored.area_text like '%' || scored.query_text || '%' then 36
      else 0
    end
    + case when scored.region_text <> '' and scored.area_text like '%' || scored.region_text || '%' then 24 else 0 end
    + case when scored.region_text <> '' and scored.address_text like '%' || scored.region_text || '%' then 12 else 0 end
    + case when scored.latitude is not null and scored.longitude is not null then 8 else 0 end
    + case when scored.details is not null then 6 else 0 end
    + case when jsonb_typeof(scored.photos) = 'array' and jsonb_array_length(scored.photos) > 0 then 4 else 0 end
    - coalesce(least(scored.distance_km, 200) / 20, 0)
  )::double precision as score,
  scored.distance_km
from scored
order by
  score desc,
  distance_km asc nulls last,
  scored."updatedAt" desc nulls last
limit (select result_limit from params);
$$;

grant execute on function public.search_poi_cache_entries(text, text, text, double precision, double precision, integer) to anon, authenticated;
