alter table public.profiles
  add column if not exists avatar_scale numeric(3, 1) not null default 1.0
  check (avatar_scale >= 1.0 and avatar_scale <= 2.0);
alter table public.profiles
  add column if not exists avatar_offset_x integer not null default 0
  check (avatar_offset_x >= -40 and avatar_offset_x <= 40),
  add column if not exists avatar_offset_y integer not null default 0
  check (avatar_offset_y >= -40 and avatar_offset_y <= 40);
