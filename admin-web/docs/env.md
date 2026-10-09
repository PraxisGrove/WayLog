# 后台环境变量策略

本地开发只维护仓库根目录的 `.env.local`。

`admin-web/next.config.mjs` 会自动读取 `../.env.local`，并把 App 端已有的 Supabase 公共变量映射给 Next.js：

```text
EXPO_PUBLIC_SUPABASE_URL      -> NEXT_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY -> NEXT_PUBLIC_SUPABASE_ANON_KEY
```

这样本地不需要额外跑 env 同步脚本。

## 为什么仍然保留 admin-web/.env.example

`admin-web/.env.example` 用于两种情况：

- 将后台项目单独拷出去运行。
- 给 Vercel Project 配置环境变量时做参考。

## Vercel

Vercel 不会自动读取仓库根目录的 `.env.local`。部署时需要在 `admin-web` 对应的 Vercel Project 里单独配置：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` 只能用于服务端代码，不要写成 `NEXT_PUBLIC_*`。
