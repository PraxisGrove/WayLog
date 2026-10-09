-- ============================================================================
-- 迁移: 20260606010000_enable_realtime.sql
-- 描述: 为用户数据表开启 Realtime 功能
--
-- 开启的表：
-- 1. public.profiles — 用户资料
-- 2. public.user_trips — 用户行程数据
-- 3. public.user_favorite_places — 用户收藏地点
-- 4. public.user_route_preferences — 用户路线偏好
-- 5. public.user_expense_preferences — 用户费用偏好
--
-- 不开启的表：
-- - public.poi_cache — 公共缓存表，所有用户共享，不需要实时推送
--
-- 原理：
-- Supabase Realtime 基于 PostgreSQL 的逻辑复制（Logical Replication）。
-- 通过创建 publication 并将表添加进去，数据库的 INSERT/UPDATE/DELETE 事件
-- 会被推送到 Supabase Realtime 服务器，再通过 WebSocket 分发给订阅的客户端。
--
-- 安全性：
-- - 用户只能接收到自己数据的变更事件（通过 RLS 策略过滤）
-- - Realtime 连接需要有效的 JWT token
-- ============================================================================

-- 创建 publication（如果不存在）
-- supabase_realtime 是 Supabase 默认的 publication 名称
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;
-- 将用户相关表添加到 publication
-- 如果已经添加过，会静默跳过（不会报错）

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.user_trips;
alter publication supabase_realtime add table public.user_favorite_places;
alter publication supabase_realtime add table public.user_route_preferences;
alter publication supabase_realtime add table public.user_expense_preferences;
-- ============================================================================
-- 验证：检查哪些表已开启 Realtime
-- 运行以下 SQL 可以查看：
--   select * from pg_publication_tables where pubname = 'supabase_realtime';
-- ============================================================================;
