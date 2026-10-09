# WayLog 管理后台

WayLog monorepo 中的独立管理 Web 应用，使用 Next.js 16、Refine、Ant Design 与 Supabase。项目总览见 [根 README](../README.md)。

## 当前能力

| 模块 | 状态 |
| --- | --- |
| 登录与权限 | Supabase Auth 登录，校验启用的 `admin.admin_members` 成员与角色 |
| 总览 | 管理数据概览 |
| 用户 | 列表、筛选与用户详情 |
| POI | 审核、编辑、合并与删除接口 |
| 反馈 | 列表、详情与处理状态 |
| 管理员 | 成员与角色管理 |
| 服务配置 | 配置管理、密钥轮换、连接测试与审计记录 |
| Agent 日志 / 排障 | 导航与占位页面，尚未提供完整数据工作台 |

后台 API 在服务端验证登录用户和管理员权限。POI、成员及服务配置写入包含对应审计逻辑；不同操作受角色限制。后台不替代 App 的本地优先行程写入链路。

## 本地开发

先按 [开发指南](../docs/development.md) 在根目录安装 workspace 依赖，再运行：

```bash
pnpm admin:dev
pnpm admin:lint
pnpm admin:typecheck
pnpm admin:build
```

也可使用 `pnpm --filter @waylog/admin-web <command>`。开发服务默认由 Next.js 启动，地址以终端输出为准；生产构建使用 `pnpm --filter @waylog/admin-web start` 启动。

## 配置

monorepo 内自动读取根目录 `.env.local`，并在未显式配置 Next.js 变量时映射：

```text
EXPO_PUBLIC_SUPABASE_URL      → NEXT_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY → NEXT_PUBLIC_SUPABASE_ANON_KEY
```

独立部署时参考 [环境模板](.env.example)，在部署平台配置：

| 变量 | 边界 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 浏览器可见的自有项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器可见的公共访问密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端，高权限数据库访问 |
| `ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY` | 仅服务端，服务供应商密钥加密 |

服务配置密钥使用 AES-256-GCM 加密保存在 `admin.service_provider_secrets`。前端读取密钥状态、掩码和指纹，不返回原始密钥。加密配置变化会影响既有密文的读取，部署时保持安全备份和一致性。

## 初始化管理员

在自有 Supabase 项目应用仓库迁移，再按 [首次管理员初始化](docs/bootstrap-admin.md) 将自己的 Supabase Auth 用户加入 `admin.admin_members`。核心迁移包括：

- [管理员与审计基础表](../supabase/migrations/20260702000002_create_admin_core.sql)
- [服务配置与加密密钥存储表](../supabase/migrations/20260704000000_create_service_provider_configs.sql)

这些迁移有前置表和后续扩展，使用仓库完整迁移顺序；文件存在不代表远端已应用。显式选择自有环境的 CLI 步骤见 [开发指南](../docs/development.md#自有-supabase-环境)。

## 部署

后台需要支持 Next.js Node.js 服务端运行时的托管环境。Vercel 配置示例：

| 设置 | 值 |
| --- | --- |
| Git Repository | `PraxisGrove/WayLog` 或自己的 Fork |
| Root Directory | `admin-web` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | 留空，由 Next.js 集成处理 |

部署平台需要能安装 monorepo workspace 与根目录补丁。环境变量分别配置在开发、预览和生产环境中，公开变量只存公共配置，服务端变量通过平台密钥存储设置。
