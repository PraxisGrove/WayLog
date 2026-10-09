create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  contact_method text check (contact_method in ('qq', '邮箱', '手机号')),
  contact_value text,
  platform text,
  app_version text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- 任何人（含游客）都可以提交反馈
create policy "Anyone can insert feedback"
  on public.feedback
  for insert
  with check (true);

-- 只有登录用户可以读取自己的反馈
create policy "Users can read their own feedback"
  on public.feedback
  for select
  using (auth.uid() = user_id);
