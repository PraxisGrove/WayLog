-- 创建 exec_sql RPC 函数，用于 Edge Function 执行只读 SQL 查询
-- 安全策略：仅允许 SELECT 查询，防止注入和数据篡改
-- 调用方通过 service_role_key 认证（RLS 绕过）

CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  trimmed_query TEXT;
BEGIN
  -- 去除前后空白和换行
  trimmed_query := TRIM(BOTH FROM query);
  trimmed_query := REGEXP_REPLACE(trimmed_query, E'\\s+', ' ', 'g');

  -- 安全检查：只允许 SELECT 查询
  IF NOT (UPPER(trimmed_query) LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed, got: %', LEFT(trimmed_query, 50);
  END IF;

  -- 执行查询并返回 JSON 数组
  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t' INTO result;
  RETURN result;
END;
$$;

-- 限制只有 service_role 可以调用
REVOKE EXECUTE ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
