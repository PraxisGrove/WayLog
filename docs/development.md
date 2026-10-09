# 开发指南

本指南面向本地开发与自有环境部署。代码规范和贡献流程见 [CONTRIBUTING.md](../CONTRIBUTING.md)，架构与领域文档入口见 [文档导航](README.md)。

## 环境

- Node.js 26：当前开发验证环境；仓库尚未配置 `engines` 或 Node 版本文件。
- pnpm 11.7.0：由根 `package.json` 的 `packageManager` 指定。
- Android 原生调试：Android Studio、SDK、JDK 与设备或模拟器。
- iOS 原生调试：macOS、Xcode 与对应开发工具。
- Supabase 后端开发：自有项目和 Supabase CLI；CLI 已列为仓库开发依赖。

```bash
git clone https://github.com/PraxisGrove/WayLog.git
cd WayLog
pnpm install --frozen-lockfile
cp .env.example .env.local
```

安装会同时处理根 App、`admin-web` 和 `os-web` workspace。保留 `pnpm-lock.yaml` 与 `patches/`，依赖补丁是当前运行配置的一部分。

## 配置

按 [.env.example](../.env.example) 填入自有服务值。App 使用根目录 `.env.local`；后台在 monorepo 内也读取这份文件。修改客户端环境变量后重启开发服务。

| 使用位置 | 变量 | 用途与暴露边界 |
| --- | --- | --- |
| App 客户端 | `EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_ANON_KEY` | 认证与数据 API 的公共配置；权限由 RLS 和服务端校验控制 |
| App 客户端 | `EXPO_PUBLIC_AMAP_JS_API_KEY` | 高德 JS 地图；按服务商要求配置来源与使用限制 |
| App 客户端 | `EXPO_PUBLIC_WECHAT_APP_ID` | 自有微信应用的公开标识；登录还需要原生配置和服务端 AppSecret |
| App 客户端 | `EXPO_PUBLIC_AGENT_ENABLED` | Agent 入口开关；`false` / `0` / `off` / `no` 隐藏入口 |
| App 客户端 | `EXPO_PUBLIC_UNSPLASH_ACCESS_KEY`、`EXPO_PUBLIC_PIXABAY_API_KEY` | 可选图片搜索；会打包到客户端，按服务商允许的客户端用法配置 |
| App 客户端 | `EXPO_PUBLIC_SENTRY_DSN`、`EXPO_PUBLIC_SENTRY_ENVIRONMENT` | 可选错误上报与环境标识；DSN 按客户端配置对待 |
| App 客户端 | `EXPO_PUBLIC_APP_DOWNLOAD_URL` | 自有安装包入口；未配置时打开公开 GitHub Releases |
| App 客户端 | `EXPO_PUBLIC_SUPPORT_EMAIL` | 独立部署的公开联系邮箱；未配置时展示开源项目入口 |
| Admin 浏览器 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 后台公共配置；未显式设置时映射根目录的 Expo Supabase 变量 |
| 受信任服务端 | `SUPABASE_SERVICE_ROLE_KEY` | 后台与部分 Edge Function 的高权限访问；不得使用客户端变量前缀 |
| Admin 服务端 | `ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY` | 服务供应商凭据的静态加密；部署时安全保存并备份 |
| Edge Functions | `AMAP_WEB_SERVICE_KEY`、`WECHAT_APP_SECRET`、`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET` | 地点服务、微信认证和短信服务凭据 |
| Edge Functions | `AGENT_LLM_API_KEY`、`AGENT_LLM_BASE_URL`、`AGENT_LLM_MODEL`、`AGENT_LLM_PROVIDER` | Agent 模型供应商配置；密钥仅由服务端使用 |
| Edge Functions | `TAVILY_API_KEY` / `BRAVE_SEARCH_API_KEY`、`DEEPSEEK_API_KEY` | 可选网页搜索、地点介绍服务 |
| Edge Functions | `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`、`TELEGRAM_WEBHOOK_SECRET`、`TELEGRAM_ADMIN_USER_ID` | 可选通知与只读运维 Bot；要求 webhook secret、指定聊天和管理员身份 |
| Edge Functions | `INTERNAL_WEBHOOK_SECRET`、`SENTRY_WEBHOOK_SECRET` | 内部通知 Bearer 凭据与 Sentry HMAC 签名；未配置或校验失败时拒绝请求 |
| Edge Functions | `PGYER_API_KEY`、`PGYER_APP_KEY` / `PGYER_APP_SHORTCUT` | 查询自有蒲公英应用；缺少目标时返回无更新，不查询维护者应用 |
| 本地运维 | `SUPABASE_ACCESS_TOKEN`、`GITHUB_TOKEN` / `GH_TOKEN`、`PGYER_API_KEY` | 自有后端配置与发布渠道访问凭据 |
| 本地签名 | `KEYSTORE_PATH`、`KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD` | Android Release 签名；实际签名文件和密码不进入 Git |

高德 `AMAP_JS_SECURITY_CODE` 在服务端配置，但地图加载流程会向客户端下发运行时配置；它的来源限制和访问控制仍需按供应商要求设置。

基础页面可先用 Web 调试。登录、云同步、POI、Agent 和后台数据功能需要对应后端与服务配置；公开仓库不提供生产服务凭据。环境文件、签名、数据库导出和真实用户数据保存在 Git 之外。

## 启动 App

```bash
pnpm dev
```

在 Expo 开发菜单中选择目标平台，或直接运行：

| 命令 | 用途 |
| --- | --- |
| `pnpm web` | Expo Web 开发 |
| `pnpm android` | 启动开发服务并打开 Android 目标 |
| `pnpm ios` | 启动开发服务并打开 iOS 目标 |
| `pnpm preview` | 以 LAN 模式启动，供同网络设备连接 |
| `pnpm build:web` | 静态导出 App Web 到根目录 `dist/` |

上述启动与构建命令不自动同步远端密钥。项目包含自定义原生模块及微信等原生能力，完整移动端功能需要原生开发构建；Expo Go 和 Web 不能覆盖所有能力。

```bash
pnpm exec expo run:android
pnpm exec expo run:ios
```

原生工程由 Expo prebuild 生成，根 `android/` 与 `ios/` 不纳入版本控制。修改 App 配置或 native plugin 后重新生成并验证对应平台。自有发行版同时检查包标识、URL scheme、平台账号和签名配置。

## 管理后台与官网

```bash
# 管理后台：Next.js 开发服务
pnpm admin:dev

# 官网：静态源文件预览，默认端口 4173
pnpm --filter @waylog/os-web dev
```

后台登录使用 Supabase Auth，并通过 `admin.admin_members` 判断管理员权限。环境和首次管理员初始化见 [Admin 开发说明](../admin-web/README.md)。官网只依赖静态页面与素材，构建和托管见 [官网说明](../os-web/README.md)。

## 自有 Supabase 环境

先检查 `supabase/migrations/`、`supabase/config.toml` 与待部署函数，确认通知目标、定时任务、外部服务与项目配置均属于自己的环境。数据库迁移会创建或调整真实数据结构；开发阶段使用独立项目，迁移前确认备份和影响。

以下命令中的 `<your-project-ref>` 必须替换为你拥有权限的项目标识：

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <your-project-ref>
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

反馈通知和每日统计默认不发送外部请求。需要启用时，通过自有项目的 Vault 管理界面保存两个条目：

| Vault 名称 | 内容 |
| --- | --- |
| `waylog_supabase_url` | 自有项目根地址，例如 `https://<your-project-ref>.supabase.co` |
| `waylog_internal_webhook_secret` | 随机服务端凭据，与 Edge Function 的 `INTERNAL_WEBHOOK_SECRET` 一致 |

目标地址也从 Vault 读取，避免调用方通过会话设置把凭据转发到其它地址。保持 Vault 解密视图仅对受信任数据库角色可读；不要把真实值写入迁移或公开 SQL 示例。采用 Vault 的依据见 [Supabase 定时函数指南](https://supabase.com/docs/guides/functions/schedule-functions) 和 [Vault 说明](https://supabase.com/docs/guides/database/vault)。

通知触发器和 cron 从 Vault 读取凭据，以 `Authorization: Bearer <secret>` 调用函数；缺少地址或凭据时不发出请求。部署对应函数，并配置自己的 Telegram 通知目标后才会生效。`20261009000001_harden_operational_webhooks.sql` 会更新已应用旧迁移的触发器和同名定时任务；仅修改源码不会更新已运行的服务。

运维接口的调用方式：

- `feedback-notify`、`daily-stats`：仅接受 POST 和专用服务端 Bearer 凭据，也兼容已有 service-role Bearer；数据库任务使用专用凭据。
- `telegram-bot`：创建 Telegram webhook 时设置 `secret_token`，与 `TELEGRAM_WEBHOOK_SECRET` 一致；同时配置允许的 `TELEGRAM_CHAT_ID` 和 `TELEGRAM_ADMIN_USER_ID`。只读命令不提供清空反馈操作。
- `sentry-webhook`：配置 Sentry 的 signing secret，按原始请求 body 校验 HMAC，缺少或错误签名时拒绝写入。

这些运维变量仅用于服务端。公网可调用的 webhook 地址不表示调用者已获授权。配置更新后，在独立测试环境确认未授权请求没有外部请求或数据库写入，再启用通知。

公开 `app.json` 不绑定维护者的 Expo/EAS/Sentry 账号。使用 EAS 时在自己的账号中执行 `eas init`；Sentry 使用自己的 `SENTRY_ORG`、`SENTRY_PROJECT` 与上传凭据。微信配置见 [微信登录指南](../supabase/WECHAT_SETUP.md)。

应用所需函数按功能选择部署，例如 Agent 代理：

```bash
pnpm exec supabase functions deploy agent-llm-proxy --project-ref <your-project-ref>
```

函数部署不替代环境密钥配置。在根目录 `.env.local` 准备服务端变量及自有 `SUPABASE_ACCESS_TOKEN`，然后显式指定目标：

```bash
node scripts/sync-supabase-secrets.js <your-project-ref>
```

运行前复核 [密钥同步脚本](../scripts/sync-supabase-secrets.js) 将发送的变量范围。邮件模板同步、发布和其他运维脚本同样需要先核对目标配置；`*:sync` 命令具有远端写入副作用，普通本地开发使用不带 `:sync` 的命令。

## 检查与调试

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` 编译测试与纯业务逻辑到 `.tmp-test-dist/`，再使用 Node.js `node:test` 执行。根测试入口覆盖 `tests/`，后台检查单独执行：

```bash
pnpm admin:lint
pnpm admin:typecheck
pnpm admin:build
```

Agent 的 UI、路由和真实模型评测，以及存储与同步验收标准见 [测试与验收说明](05-测试与验收说明.md)。真实模型评测会调用配置的服务并产生使用量，使用开发账号与测试行程。

| 常见问题 | 检查方向 |
| --- | --- |
| 依赖安装或编译失败 | Node/pnpm 版本、锁文件、`patches/` 和本机原生工具链 |
| 登录或云同步失败 | 自有 Supabase URL/公共密钥、Auth 配置、RLS、迁移和网络 |
| 地点搜索或地图失败 | 高德配置、相关 Edge Function、配额和供应商来源限制 |
| Agent 调用失败 | 登录态、`agent-llm-proxy`、供应商配置与限流；保留脱敏错误信息 |
| 后台无权限 | 已登录 Auth 用户是否存在于启用的 `admin.admin_members` 中 |
| 设备布局问题 | Android/iOS 小屏、键盘、安全区、滚动与触控区域 |

调试信息在分享前移除令牌、账号、手机号、精确位置及行程内容。复现报告包含命令、提交、平台和脱敏错误，便于区分配置与代码问题。

## Android 本地构建

使用自有受控 keystore，在本地配置四个签名变量后执行：

```bash
pnpm apk build-only
```

脚本会执行原生生成、签名配置与 Release 构建。已发布应用保持原签名；签名指纹从实际 APK 或 keystore 获取，并在第三方平台自行配置，不写入公开文档。

`pnpm release`、`pnpm android:release` 和 `pnpm release:android` 会上传蒲公英及 GitHub Releases。发布前检查脚本目标仓库、平台配置、凭据和待上传产物。完整签名与发布验收见 [测试与验收说明](05-测试与验收说明.md)。

## 开源内容与部署责任

第一方代码、文档和获授权的品牌素材按 [MIT](../LICENSE) 分发；上游补丁、字体、构建工具和外部服务内容见 [第三方声明](../THIRD_PARTY_NOTICES.md)。默认行程和搜索候选使用演示数据，不携带供应商图片、评分或路线快照；实际地点、图片与路线由部署者配置的服务按需查询。

应用内隐私说明是开源版本的参考内容。上线前由实际运营方核对启用的模型、Sentry 和 Telegram 等渠道、上传字段、数据地域、保留与删除流程以及联系方式，并发布与真实处理行为一致的政策。源码许可证不授予使用维护者生产服务、第三方内容或用户数据的权限。
