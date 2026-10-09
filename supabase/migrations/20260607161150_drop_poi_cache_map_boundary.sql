-- 删除 poi_cache 表的 mapBoundary 字段
-- AOI 边界查询需要额外调用 /v5/aoi/polyline API，消耗高德额度
-- 该功能未启用，字段从未有数据，清理掉

alter table public.poi_cache drop column if exists "mapBoundary";;
