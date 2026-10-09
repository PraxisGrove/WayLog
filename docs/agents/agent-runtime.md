# Agent Runtime 权威合同

修改 Pi、路由、Skill、工具、Conversation、授权或 ApplyFlow 时，按本文检查当前执行合同。自由文本统一进入两阶段 Proposal Generation，真实 Trip 写入统一进入客户端 Confirmed Apply。

## 权责总览

```text
自由文本
  -> Proposal Generation（只读）
     -> RouteSelector Pi run
     -> selected Skill Pi run
     -> answer | clarification | trip_draft | trip_draft_clarification
        | trip_edit_proposal | trip_selection_required | out_of_scope | failure
  -> 用户结构化确认 / 有效快捷代办授权
  -> Confirmed Apply（可写）
     -> Validator -> ApprovalGate -> ApplyFlow
     -> 本地 Trip -> dirty -> apply receipt -> 后台云同步
```

Pi 控制 Agent loop、工具调用、流式事件、取消和终止；WayLog 控制产品范围、上下文、运行时 schema、POI 事实、风险、授权、幂等、版本冲突、Conversation 和 Trip 写入。Pi、LLM、Edge、Skill、工具与预览卡都没有 Trip 写权限。

## 移动端 Pi Runtime

WayLog 精确锁定 `@earendil-works/pi-agent-core@0.84.3` 和对应 `pi-ai`，通过 pnpm `patchedDependencies` 使用最小 React Native 兼容补丁。产品代码只通过 `features/agent/pi-runtime.ts` 创建 Pi Agent，并加载 `./react-native` 子入口。Agent 与低层 loop 都要求注入 `streamFn`，模型流由认证后的 WayLog 代理适配器提供，不使用默认 provider stream。

补丁提供 RN 子入口、Hermes EventStream 与 JSON-only clone 等运行条件；Node/provider 根模块不得进入 Expo sourcemap。补丁保留[上游 MIT 许可与版权声明](../../licenses/PI-MIT.txt)。升级必须重新审查补丁、运行兼容 fixture、Android/iOS Release 构建和原生 probe；验收边界见[测试与发布验收](../05-测试与验收说明.md)。

生产入口固定为：

```text
requestProposalGenerationViaPi()
  -> runProposalGeneration()
  -> runCloudRouteSelector()
  -> runSelected*Skill()
```

全 App 同时只允许一个 active Agent Attempt。取消会 abort 已注册的 Pi run；失败重试保留 `turnId`、创建新 `attemptId`，并从原始输入、冻结引用和已验证 continuation 重新开始，不复用部分模型输出。

## 两阶段路由与上下文

每条自由文本先运行独立 RouteSelector Pi run。它只接收原始消息、最小 `pageContext`、内建 handler 名称和轻量 `SkillRouteMetadata`，只暴露 `waylog_route` terminating tool；看不到完整 Skill 正文、Skill schema、业务工具、POI 结果或完整 Trip。

运行时校验后的 route 明确包含 `scope`、`routeKind`、`confidence`、`missingSlots`，以及互斥的 `skillId` 或 `handler + publicMessage`。RouteSelector 只能选择 `trip.draft`、`itinerary.edit`、`waylog.qa`、clarification 或 out-of-scope，不能产生 Trip operation。

只有选中 Skill 后才启动第二个独立 Pi run，并加载该 Skill 的完整说明、phase 专属 terminating tool、声明的裁剪上下文和只读工具 allowlist。`itinerary.edit` 的最终 `tripId` 由客户端读取本地 Trip 摘要解析；弱匹配或多候选先进入本地结构化选择，模型不能决定写入对象。

`SKILL.md` 的 frontmatter 只描述 name、description、tags、routeType 与 requiredContext 等轻量路由信息；当前运行时从 TypeScript Skill 注册表的 `routeMetadata` 提供这些信息。Markdown 正文用于描述命中后的任务说明，TypeScript schema、注册表、生成解析器与 Edge phase allowlist 负责执行校验和权限，Markdown 不能扩大工具或写入能力。

网络、模型、协议或 schema 失败只形成公开 `AgentFailure` 并保留原输入，不运行关键词、正则、字符串截取、shadow routing 或其它语义 fallback。确认、取消、Trip 选择和澄清续跑（typed clarification continuation）是本地结构化事件，不重新进入 RouteSelector。

## Proxy 与事件协议

客户端按 phase 创建 `schemaVersion=1` 的 `AgentLlmProxyRequest`：

- `route_selector / route-selector.v2 / router`
- `trip_draft / trip-draft.v1 / balanced`
- `itinerary_edit / itinerary-edit.v1 / balanced`
- `waylog_qa / waylog-qa.v1 / balanced`

`agent-llm-proxy` 从 JWT 推导账号，拒绝客户端 `userId` 和 `systemPrompt`，校验 App/协议/prompt/profile/phase、远程配置与 quota 后，才选择 Edge 持有的正式提示词、provider model 和工具。Edge 是无状态 LLM 与受限只读工具代理，不写 `public.user_trips`。

Proxy SSE 只允许版本化 `start`、text start/delta/end、tool-call start/delta/end、`done + usage` 和公开 `error`。客户端再次校验数量、长度、tool 名称、参数和事件顺序，再转换成 Pi assistant stream；thinking content 被丢弃。

Pi `AgentEvent` 不直接成为产品协议。客户端只投影 `AgentUiEvent@1`：

- `stage.changed`：`preparing | running_model | running_tool | validating_result | completed`
- `tool.updated`：公开工具名、稳定 `toolCallId`、`running | completed | failed` 和可选有界摘要

阶段来自真实 orchestration/tool 事件，不使用计时器伪造进度。Raw thinking、chain-of-thought、system prompt、完整工具参数/结果和 provider payload 不进入 UI、Conversation 或遥测。

## Conversation、Turn 与 Attempt

WayLog 的本机事实层级是 `accountId -> Agent Conversation -> Agent Turn -> Agent Attempt`，不是 Pi session。Conversation 默认存入 Expo SQLite 的 Agent namespace，并按账号分区；兼容读取旧 AsyncStorage 记录并执行惰性迁移。登出取消该账号的内存 Attempt，但不删除历史；切换账号不能读取其它分区。

一次原始用户任务对应稳定 `turnId`。重试和澄清续跑仍属于该 Turn，但使用新的 `attemptId`。消息、Turn、Attempt 和公开工具事件使用稳定键去重；App 恢复时没有对应内存执行的 running Turn 标为 interrupted，只能从原输入重试。

Conversation 只持久化公开消息、公开事件摘要、usage/failure、route/Skill 摘要和 PendingState 引用。`TripDraft`、澄清续跑状态与 `TripEditProposal` 的可执行 payload 由 PendingState 保存，消息文本不能反推出执行参数。Raw Pi session、provider history、隐藏 reasoning 和完整工具 payload 不持久化。

## 只读工具与不可信数据

当前模型可见业务工具只有 `poi.search`、`weather.get`、`route.estimate` 和用户明确触发时的 `web.search`；`time.now` 只属于本地确定性工具合同。Skill 注册表与 Edge phase 取 allowlist 交集，并执行 schema、超时、调用预算和公开事件裁剪。

工具结果、Trip 上下文、网页、攻略和用户输入都视为不可信 data，不能改变 system policy、schema、工具权限或授权。外部来源只可持久化标题、平台、安全链接与抓取时间，不保存正文、评论、图片、视频、signed URL、token 或完整工具结果。

POI 写入前必须由本 turn 受控工具候选证明 `provider + providerPlaceId` 身份，且目的地区域一致；客户端用工具事实覆盖模型提供的名称、地址、分类和坐标。不存在候选、公交/地铁替代候选、跨地区候选或身份不匹配都 fail closed。

## 结果与领域术语

- 澄清请求（`Clarification`）：产品级结构化暂停结果。Trip Draft 的当前 TypeScript 合同名是 `TripDraftClarificationCandidate`；它不是普通回答。
- `TripDraft`：只引用已验证 POI 的可预览新行程草案，不是真实 Trip，也不是 Proposal。
- `TripCreateRequest`：创建授权后由客户端生成的已确认创建请求，携带稳定 `draftRevision` 与 `createOperationId`；不是第二张 Proposal。
- `TripEditProposal`：对已有 Trip 的结构化修改提案，携带 `proposalId`、`tripId`、`expectedUpdatedAt` 和稳定 `operationId/dayId/itemId`。

这四个领域词不得互换。当前 `ProposalGenerationResult` 的稳定 `resultType` 分支为 `answer`、`clarification`、`trip_draft`、`trip_draft_clarification`、`trip_edit_proposal`、`trip_selection_required`、`out_of_scope` 和 `failure`。其中 `trip_draft_clarification` 与 `trip_selection_required` 是结构化暂停结果；`TripCreateRequest` 只能由明确创建事件在客户端产生。

## 澄清续跑（Clarification continuation）

Trip Draft 缺少或含糊的 destination/dayCount 必须返回澄清请求，不得默认。澄清续跑状态保存 accountId、clarificationId、conversationId、turnId、原始输入、冻结 `{ referenceTime, timeZone }`、已验证语义、typed response contract、状态和过期时间。

提交只接受 `{ clarificationId, value }`；dayCount 是 1–14 整数，destination 是 1–120 字符非空文本。Runtime 拒绝 ID 不匹配、类型不符、越界、重复、过期和损坏状态。成功提交 claim 有 lease 的 continuation，直接续跑 `trip.draft`，不添加伪用户消息，也不调用 RouteSelector；失败释放 claim，成功才 completed。

## TripDraft、创建授权与 Confirmed Apply

Trip Draft Skill 先用 `waylog_trip_draft_semantics` 终止为澄清请求，或提交完整语义与 POI 查询；Edge 校验后才转换为内部 `poi.search`。可信候选返回后只允许 `waylog_trip_draft` 终止。`TripDraftSemantics` 包含 destination、cities、日期表达与确定性日期、dayCount、companions、preferences、semantic title、confidence 和 missingFields。标题 fallback 只能使用已验证 destination + dayCount。

用户点击 DraftPreviewCard 的“创建行程”是唯一的创建授权。`applyConfirmedTripCreate()` 重新读取并严格校验持久化草案、revision、1-based 连续天序和 POI 身份；成功顺序是待恢复创建、本地 Trip、dirty、创建回执、清理待恢复创建、后台同步。重复 `createOperationId` 返回既有 Trip；创建回执前失败补偿本操作拥有的 Trip/dirty，云同步失败保留本地结果与 dirty。快捷代办不能创建新 Trip。

## TripEditProposal、编辑授权与 Confirmed Apply

`itinerary.edit` 可生成 add、update、move、remove 和多 operation 提案。`applyTripEditProposal()` 重新执行运行时 schema、目标解析、operation ledger、`expectedUpdatedAt` CAS 和整张提案不可变 dry run；任一 operation 无效都在写入前拒绝。

ApprovalGate 只允许用户显式开启快捷代办后，以编辑授权自动应用单个 low operation。Medium、high、删除、多 operation、跨多处影响或不确定风险必须取得强确认形式的编辑授权。成功写入在本地 Trips 协调器内一次提交 Trip JSON、dirty 和包含首次 conversationId/turnId 的编辑回执；重复确认返回既有编辑回执，编辑回执前失败恢复最小快照，后台同步失败不回滚本地成功。

## 运营控制、quota 与遥测

`admin.agent_runtime_config` 是 service-role-only 的版本化配置，控制全局/Skill 开关、最低 App 版本、协议版本、允许 profile、provider model 映射和 minute/daily quota。配置缺失、读取失败、停用或版本不兼容都返回真实 unavailable，不恢复旧语义路径。

模型 profile 与远端配置只控制生成资源和服务可用性，不赋予 Trip 写权限；任何档位的结果仍经过客户端 schema、地点核验、Validator、ApprovalGate、版本与幂等检查。配置变化不能降低确认要求或改变本地优先写入链路。

`consume_agent_turn_quota` 使用 JWT 的 `auth.uid()` 和数据库锁执行账号级限流；客户端 userId、profile 或 tier 没有权限效力。客户端默认展示真实 daily usage，展开后可显示 profile、模型/工具调用、时长和升级信息，不承诺精确货币成本。

`admin.agent_runtime_events` 只记录白名单字段：账号安全 ID、conversation/turn/attempt、phase/Skill/prompt/model/profile、耗时、usage 汇总、工具名/状态、公开 failure、operation 数量和升级元数据。完整消息、Trip JSON、thinking、提示词、工具 payload、JWT、密钥、signed URL 和外部正文不得进入遥测。

运行配置 migration 注册每日清理任务，删除超过 30 天的遥测。部署者需应用 migration，并在自己的数据库确认 `cleanup-agent-runtime-events` 任务正常运行；源码定义不代表远端任务已部署或执行成功。

## 验收边界

本地回归覆盖运行时协议、提案校验、确认授权、POI 身份、版本冲突、重复确认、原子写入与同步失败恢复。检查命令和平台验收范围见 [测试与验收说明](../05-测试与验收说明.md)。

真实供应商调用、最低 App 版本门禁、正式签名发布、Sentry 上传和 Android/iOS 真机回归需要在部署者的环境单独验证。本地测试或 simulator 构建不能代替这些验收，也不能降低已有授权和写入边界。
