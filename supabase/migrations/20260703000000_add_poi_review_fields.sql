alter table public.poi_cache
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists merged_into_amap_poi_id text references public.poi_cache (amap_poi_id) on delete set null,
  add column if not exists source_note text,
  add column if not exists data_source text,
  add column if not exists raw_summary text;

alter table public.poi_cache
  drop constraint if exists poi_cache_review_status_check;

alter table public.poi_cache
  add constraint poi_cache_review_status_check
  check (review_status in ('pending', 'confirmed', 'needs_fix', 'merged', 'ignored'));

create index if not exists idx_poi_cache_review_status_updated
  on public.poi_cache (review_status, "updatedAt" desc);

create index if not exists idx_poi_cache_merged_into
  on public.poi_cache (merged_into_amap_poi_id)
  where merged_into_amap_poi_id is not null;

create index if not exists idx_poi_cache_reviewed_by
  on public.poi_cache (reviewed_by, reviewed_at desc)
  where reviewed_by is not null;

comment on column public.poi_cache.review_status is '后台 POI 审核状态：pending/confirmed/needs_fix/merged/ignored。';
comment on column public.poi_cache.review_note is '后台管理员审核备注。';
comment on column public.poi_cache.merged_into_amap_poi_id is '当前 POI 被判定为重复时，指向保留的 amap_poi_id。';

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
  where coalesce(poi.review_status, 'pending') in ('pending', 'confirmed')
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
