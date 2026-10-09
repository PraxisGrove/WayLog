create or replace function public.merge_poi_cache_entries(payloads jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(payloads) <> 'array' then
    raise exception 'payloads must be a JSON array';
  end if;

  for payload in
    select value
    from jsonb_array_elements(payloads)
  loop
    if nullif(trim(payload->>'amap_poi_id'), '') is null then
      continue;
    end if;

    insert into public.poi_cache as poi (
      amap_poi_id,
      name,
      address,
      latitude,
      longitude,
      category,
      "iconKey",
      "poiGroup",
      "poiType",
      details,
      photos,
      "externalRefs"
    )
    values (
      payload->>'amap_poi_id',
      coalesce(nullif(payload->>'name', ''), '未命名地点'),
      nullif(payload->>'address', ''),
      case
        when jsonb_typeof(payload->'latitude') = 'number' then (payload->>'latitude')::double precision
        else null
      end,
      case
        when jsonb_typeof(payload->'longitude') = 'number' then (payload->>'longitude')::double precision
        else null
      end,
      nullif(payload->>'category', ''),
      nullif(payload->>'iconKey', ''),
      nullif(payload->>'poiGroup', ''),
      nullif(payload->>'poiType', ''),
      case
        when jsonb_typeof(payload->'details') = 'object' and payload->'details' <> '{}'::jsonb then payload->'details'
        else null
      end,
      case
        when jsonb_typeof(payload->'photos') = 'array' and jsonb_array_length(payload->'photos') > 0 then payload->'photos'
        else null
      end,
      case
        when jsonb_typeof(payload->'externalRefs') = 'object' and payload->'externalRefs' <> '{}'::jsonb then payload->'externalRefs'
        else null
      end
    )
    on conflict (amap_poi_id) do update
    set
      name = coalesce(nullif(excluded.name, ''), poi.name),
      address = coalesce(nullif(excluded.address, ''), poi.address),
      latitude = coalesce(excluded.latitude, poi.latitude),
      longitude = coalesce(excluded.longitude, poi.longitude),
      category = coalesce(nullif(excluded.category, ''), poi.category),
      "iconKey" = coalesce(nullif(excluded."iconKey", ''), poi."iconKey"),
      "poiGroup" = coalesce(nullif(excluded."poiGroup", ''), poi."poiGroup"),
      "poiType" = coalesce(nullif(excluded."poiType", ''), poi."poiType"),
      details = case
        when excluded.details is null then poi.details
        when poi.details is null then excluded.details
        else poi.details || excluded.details
      end,
      photos = coalesce(excluded.photos, poi.photos),
      "externalRefs" = case
        when excluded."externalRefs" is null then poi."externalRefs"
        when poi."externalRefs" is null then excluded."externalRefs"
        else poi."externalRefs" || excluded."externalRefs"
      end;
  end loop;
end;
$$;

grant execute on function public.merge_poi_cache_entries(jsonb) to authenticated;;
