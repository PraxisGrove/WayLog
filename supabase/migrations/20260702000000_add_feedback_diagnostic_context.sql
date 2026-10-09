alter table public.feedback
  add column if not exists diagnostic_context text;
