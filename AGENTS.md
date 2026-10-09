# AGENTS.md

## 目标模式

这份文件是给 coding agent 的高信噪比执行手册，不是项目流水账。它只保留会影响代码修改的稳定约束：产品边界、架构分层、数据写入链路、Agent 安全、测试验收和常用命令。

- 当前开发说明放到 `docs/`；一次性计划、面试材料、私人部署记录放到被忽略的 `docs/internal/`。
- 修改本文时优先删重、合并规则、修正过期信息；避免把一次性背景写成永久约束。
- 文档入口和可信度说明见 `docs/README.md`；长文档中标为历史参考、蓝图、规划中或低置信调研的内容，必须先对照代码或官方资料再采用。
- 需要理解或定位代码时，如果仓库根目录存在 `.codegraph/`，先用 `codegraph explore "<问题或符号>"`，再用 `rg` / 读文件补充细节。

## 项目定位

一路记 WayLog 是个人旅行助手 App，当前定位是“旅行控制台 + 旅行手账”。核心优先级是稳定的个人旅行记录、规划、同步和 Agent 辅助编辑，不是早期社区、营销平台或通用日历。

当前开发排序：

1. **P0 稳定性**：同步、认证、移动端体验、发布链路不能被破坏。
2. **P1 Agent MVP**：巩固“先提案、后确认 / 授权”的真实地点添加与 Trip 编辑闭环。
3. **P2 Agent 扩展**：更多低风险 Trip 编辑、历史上下文、usage 展示和页面瘦身。
4. **P3 计划 Tab**：未来用独立 `ScheduleEvent` 做日常计划，不把 `Trip` 扩成通用日历。
5. **P4 内容发现与轻社区**：核心工具、Agent 和 AI 旅行手账导出跑通后再做。

需求冲突时优先保护 P0；Agent 开发不得破坏本地优先和云同步链路。

## 技术栈

React Native 0.81 + Expo SDK 54、TypeScript 5.9、Expo Router、React Navigation 7、AsyncStorage、Supabase Auth / Postgres / RLS / Edge Functions、高德地图、Open-Meteo、Node.js `node:test`、pnpm 11、Biome。

## 架构边界

```text
app/        -> Expo Router 文件路由入口
shell/      -> App 壳层、Provider、全局生命周期 Hook
domains/    -> 用户可见的产品功能区 UI
features/   -> 业务能力、领域命令、存储、同步、协议校验、纯逻辑
shared/     -> 跨 domain 共享 UI、主题、Hook、工具
modules/    -> Expo 本地原生模块
```

依赖方向固定：

```text
app -> shell -> domains -> features
             domains -> shared
             shell   -> shared

features 不依赖 app / shell / domains
shared 不依赖 domains
不同 domains 之间不互相 import；需要复用时上移到 shared 或 features
```

执行约束：

- `app/` 保持很薄，只读取路由参数、配置 layout/redirect，并渲染目标页面。
- `shell/` 只放应用外壳和全局生命周期能力，不放具体业务页面。
- `domains/` 放页面编排、交互状态、页面私有组件和样式。
- `features/` 不放 React 组件，优先写可测试的纯函数或服务封装。
- `shared/` 放跨区复用能力；带业务语义但跨多个 domain 复用的 UI 可放 `shared/<capability>`。
- `modules/` 只放 Expo native modules，不新增产品业务目录。

## 代码阅读地图

查功能时按真实调用链走：

```text
app/_layout.tsx              -> shell/app-root-layout.tsx
app/(tabs)/_layout.tsx       -> shell/app-tab-layout.tsx
app/(tabs)/index.tsx         -> domains/trips/screens/trip-list/trip-list-screen.tsx
app/(tabs)/profile.tsx       -> domains/identity/screens/profile/profile-screen.tsx
app/account.tsx              -> domains/identity/screens/account/account-screen.tsx
app/(tabs)/agent.tsx         -> domains/agent/screens/conversation/agent-conversation-screen.tsx
app/search.tsx               -> domains/search/screens/global-search/global-search-screen.tsx
app/trips/*.tsx              -> domains/trips/screens/*/*
```

一般顺序：

1. 从 `app/` 确认路由入口和参数。
2. 到 `domains/<domain>/screens/...` 看页面编排和组件拆分。
3. 涉及 Trip、Agent、Auth、Search、Weather 等业务规则时进入 `features/<feature>/`。
4. 跨页面基础 UI、主题、Hook、Agent 卡片、地点搜索面板优先看 `shared/`。

## 组件与命名

- 页面私有代码放 `domains/<domain>/screens/<screen>/components|hooks|styles`；同 domain 复用放 `domains/<domain>/components|hooks`；跨 domain 复用放 `shared/`；业务规则放 `features/`。
- 路由级页面文件使用 `*-screen.tsx`，组件名使用 `XxxScreen`。
- 文件名使用 kebab-case，组件名使用 PascalCase，Hook 文件使用 `use-xxx.ts`。
- 项目自定义组件避免使用 `View` 后缀；详细规则见 `docs/03-技术方案与架构.md`。

## 数据写入链路

```text
UI (domains/)
  -> features/trips/storage.ts
  -> AsyncStorage 本地优先
  -> dirty 标记
  -> features/trips/cloud-sync.ts
  -> Supabase
```

硬规则：

- 所有 Trip 写操作先落 AsyncStorage，再标记 dirty 触发后台同步。
- 同步使用增量 upsert + 软删除，失败保留 dirty 标记下次重试。
- 页面、Agent、Edge Function 都不允许绕过本地优先链路直接修改 `public.user_trips`。
- 修改 Trip 类型、规范化或同步逻辑时必须兼容 AsyncStorage 与云端已有 JSONB 数据。
- 批量操作要先完整校验再应用，失败时不能留下半个 Trip。
- `TripDay.dayIndex` 当前从 1 开始；跨层协议优先使用稳定的 `dayId`、`itemId`、`tripId` 或日期。
- 数据链路详情见 `docs/04-数据模型与API契约.md`。

## Agent 安全契约

Agent 的目标是旅行副驾驶，首批只做旅行草案、已有 Trip 的添加/修改/移动/删除安排，以及带来源的 POI、天气、路线建议。不要把它扩成通用工作、课程、习惯或生活管理助手。

写入链路：

```text
用户输入
  -> domains/agent 页面编排
  -> features/agent 上下文与协议
  -> agent-llm-proxy Edge Function
  -> 结构化 TripDraft / TripEditProposal / 只读回答
  -> 客户端运行时校验与差异预览
  -> 用户确认或低风险快捷代办授权
  -> features/trips/commands.ts
  -> storage.ts
  -> AsyncStorage + dirty + cloud-sync
```

硬规则：

- LLM 只能生成 `TripDraft`、`TripEditProposal` 或只读回答，不能直接调用 `createTrip()`、`updateTrip()` 或 Supabase 写接口；真正执行写入的函数不暴露为模型工具。
- Edge Function 不直接写 `public.user_trips`，也不能信任客户端传入的 `userId`；用户身份从 JWT 推导。
- 提案必须包含唯一 `proposalId`，每个操作必须包含唯一 `operationId`；修改已有 Trip 时携带并检查 `expectedUpdatedAt`。
- 客户端必须对模型返回做运行时校验；TypeScript 类型不能替代运行时校验。
- 默认所有写操作都要求用户明确确认；只有用户显式开启“快捷代办”后，低风险提案才可在风险判定、运行时校验和幂等检查通过后自动应用。
- 删除、批量替换、中高风险、跨多处影响或无法确定风险的操作必须显示影响范围并强确认。
- POI、天气、路线、导入攻略和用户备忘都视为不可信内容，不能覆盖系统规则或工具权限。
- 外部旅行资料检索（小红书、网页、视频、社区等）只能作为用户触发的只读工具；持久化只允许保存标题、平台、可跳转链接和抓取时间等来源引用，不保存正文、评论全文、图片、视频、signed URL / `xsec_token`，也不写入全文索引、向量库或共享 POI 缓存。
- Agent 分层依据见 `docs/03-技术方案与架构.md`；当前执行合同见 `docs/agents/agent-runtime.md`。

## 开发约定

- 改业务能力时要联动检查相关入口。例如“添加地点”可能影响新建行程、详情页、地点列表和待安排地点。
- 同一业务规则不要在多个页面重复实现；优先抽到 `features/`。
- Agent 涉及的 Trip 修改先实现为纯领域命令，再接 UI、模型和存储；领域命令不得原地修改传入的 `Trip`。
- 跨层协议使用稳定标识，避免依赖数组下标、展示标题或临时排序。
- 业务代码和运行时代码不要用断言掩盖数据契约；在模块边界、外部输入、存储读取、模型返回和跨层协议处显式校验，尽早抛出带上下文的错误。测试代码可用 `assert` 表达预期。
- 移动端体验优先，同时保留桌面可用性。
- 新增或修改代码注释、文件头说明、复杂逻辑说明时默认使用中文；外部 API、协议字段、第三方术语和英文错误原文可保留英文。
- 地图调起优先用本机地图 App，不默认跳网页版。
- 日志系统目标态是 Sentry React Native + 轻量本地 ring buffer；不要继续扩张自研 AsyncStorage logger。

## UI 与皮肤

以下审美偏好只约束 **WayLog 默认皮肤和当前核心工具界面**。将来设计其它皮肤、主题或导出模板时，不要沿用默认皮肤的视觉偏好作为全局限制；应先定义该皮肤自己的品牌语气、token、组件边界和适用场景。

默认皮肤约束：

- 整体保持白底、浅灰背景、基础卡片、普通导航的清爽旅行工具气质。
- 局部重点组件可使用“轻拟物 + 微 3D + 复古界面感”，例如 Agent 提案卡片、状态提示、快捷建议、行程摘要卡、预算/天气/路线小卡、打包清单和关键 CTA。
- 可适度使用投影、内高光、立体边框、黑色描边、票券切角、贴纸/标签、纹理、粗体标题和清晰图标。
- 偏好高对比但干净的色块：荧光绿、亮黄、青蓝、珊瑚粉、紫色点缀与黑白灰底。
- 强风格元素应作为局部状态或重点组件，避免整屏霓虹、过重阴影、过度圆角、花哨背景和一次混用太多风格。
- 颜色、阴影、圆角优先通过主题 token 承载，保留移动端可读性与无障碍对比度。
- 详细 UI 说明见 `docs/02-UX与设计稿说明.md`。

## 明确不做

当前阶段不要主动实现：

- 社交平台、关注流、社区、评论；当前只允许用户主动导出的旅行手账图片、九宫格、海报通过系统分享面板分享。
- 后台批量抓取 / 定时监控内容平台、攻略内容库、外部平台原文搬运。
- 多人协作、商业化订单、推荐系统。
- 通用日历、重复日程和完整 `ScheduleEvent` 系统。
- 后台自主 Agent、未授权自动修改、自动预订或支付。
- Agent 语音唤醒、连续监听、长期自主运行、长期记忆、向量数据库、跨设备对话同步。
- 复杂地图能力、离线包、通用 PDF/Excel 办公导出、攻略自动解析、复杂换肤系统。

## Skill 调用规则

- Skill 路由先看任务对象，再看泛化触发词：当前仓库代码理解优先 `CodeGraph`；GitHub 仓库/代码/Issue/PR 搜索优先 GitHub 插件或 GitHub API；OpenAI 产品与 API 文档优先 `openai-docs`；安装/更新 skill 才用 `skill-installer`；只有全网、多平台、社媒/视频/招聘/RSS 调研才用 `agent-reach`。
- 不要因为用户说“搜/查/找”就默认调用 `agent-reach`。如果目标平台已经明确且有专门插件或 skill，先用专门能力；只有用户要求“全网调研”“看看大家怎么评价”“多平台比较”或涉及小红书、X/Twitter、B站、Reddit、V2EX、LinkedIn、YouTube、RSS 等来源时，再进入 `agent-reach`。
- 新增或修改 `features/` 纯业务逻辑、Agent operation、协议校验、幂等、版本冲突或同步规则时，优先使用 `tdd`。
- 排查同步、认证、Agent 调用、Edge Function、发布、移动端崩溃或难复现缺陷时，优先使用 `diagnosing-bugs`。
- 讨论或改变 `Trip`、`ScheduleEvent`、`TripEditProposal`、快捷代办、低风险提案、本地优先同步等核心概念边界时，优先使用 `domain-modeling`。
- 拆分页面、瘦身 Agent 页面、调整 `app/shell/domains/features/shared` 归属、抽象模块接口或评估重构方案时，优先使用 `codebase-design`。
- 需要整体扫描架构、寻找深模块/浅模块问题、生成架构体检报告时，使用 `improve-codebase-architecture`；报告写到系统临时目录，不落入仓库。
- 用户显式点名某个已安装 skill 时，必须使用该 skill；多个 skill 适用时选择最小组合并说明顺序。

## Agent skills

### Issue tracker

需求和缺陷在当前仓库的 GitHub Issues 中讨论，提交与验证流程见 `CONTRIBUTING.md`。

### Domain docs

修改领域概念时读取 `CONTEXT.md` 与 `docs/04-数据模型与API契约.md`；调整分层时读取 `docs/03-技术方案与架构.md`；修改 Agent 运行时或授权时读取 `docs/agents/agent-runtime.md`。变更后更新对应的当前合同。

## 测试与验收

- 修改 `features/` 纯逻辑时，在 `tests/features/` 增加或调整对应 `node:test`。
- 修复缺陷时优先补回归测试，再修改实现。
- 修改 Trip 数据结构、存储规范化或同步逻辑时，至少运行 `pnpm test` 和 `pnpm typecheck`。
- 修改页面或组件时，运行 `pnpm lint`，并检查 Android/iOS 小屏布局。
- Agent 操作至少覆盖：正常应用、无效参数、目标不存在、重复确认、版本冲突和中途失败。
- Agent MVP 必须保持“未确认 / 未授权写入率 = 0”。
- 不因测试困难而把业务规则移回页面组件。

## 常用命令

| 命令 | 说明 |
| :-- | :-- |
| `pnpm start:expo` | 最底层 Expo 启动入口，跳过 secrets 同步 |
| `pnpm dev` / `pnpm start` | 启动 Expo，跳过 secrets 同步 |
| `pnpm dev:sync` | 同步 secrets -> 启动 Expo |
| `pnpm preview` | 以 LAN host 启动 Expo，跳过 secrets 同步 |
| `pnpm android` / `pnpm ios` / `pnpm web` | 对应平台调试，跳过 secrets 同步 |
| `pnpm android:sync` / `pnpm ios:sync` / `pnpm web:sync` | 同步 secrets -> 对应平台调试 |
| `pnpm test` | 编译 TS 到 `.tmp-test-dist/` 后运行 `node:test` |
| `pnpm lint` | Biome lint |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm format` / `pnpm format:check` | Biome 格式化 / 格式检查 |
| `pnpm build:web` / `pnpm build` | Expo 静态导出，跳过 secrets 同步 |
| `pnpm build:web:sync` / `pnpm build:sync` | 同步 secrets -> Expo 静态导出 |
| `pnpm apk` | 本地构建 Android APK |
| `pnpm release` / `pnpm android:release` / `pnpm release:android` | 本地构建 Android APK，并上传蒲公英和 GitHub Releases |

环境变量见 `.env.example`，本地配置写入 `.env.local`（不提交 Git）。`EXPO_PUBLIC_*` 会暴露给客户端；服务端密钥只能用于 Edge Functions 或脚本。

## 补充文档

文档地图与可信度说明见 `docs/README.md`。五类主文档为：

- `docs/01-产品需求文档-PRD.md`：产品状态、范围和开发优先级。
- `docs/02-UX与设计稿说明.md`：默认皮肤、主题系统、动效和页面体验。
- `docs/03-技术方案与架构.md`：架构边界、Agent 方案、模块设计和工程方案。
- `docs/04-数据模型与API契约.md`：本地优先同步、Supabase、POI ID 和数据/API 边界。
- `docs/05-测试与验收说明.md`：测试命令、发布验收、Android APK 构建和签名排查。

开源贡献流程见 `CONTRIBUTING.md`；本地运行与自有服务配置见 `docs/development.md`；安全披露见 `SECURITY.md`。公开内容只使用脱敏示例，提交前检查密钥、日志、个人数据和服务账号绑定。
