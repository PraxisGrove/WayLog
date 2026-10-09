# 微信登录配置指南

微信登录需要部署者自己的微信开放平台移动应用、Supabase 项目和原生开发构建。Expo Go 和 Web 不能替代包含微信 SDK 的原生安装包。

## 1. 准备自己的应用配置

在 [微信开放平台](https://open.weixin.qq.com/) 创建并配置移动应用，记录自己的 AppID、AppSecret 和已启用的登录权限。

- Android 包名使用你在 `app.json` 中配置的 `expo.android.package`。
- iOS Bundle ID 使用你在 `app.json` 中配置的 `expo.ios.bundleIdentifier`。
- Android 应用签名使用**实际测试或发布安装包**对应签名证书的 MD5 摘要。Debug 与 Release 证书不同，需要与微信开放平台登记的签名一致。
- 公开源码不提供维护者的 AppID、AppSecret 或发布签名；不要复用其他应用的凭据。

需要查看签名时，运行 JDK 自带的 `keytool`，按提示输入你自己的证书口令：

```bash
keytool -list -v -keystore /path/to/your-release.keystore -alias your-key-alias
```

选择该安装包对应的 MD5 摘要。原始 keystore、证书口令和 AppSecret 只保存在忽略的本地配置或可信服务端配置中。

## 2. 配置客户端与服务端

复制仓库根目录的 `.env.example` 为 `.env.local`，在**本地文件**中填写自己的配置：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-or-anon-key>
EXPO_PUBLIC_WECHAT_APP_ID=<your-wechat-app-id>
WECHAT_APP_SECRET=<your-wechat-app-secret>
SUPABASE_ACCESS_TOKEN=<your-management-access-token>
```

`EXPO_PUBLIC_WECHAT_APP_ID` 是客户端可见的应用标识；`WECHAT_APP_SECRET` 和管理访问 token 仅用于服务端或本地部署脚本，不得添加公开前缀。也可以在 Supabase Dashboard 的 Edge Function Secrets 中配置 `WECHAT_APP_ID` 与 `WECHAT_APP_SECRET`。

同步与部署到你自己的项目：

```bash
pnpm secrets:sync <your-project-ref>
pnpm exec supabase functions deploy wechat-login --project-ref <your-project-ref>
```

同步脚本会从 `EXPO_PUBLIC_WECHAT_APP_ID` 推导服务端 `WECHAT_APP_ID`。未提供参数时，它只能使用你显式配置的 project-ref 或项目 URL，没有维护者生产项目的默认值。

## 3. 生成原生工程

仓库中的 `plugins/withWechat.js` 在 Expo prebuild 时读取 AppID，并生成或更新 Android 微信回调 Activity、Manifest 配置和 iOS URL Scheme。`android/` 和 `ios/` 是本地生成目录，不在开源仓库中。

```bash
pnpm exec expo prebuild --platform android
```

Android prebuild 后检查：

- `android/app/src/main/java/<你的包名对应目录>/wxapi/WXEntryActivity.java` 已生成。
- `android/app/src/main/AndroidManifest.xml` 中已注册回调 Activity。
- `expo.android.package`、微信开放平台包名与安装包签名一致。

iOS 开发者在设置自己的 Bundle ID 后生成 iOS 工程，并完成微信开放平台要求的应用配置。仓库 SDK 桥接当前调用 `registerApp(appId, "")`；iOS 所需的 Universal Link 配置与真机授权回调应在发布前单独验证。

原生配置发生变化后重新构建安装包，Metro 热更新不会重新生成原生配置。

## 4. 真机验证

1. 安装与你登记的签名一致的开发或发布安装包。
2. 确认真机已安装微信。
3. 打开 App，选择微信登录并完成授权。
4. 确认授权回调返回 App，账号信息正常加载，且只写入你自己的 Supabase 项目。
5. 在 Supabase Dashboard 的 Edge Functions 页面查看 `wechat-login` 日志。排查时只记录错误类型与必要上下文，避免共享 code、token 或 AppSecret。

常见问题：

| 现象 | 检查 |
| --- | --- |
| 登录入口无反应 | 使用原生构建；AppID 已设置；微信已安装 |
| 授权后没有回调 | prebuild 后的回调 Activity / URL Scheme；应用标识；实际安装包签名 |
| 服务端拒绝登录 | 自己项目的 `WECHAT_APP_ID` 与 `WECHAT_APP_SECRET`；Edge Function 部署及日志 |

## 5. 相关源码

- `plugins/withWechat.js`：Expo 原生配置插件。
- `features/auth/wechat.ts`：客户端微信 SDK 桥接。
- `supabase/functions/wechat-login/index.ts`：服务端登录处理。
- `scripts/sync-supabase-secrets.js`：将本地服务端配置同步到显式指定的项目。
