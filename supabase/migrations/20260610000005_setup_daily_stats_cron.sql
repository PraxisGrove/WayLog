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
