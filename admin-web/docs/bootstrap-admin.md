# 初始化第一个后台管理员

后台账号密码由 Supabase Auth 管理，后台权限由 `admin.admin_members` 管理。

## 步骤

1. 在 Supabase Dashboard 的 Authentication 里创建一个用户，或用登录页注册/邀请流程创建用户。
2. 找到这个用户的 `auth.users.id`。
3. 执行下面的 SQL，把该用户加入后台管理员表。

```sql
insert into admin.admin_members (
  user_id,
  role,
  display_name,
  enabled,
  note
)
values (
  '替换成 auth.users.id',
  'owner',
  '一路记管理员',
  true,
  'bootstrap owner'
)
on conflict (user_id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  enabled = excluded.enabled,
  note = excluded.note;
```

完成后，用这个 Supabase Auth 用户的邮箱和密码登录 `admin-web`。
