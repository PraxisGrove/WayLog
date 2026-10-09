# 参与贡献

欢迎为 WayLog 改进旅行记录、行程规划、同步体验和 Agent 辅助编辑。项目采用 [MIT 许可证](LICENSE)。

## 从哪里开始

- 在 [Issues](https://github.com/PraxisGrove/WayLog/issues) 报告缺陷或讨论需求。缺陷报告请包含复现步骤、预期与实际结果、平台和版本。
- 架构调整、数据模型变更或新增产品能力，先在 Issue 中说明问题和方案，便于确认范围。
- 小范围修复、文档完善和可访问性改进可以直接提交 [Pull Request](https://github.com/PraxisGrove/WayLog/pulls)。
- 安全漏洞和凭据泄漏按 [安全政策](SECURITY.md) 私密报告。

讨论以具体问题和证据为中心，尊重不同背景的参与者。示例、日志与截图使用虚构数据；上传前移除账号、位置记录、访问令牌和其他个人信息。

## 本地准备

使用 Node.js 26 和 `pnpm@11.7.0`。Node.js 26 是当前开发验证环境，仓库尚未通过 `engines` 固定最低版本。安装、环境配置与各端启动步骤见 [开发指南](docs/development.md)。

```bash
git clone https://github.com/PraxisGrove/WayLog.git
cd WayLog
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Fork 贡献者将克隆地址替换为自己的 Fork。环境变量使用自有开发服务；实际密钥、签名文件、数据库备份、用户记录和本地产物保存在版本控制之外。

## 代码组织

| 目录 | 职责 |
| --- | --- |
| `app/` | Expo Router 路由入口、参数和布局配置 |
| `shell/` | Provider、应用外壳和全局生命周期 |
| `domains/` | 产品页面、交互编排与页面私有组件 |
| `features/` | 业务规则、领域命令、存储、同步和协议校验 |
| `shared/` | 跨功能复用的 UI、主题、Hook 与工具 |
| `modules/` | Expo 原生模块 |
| `supabase/` | 数据库迁移、Edge Functions 与邮件模板 |
| `admin-web/` / `os-web/` | 管理后台 / 静态官网 |

依赖沿 `app → shell → domains → features` 组织；`shell` 与 `domains` 可使用 `shared`。`features` 保持独立业务层，`shared` 不依赖 `domains`，不同 domain 的复用能力上移到 `features` 或 `shared`。

文件名使用 kebab-case，组件名使用 PascalCase，页面文件使用 `*-screen.tsx`，Hook 文件使用 `use-xxx.ts`。新增注释和复杂逻辑说明默认使用中文；协议字段、第三方术语与英文错误原文保留原义。业务规则优先落在可测试的纯函数或服务中。

## 数据与 Agent 变更

Trip 写入遵循本地优先链路：领域命令 → AsyncStorage → dirty 标记 → 后台云同步。数据结构与规范化变更需要兼容已有本地数据和云端 JSONB；批量修改先完整校验，再应用。

Agent 输出在客户端做运行时校验。草案创建需要用户明确确认；已有行程的修改需要确认，或符合用户已开启的低风险快捷代办授权。提案保留稳定 ID、版本冲突检查和幂等回执，模型与 Edge Function 不直接修改用户行程。

涉及这些链路时，先读 [数据与 API 契约](docs/04-数据模型与API契约.md) 和 [领域词汇](CONTEXT.md)。目录与执行约束详见 [AGENTS.md](AGENTS.md)。

## 验证改动

按影响范围运行检查，在 PR 中记录实际执行的命令和结果：

| 改动范围 | 验证要求 |
| --- | --- |
| `features/` 纯逻辑、协议、领域命令 | 在 `tests/features/` 增加对应测试，运行 `pnpm test` 与 `pnpm typecheck` |
| Trip 类型、存储规范化、同步 | 运行 `pnpm test` 与 `pnpm typecheck`，覆盖旧数据和失败重试 |
| App 页面、组件、样式 | 运行 `pnpm lint` 与 `pnpm typecheck`，检查 Android/iOS 小屏布局 |
| 管理后台 | 运行 `pnpm admin:lint`、`pnpm admin:typecheck`，涉及路由或构建时运行 `pnpm admin:build` |
| 官网 | 运行 `pnpm --filter @waylog/os-web build`，预览页面并检查移动端和链接 |
| 仅文档 | 核对命令、相对链接、术语与源码，检查示例中的敏感信息 |

缺陷修复优先补回归测试。Agent 操作覆盖正常应用、无效参数、目标不存在、重复确认、版本冲突和中途失败；涉及真实模型的评测使用自有开发环境，并记录所用配置与结果。

## 提交 Pull Request

1. 使用范围明确的分支，保持一个 PR 解决一个问题。
2. 说明问题、修改后的行为、验证结果及兼容性影响。UI 变更附脱敏截图；数据结构变更说明迁移方式。
3. 同步更新受影响的公开文档。功能状态以实际实现为准，规划内容明确标注。
4. 检查 diff，移除真实凭据、个人数据、临时日志、构建产物和与改动无关的格式化。

提交贡献即表示你有权提供相应代码或素材，并同意按项目 MIT 许可证分发贡献。第三方资源保留其来源与许可说明。
