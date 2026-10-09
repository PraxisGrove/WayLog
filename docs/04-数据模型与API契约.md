# 数据模型与 API 契约 · Data Contracts

> 本文定义 Trip、本地优先同步与 Agent 写入的数据边界。
> 更新基线：2026-10-09。类型以 `features/trips/types.ts` 为准，数据库结构以 `supabase/migrations/` 为准。

## 领域对象

| 对象 | 职责 | 标识 |
| :-- | :-- | :-- |
| `Trip` | 一次旅行的聚合根 | `tripId` / `id` |
| `TripDay` | 旅行中的一天 | `dayId` / `id`，`dayIndex` 从 1 开始 |
| `TripDayItem` | 一天中的安排 | `itemId` / `id`，可关联 `placeId` |
| `TripPlace` | 旅行内的地点与用户备注 | 本地 `id` 与独立 provider 身份 |
| `TripTransport` / `TripLodging` | 交通与住宿记录 | 各自稳定 `id` |
| `TripMemo` / `TripChecklistItem` | 备忘与清单 | 各自稳定 `id` |
| `TripExpense` / `TripBudget` | 费用与预算 | 费用 `id`，金额与币种分别保存 |

跨层协议优先使用 `tripId`、`dayId`、`itemId` 和日期。
标题、展示排序和数组下标不承担身份职责。移动安排后保留 item 身份，展示位置可变。
`dayIndex` 是从 1 开始的旅行天序，不能把 UI 数组下标直接传给业务合同。

## Trip 聚合

```text
Trip
  ├── id / title / destination / status / currency
  ├── startDate / endDate
  ├── days[] -> items[] -> placeId
  ├── places[]
  ├── transports[] / lodgings[]
  ├── generalNote / memos[] / checklistItems[]
  ├── budget / expenses[]
  ├── importSources[] / routeModeOverrides
  └── createdAt / updatedAt / pinnedAt
```

`Trip.status` 使用当前领域值“计划中”“旅途中”“已完成”。
日期和时间遵循相应模块的格式规则；云端列投影与完整 payload 分开处理。
费用可关联日期、day 或地点，但不表示支付、订单或多人结算完成。
`importSources` 的现有占位状态不代表攻略自动解析已实现。

## 存储与兼容

| 数据 | 当前本地存储 | 云端边界 |
| :-- | :-- | :-- |
| Trip 与同步元数据 | AsyncStorage | `user_trips` 的 JSONB payload 与列投影 |
| 收藏地点与偏好 | 各 feature 的本地适配器 | 对应用户表与偏好记录 |
| Agent Conversation、PendingState、ledger | 本地 SQLite / Agent namespace | 当前不跨设备同步会话 |
| 旧 Agent KV | 惰性迁移读取 | 不恢复旧运行时语义路径 |

存储读取和云端输入经过规范化：处理旧字段、缺失数组、币种、天序和地点关系。
修改类型、默认值或规范化必须兼容已有 AsyncStorage 与 JSONB 数据。
迁移应可重复执行，不能依赖用户清空数据才能启动。
示例数据与用户数据分开管理；种子行程不作为个人云同步实体上传。

## 本地优先写入

```text
领域命令 / UI 操作 / 已授权 Agent
  -> 完整校验
  -> storage.ts 保存本地 Trip
  -> 标记 dirty 或 deletedAt
  -> 调度后台同步
```

Trip 集合写入通过本地协调器串行化，防止整数组读改写互相覆盖。
同步元数据有独立写锁；Agent 的应用回执与失败补偿遵循各自 ApplyFlow。
页面、Edge 与模型工具不能直接写 `public.user_trips`。
读 Trip 只读本地，不把每次读取变成网络同步。

## 同步元数据

| 字段 | 含义 |
| :-- | :-- |
| `dirty` | 本地变化尚未成功同步 |
| `localUpdatedAt` | 对应本地修改或删除时间 |
| `deletedAt` | 待同步或已同步的软删除标记 |
| `cloudUpdatedAt` | 已知云端更新时间 |
| `lastSyncedAt` | 最近成功同步时间 |
| `version` | 已知云端版本 |
| `lastSyncError` | 最近同步失败的错误摘要 |

失败保持 dirty；成功才更新云端基线、版本并清除错误。
同步期间发生的新本地修改要保留较新的 dirty 意图，不能被旧同步结果清除。

## Push / Pull 与冲突

当前同步以整个 Trip 为单位，不提供字段级 CRDT 或多人实时协作。

1. 获取当前登录会话；没有有效会话时保留本地数据并跳过云同步。
2. 读取非种子 Trip 与元数据，补标记尚未同步的本地实体。
3. 增量 upsert dirty Trip，并提交软删除。
4. 获取云端行程，补齐公共 POI 引用并规范化 payload。
5. 根据云端时间、本地 dirty、删除时间和同步基线判断是否接受远端变化。
6. 合并前再次读取本地意图，保护同步过程中新增的修改。
7. 保存合并结果与元数据；失败留待下次重试。

冲突判断由 `shouldAcceptCloudTrip()` 与删除分支控制，不能简单理解为所有云端数据覆盖本地。
dirty Trip 只有在满足远端新于已知同步基线等规则时接受云端版本；删除按对应时间与 dirty 状态判断。
修改这些条件必须同时覆盖并发写入、离线重试、远端删除与旧 payload 回归。

同步由应用生命周期、有效登录态、Realtime、前台恢复、轮询和显式操作触发。
防抖、冷却与单次同步锁由 `shared/hooks/use-multi-device-sync.ts` 管理。

## Supabase 表边界

| 表/数据域 | 作用 | 访问约束 |
| :-- | :-- | :-- |
| `public.user_trips` | 用户 Trip 列投影、payload、版本与软删除 | 会话身份 + RLS |
| `public.user_favorite_places` | 用户收藏地点 | 会话身份 + RLS |
| `public.poi_cache` | 公共 POI 数据与 provider 身份 | 不承载用户备忘或外部攻略正文 |
| `admin.agent_runtime_config` | Agent 服务开关、版本与 provider/额度配置 | 服务端受控访问 |
| `admin.agent_runtime_events` | 有界运行遥测 | 白名单字段，服务端受控访问 |

身份来自 Supabase JWT，不能相信客户端自报 userId 或等级。
`service_role`、模型密钥和服务端第三方凭据只在服务端环境中使用。
实际 RLS、RPC、字段约束和索引以 migrations 为准，文档中的表名不是部署完成证明。

## POI 身份与引用

`TripPlace.id` 是旅行内实体 ID；`provider + providerPlaceId` 是外部地点身份。
高德身份同时通过 `externalRefs.amapPoiId` 与相应 helper 管理，不能用地点名称替代。
云端可将公共高德地点压缩为 `TripPlaceRef`，读取时通过 POI cache hydrate；自定义地点保留自己的数据。
用户备注、安排状态等旅行私有字段不能进入共享 POI 缓存。

Agent 新增地点必须引用本 turn 的受控工具候选，检查 provider、身份和地区一致性。
客户端以工具事实覆盖模型给出的名称、地址、类别与坐标；缺失、跨地区或身份不匹配时阻止写入。

## Agent 数据合同

| 对象 | 作用 | 写入条件 |
| :-- | :-- | :-- |
| `TripDraft` | 可预览的新行程草案 | 用户明确创建后才形成 Trip |
| `TripCreateRequest` | 客户端生成的已确认创建请求 | 草案 revision 与稳定创建 operation 校验 |
| `TripEditProposal` | 对已有 Trip 的结构化提案 | schema、目标、风险、版本与授权全部通过 |
| 应用回执与 operation ledger | 幂等与审计 | 成功应用后持久化，重复确认复用结果 |

编辑提案携带唯一 `proposalId`、`tripId`、`expectedUpdatedAt` 与唯一 `operationId`。
客户端重新读取目标 Trip，按 `expectedUpdatedAt` 检查版本并执行整张不可变 dry run。
任一 operation 无效都在提交前拒绝；同一提案不能留下一部分成功的 Trip。

默认需要确认。用户显式开启快捷代办后，单个低风险编辑才可自动应用。
删除、多操作、中高风险或不确定风险必须强确认；草案创建不适用快捷代办。
回执前失败恢复本操作拥有的最小状态；云同步失败不回滚已成功的本地编辑。

## 外部内容与公开材料

用户备忘、POI、天气、路线、网页和攻略都是不可信 data，不能改变系统规则或工具权限。
公开网页检索只能由用户明确触发；长期保存仅限标题、平台、安全链接和抓取时间。
正文、评论、图片、视频、signed URL、`xsec_token` 不进入全文索引、向量库、共享缓存或公开日志。

仓库只保存占位配置和合成样例。真实会话、账号、旅行导出、生产项目标识与私有运维材料留在本地或受控环境。
`EXPO_PUBLIC_*` 会进入客户端，不能用于保存服务端秘密。

相关入口：[领域模型](../CONTEXT.md) · [Agent Runtime](agents/agent-runtime.md) · [架构](03-技术方案与架构.md) · [验收](05-测试与验收说明.md)
