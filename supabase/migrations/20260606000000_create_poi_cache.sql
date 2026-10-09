-- POI 公共缓存表
-- 存储所有用户共享的高德 POI 数据，避免重复调用高德 API
-- 主键为高德 POI ID（amap_poi_id），所有用户可读，登录用户可写

create table public.poi_cache (
  amap_poi_id       text primary key,           -- 高德 POI ID（如 B0FFFDCDD4）
  name              text not null,              -- 地点名称
  address           text,                       -- 地址
  lat               double precision,           -- 纬度
  lng               double precision,           -- 经度
  category          text,                       -- 地点分类（景点/餐厅/酒店等）
  icon_key          text,                       -- 图标键
  poi_group         text,                       -- POI 分组
  poi_type          text,                       -- POI 类型
  details           jsonb,                      -- 详细信息（评分、电话、营业时间等）
  photos            jsonb,                      -- 照片列表
  external_refs     jsonb,                      -- 外部引用
  map_boundary      jsonb,                      -- 地图边界
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  version           integer not null default 1
);
-- RLS 策略：所有人可读，登录用户可写
alter table public.poi_cache enable row level security;
create policy "poi_cache_select"
  on public.poi_cache for select
  using (true);
create policy "poi_cache_insert"
  on public.poi_cache for insert
  with check (auth.uid() is not null);
create policy "poi_cache_update"
  on public.poi_cache for update
  using (auth.uid() is not null);
-- 自动更新触发器
create trigger set_poi_cache_updated_at
  before update on public.poi_cache
  for each row execute function public.set_user_data_updated_at_and_version();
-- 索引
create index idx_poi_cache_name on public.poi_cache (name);
create index idx_poi_cache_category on public.poi_cache (category);
