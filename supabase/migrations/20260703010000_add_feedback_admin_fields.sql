alter table public.feedback
  add column if not exists status text not null default 'pending',
  add column if not exists severity text not null default 'normal',
  add column if not exists admin_note text,
  add column if not exists reply_message text,
  add column if not exists source_page text,
  add column if not exists device_info jsonb,
  add column if not exists related_poi_id text references public.poi_cache (amap_poi_id) on delete set null,
  add column if not exists related_agent_call_id bigint references public.agent_calls (id) on delete set null,
  add column if not exists related_trip_id text,
  add column if not exists assigned_to uuid references auth.users (id) on delete set null,
  add column if not exists handled_by uuid references auth.users (id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.feedback
  drop constraint if exists feedback_status_check;

alter table public.feedback
  add constraint feedback_status_check
  check (status in ('pending', 'in_progress', 'resolved', 'ignored'));

alter table public.feedback
  drop constraint if exists feedback_severity_check;

alter table public.feedback
  add constraint feedback_severity_check
  check (severity in ('normal', 'important', 'blocking'));

create or replace function public.set_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_feedback_updated_at on public.feedback;
create trigger set_feedback_updated_at
  before update on public.feedback
  for each row
  execute function public.set_feedback_updated_at();

create index if not exists idx_feedback_status_updated_at
  on public.feedback (status, updated_at desc);

create index if not exists idx_feedback_severity_created_at
  on public.feedback (severity, created_at desc);

create index if not exists idx_feedback_user_status
  on public.feedback (user_id, status)
  where user_id is not null;

create index if not exists idx_feedback_related_poi
  on public.feedback (related_poi_id)
  where related_poi_id is not null;

create index if not exists idx_feedback_related_agent_call
  on public.feedback (related_agent_call_id)
  where related_agent_call_id is not null;

comment on column public.feedback.status is '后台反馈处理状态：pending/in_progress/resolved/ignored。';
comment on column public.feedback.severity is '后台反馈严重程度：normal/important/blocking。';
comment on column public.feedback.admin_note is '后台内部处理备注，不直接展示给用户。';
comment on column public.feedback.reply_message is '预留给 App 消息系统的用户回复内容。';
comment on column public.feedback.source_page is '用户提交反馈时所在页面或入口。';
comment on column public.feedback.device_info is '用户设备、系统和客户端上下文。';
comment on column public.feedback.related_poi_id is '反馈关联的 POI 缓存 ID。';
comment on column public.feedback.related_agent_call_id is '反馈关联的 Agent 调用流水 ID。';
comment on column public.feedback.related_trip_id is '反馈关联的用户行程 ID。';
