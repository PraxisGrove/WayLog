create table if not exists public.agent_turn_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('minute', 'day')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket, window_start)
);

create index if not exists idx_agent_turn_rate_limits_updated_at
  on public.agent_turn_rate_limits (updated_at);

alter table public.agent_turn_rate_limits enable row level security;

create or replace function public.consume_agent_turn_quota(
  p_minute_limit integer default 6,
  p_daily_limit integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_day_start timestamptz := date_trunc('day', v_now);
  v_minute_count integer := 0;
  v_day_count integer := 0;
  v_retry_after integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_minute_limit <= 0 or p_daily_limit <= 0 then
    raise exception 'Rate limits must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  delete from public.agent_turn_rate_limits
  where updated_at < v_now - interval '3 days';

  select request_count into v_minute_count
  from public.agent_turn_rate_limits
  where user_id = v_user_id
    and bucket = 'minute'
    and window_start = v_minute_start;

  select request_count into v_day_count
  from public.agent_turn_rate_limits
  where user_id = v_user_id
    and bucket = 'day'
    and window_start = v_day_start;

  if coalesce(v_minute_count, 0) >= p_minute_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_minute_start + interval '1 minute' - v_now)))::integer);

    return jsonb_build_object(
      'allowed', false,
      'bucket', 'minute',
      'limit', p_minute_limit,
      'remaining', 0,
      'retryAfterSeconds', v_retry_after
    );
  end if;

  if coalesce(v_day_count, 0) >= p_daily_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_day_start + interval '1 day' - v_now)))::integer);

    return jsonb_build_object(
      'allowed', false,
      'bucket', 'day',
      'limit', p_daily_limit,
      'remaining', 0,
      'retryAfterSeconds', v_retry_after
    );
  end if;

  insert into public.agent_turn_rate_limits (user_id, bucket, window_start, request_count, updated_at)
  values (v_user_id, 'minute', v_minute_start, 1, v_now)
  on conflict (user_id, bucket, window_start) do update
    set request_count = public.agent_turn_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into v_minute_count;

  insert into public.agent_turn_rate_limits (user_id, bucket, window_start, request_count, updated_at)
  values (v_user_id, 'day', v_day_start, 1, v_now)
  on conflict (user_id, bucket, window_start) do update
    set request_count = public.agent_turn_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into v_day_count;

  return jsonb_build_object(
    'allowed', true,
    'minuteLimit', p_minute_limit,
    'minuteRemaining', greatest(0, p_minute_limit - v_minute_count),
    'dailyLimit', p_daily_limit,
    'dailyRemaining', greatest(0, p_daily_limit - v_day_count)
  );
end;
$$;

revoke all on function public.consume_agent_turn_quota(integer, integer) from public;
grant execute on function public.consume_agent_turn_quota(integer, integer) to authenticated;
