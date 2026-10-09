-- 为已应用旧迁移的部署更新通知触发器与定时任务；不创建或复制实际密钥。

-- 可选服务端通知使用 Vault 中的专用凭据，源码不保存部署密钥。
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;
-- Vault 仅供受信任数据库角色使用，客户端角色不能读取或修改通知凭据。
revoke usage on schema vault from public, anon, authenticated;
revoke all on vault.secrets, vault.decrypted_secrets from public, anon, authenticated;

-- 在自有项目 Vault 保存 waylog_supabase_url 和 waylog_internal_webhook_secret；
-- 后者须与 Edge 的 INTERNAL_WEBHOOK_SECRET 一致。
-- 任何一项未配置时，仅保存反馈，不发送外部请求。
create or replace function public.notify_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  webhook_secret text;
  supabase_url text;
begin
  select nullif(btrim(decrypted_secret), '') into supabase_url
  from vault.decrypted_secrets
  where name = 'waylog_supabase_url';
  if supabase_url is null then
    return NEW;
  end if;

  select nullif(btrim(decrypted_secret), '') into webhook_secret
  from vault.decrypted_secrets
  where name = 'waylog_internal_webhook_secret';
  if webhook_secret is null then
    return NEW;
  end if;

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'feedback',
    'record', jsonb_build_object(
      'id', NEW.id,
      'description', NEW.description,
      'contact_method', NEW.contact_method,
      'contact_value', NEW.contact_value,
      'platform', NEW.platform,
      'app_version', NEW.app_version,
      'user_id', NEW.user_id,
      'created_at', NEW.created_at
    )
  );

  -- 网关 JWT 检查关闭，由 handler 验证专用服务端 Bearer 凭据。
  perform net.http_post(
    url := rtrim(supabase_url, '/') || '/functions/v1/feedback-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := payload
  );
  return NEW;
end;
$$;

-- 仅作为表触发器调用，不开放客户端 RPC 执行。
revoke all on function public.notify_feedback_insert() from public, anon, authenticated;
drop trigger if exists feedback_insert_notify on public.feedback;
create trigger feedback_insert_notify
  after insert on public.feedback
  for each row
  execute function public.notify_feedback_insert();

-- 每天北京时间 09:00 的可选统计通知；缺少目标或 Vault 凭据时不发送请求。
create extension if not exists pg_cron;
create extension if not exists pg_net schema extensions;
create extension if not exists supabase_vault with schema vault;
-- Vault 仅供受信任数据库角色使用，客户端角色不能读取或修改通知凭据。
revoke usage on schema vault from public, anon, authenticated;
revoke all on vault.secrets, vault.decrypted_secrets from public, anon, authenticated;

-- 同名任务由 cron.schedule 更新，重复应用不会创建第二个任务。
select cron.schedule(
  'daily-stats-report',
  '0 1 * * *',
  $$
    do $daily_stats$
    declare
      webhook_secret text;
      supabase_url text;
    begin
      select nullif(btrim(decrypted_secret), '') into supabase_url
      from vault.decrypted_secrets
      where name = 'waylog_supabase_url';
      if supabase_url is null then
        return;
      end if;
      select nullif(btrim(decrypted_secret), '') into webhook_secret
      from vault.decrypted_secrets
      where name = 'waylog_internal_webhook_secret';
      if webhook_secret is null then
        return;
      end if;
      perform net.http_post(
        url := rtrim(supabase_url, '/') || '/functions/v1/daily-stats',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || webhook_secret
        ),
        body := '{}'::jsonb
      );
    end;
    $daily_stats$;
  $$
);
