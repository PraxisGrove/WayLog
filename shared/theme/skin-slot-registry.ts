import type {
  ResolvedSkinSlots,
  SkinSlotAdapterDefinition,
  SkinSlotAdapterId,
  SkinSlotDefinition,
  SkinSlotId,
  SkinSlotOverrides,
  SkinSlotStatus,
  ThemeSkinPackConfig,
} from "./skin-slot-types";
import { SKIN_SLOT_IDS } from "./skin-slot-types";
import type { ThemeDefinition } from "./types";

type LockedFoundationPart = {
  id: string;
  reason: string;
  title: string;
};

export const skinSlotAdapterIds = {
  agentMessageBubble: {
    classic: "classic.agent.messageBubble",
    default: "default.agent.messageBubble",
  },
  agentProposalCard: {
    classic: "classic.agent.proposalCard",
    default: "default.agent.proposalCard",
  },
  homeFeaturedTripCard: {
    classic: "classic.home.compactTripCard",
    default: "default.home.featuredTicketCard",
  },
  homeTodayPlan: {
    classic: "classic.home.todayRoutePills",
    default: "default.home.todayRoutePills",
  },
  homeTripListCard: {
    classic: "classic.home.compactTripCard",
    default: "default.home.ticketTripCard",
  },
  profileProfileCard: {
    classic: "classic.profile.travelCard",
    default: "default.profile.travelCard",
  },
  shellTabBar: {
    classic: "classic.shell.centerAddTabBar",
    default: "default.shell.rightFabTabBar",
  },
  tripDetailChecklistPreview: {
    classic: "classic.tripDetail.checklistNotebookPreview",
    default: "default.tripDetail.checklistNotebookPreview",
  },
  tripDetailChecklistSheet: {
    classic: "classic.tripDetail.checklistSheet",
    default: "default.tripDetail.checklistSheet",
  },
  tripDetailLedgerPreview: {
    classic: "classic.tripDetail.ledgerSquarePreview",
    default: "default.tripDetail.ledgerSquarePreview",
  },
  tripDetailLedgerSheet: {
    classic: "classic.tripDetail.ledgerSheet",
    default: "default.tripDetail.ledgerSheet",
  },
} as const;

export const SKIN_FOUNDATION_LOCKED_PARTS: readonly LockedFoundationPart[] = [
  {
    id: "ui.button",
    reason: "按钮由当前主皮肤的 recipes.button 统一决定。",
    title: "按钮",
  },
  {
    id: "ui.card",
    reason: "基础卡片只跟随主皮肤，避免页面模块和基础容器双重覆盖。",
    title: "基础卡片",
  },
  {
    id: "ui.input",
    reason: "输入框、搜索框和表单状态属于基础 UI，不作为用户单独混搭项。",
    title: "输入框",
  },
  {
    id: "ui.dialog",
    reason: "弹窗、确认框和底部弹层跟随整套皮肤的基础层级。",
    title: "弹窗与底部弹层",
  },
  {
    id: "ui.badge",
    reason: "状态徽章承载语义颜色，不能被单独替换成另一套模块风格。",
    title: "状态徽章",
  },
];

const ready = "ready" as const;
const todo = "todo" as const;

function adapter(
  id: SkinSlotAdapterId,
  title: string,
  description: string,
  themeId: string,
  status: SkinSlotStatus = ready,
): SkinSlotAdapterDefinition {
  return {
    description,
    id,
    status,
    themeId,
    title,
  };
}

export const SKIN_SLOT_DEFINITIONS: readonly SkinSlotDefinition[] = [
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.homeFeaturedTripCard.default,
        "默认线框主卡",
        "首页置顶行程使用基础信息卡，只保留标题、目的地、日期和状态，不带票券装饰。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.homeFeaturedTripCard.classic,
        "简洁紧凑卡",
        "复用简洁模式的紧凑行程卡，适合信息密度更高的首页。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.homeFeaturedTripCard.default,
    description: "首页主行程/置顶行程的大卡片模块。",
    id: "home.featuredTripCard",
    owner: "domains/trips/screens/trip-list",
    status: ready,
    surface: "home",
    title: "首页特色行程卡",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.homeTripListCard.default,
        "默认线框列表卡",
        "全部行程列表使用低保真信息卡，不带票根、打孔或分栏装饰。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.homeTripListCard.classic,
        "简洁列表卡",
        "复用紧凑行程卡，降低装饰感。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.homeTripListCard.default,
    description: "首页全部行程列表中的单个行程卡片。",
    id: "home.tripListCard",
    owner: "domains/trips/screens/trip-list",
    status: ready,
    surface: "home",
    title: "首页行程列表卡",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.homeTodayPlan.default,
        "默认线框今日安排",
        "保留横向地点链路和天气信息，用中性线框样式承载当天路线。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.homeTodayPlan.classic,
        "简洁今日路线",
        "保留当前结构，后续可替换为更克制的路线模块。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.homeTodayPlan.default,
    description: "首页旅途中状态下的今日安排模块。",
    id: "home.todayPlan",
    owner: "domains/trips/screens/trip-list",
    status: ready,
    surface: "home",
    title: "首页今日安排",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.shellTabBar.default,
        "默认线框操作栏",
        "默认底部导航保留基础入口和右侧新建按钮，作为后续 iOS/WayLog 操作风格的骨架。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.shellTabBar.classic,
        "中间加号导航",
        "简洁模式的底部导航：加号固定在导航中间。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.shellTabBar.default,
    description: "App 壳层底部导航与全局加号入口。",
    id: "shell.tabBar",
    owner: "shell/components",
    status: ready,
    surface: "shell",
    title: "底部导航",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.profileProfileCard.default,
        "默认线框资料卡",
        "保留登录资料、统计和快捷入口的信息结构，不加入正式皮肤装饰。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.profileProfileCard.classic,
        "简洁资料卡",
        "保留当前结构，后续可替换为低装饰账户卡。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.profileProfileCard.default,
    description: "我的页登录后的资料卡、旅行统计和快捷入口组合。",
    id: "profile.profileCard",
    owner: "domains/identity/screens/profile",
    status: ready,
    surface: "profile",
    title: "我的资料卡",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.tripDetailLedgerPreview.default,
        "默认线框账本预览",
        "详情总览账本只保留金额、条目和新增入口，用中性边框表达模块边界。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.tripDetailLedgerPreview.classic,
        "简洁账本方卡",
        "保留当前结构，后续可替换为更基础的账本摘要。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.tripDetailLedgerPreview.default,
    description: "行程详情总览中的旅行账本预览。",
    id: "tripDetail.ledgerPreview",
    owner: "domains/trips/screens/trip-detail",
    status: ready,
    surface: "tripDetail",
    title: "账本预览",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.tripDetailLedgerSheet.default,
        "默认账本弹层",
        "行程详情中的完整旅行账本底部弹层。",
        "default",
        todo,
      ),
      adapter(
        skinSlotAdapterIds.tripDetailLedgerSheet.classic,
        "简洁账本弹层",
        "预留给后续完整账本弹层的模块替换。",
        "classic",
        todo,
      ),
    ],
    allowUserOverride: false,
    defaultAdapterId: skinSlotAdapterIds.tripDetailLedgerSheet.default,
    description: "完整旅行账本 Sheet，等待后续拆出稳定 adapter。",
    id: "tripDetail.ledgerSheet",
    owner: "domains/trips/screens/trip-detail",
    status: todo,
    surface: "tripDetail",
    title: "账本弹层",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.tripDetailChecklistPreview.default,
        "默认线框清单预览",
        "详情总览清单只保留标题、数量和勾选条目，不带手账装订装饰。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.tripDetailChecklistPreview.classic,
        "简洁清单预览",
        "保留当前结构，后续可替换为更朴素的清单摘要。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.tripDetailChecklistPreview.default,
    description: "行程详情总览中的出行清单预览。",
    id: "tripDetail.checklistPreview",
    owner: "domains/trips/screens/trip-detail",
    status: ready,
    surface: "tripDetail",
    title: "清单预览",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.tripDetailChecklistSheet.default,
        "默认清单弹层",
        "行程详情中的完整出行清单底部弹层。",
        "default",
        todo,
      ),
      adapter(
        skinSlotAdapterIds.tripDetailChecklistSheet.classic,
        "简洁清单弹层",
        "预留给后续完整清单弹层的模块替换。",
        "classic",
        todo,
      ),
    ],
    allowUserOverride: false,
    defaultAdapterId: skinSlotAdapterIds.tripDetailChecklistSheet.default,
    description: "完整出行清单 Sheet，等待后续拆出稳定 adapter。",
    id: "tripDetail.checklistSheet",
    owner: "domains/trips/screens/trip-detail",
    status: todo,
    surface: "tripDetail",
    title: "清单弹层",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.agentProposalCard.default,
        "默认线框提案卡",
        "保留 Agent 提案确认流程、风险标记和操作按钮，不加入正式插画或风格化外观。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.agentProposalCard.classic,
        "简洁提案卡",
        "保留当前结构，后续可替换为更基础的确认卡。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.agentProposalCard.default,
    description: "Agent 生成提案后的确认卡片。",
    id: "agent.proposalCard",
    owner: "shared/agent",
    status: ready,
    surface: "agent",
    title: "Agent 提案卡",
  },
  {
    adapters: [
      adapter(
        skinSlotAdapterIds.agentMessageBubble.default,
        "默认线框消息气泡",
        "保留 Agent 对话、欢迎卡和工具结果的信息结构，作为正式消息视觉前的骨架。",
        "default",
      ),
      adapter(
        skinSlotAdapterIds.agentMessageBubble.classic,
        "简洁消息气泡",
        "保留当前结构，后续可替换为更克制的对话模块。",
        "classic",
      ),
    ],
    allowUserOverride: true,
    defaultAdapterId: skinSlotAdapterIds.agentMessageBubble.default,
    description: "Agent 对话流中的消息气泡模块。",
    id: "agent.messageBubble",
    owner: "domains/agent/screens/conversation",
    status: ready,
    surface: "agent",
    title: "Agent 消息气泡",
  },
] as const;

export const skinSlotSurfaceLabels: Record<
  SkinSlotDefinition["surface"],
  string
> = {
  agent: "Agent",
  home: "首页",
  profile: "我的",
  shell: "外壳",
  tripDetail: "详情",
};

const skinSlotDefinitionById = new Map(
  SKIN_SLOT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function isSkinSlotId(
  value: string | null | undefined,
): value is SkinSlotId {
  return SKIN_SLOT_IDS.includes(value as SkinSlotId);
}

export function getSkinSlotDefinition(slotId: SkinSlotId): SkinSlotDefinition {
  return skinSlotDefinitionById.get(slotId) ?? SKIN_SLOT_DEFINITIONS[0];
}

export function getSkinSlotAdapter(
  slotId: SkinSlotId,
  adapterId: SkinSlotAdapterId,
): SkinSlotAdapterDefinition | undefined {
  return getSkinSlotDefinition(slotId).adapters.find(
    (adapterOption) => adapterOption.id === adapterId,
  );
}

export function getSkinSlotDefaultAdapterId(
  skin: ThemeSkinPackConfig,
  slotId: SkinSlotId,
): SkinSlotAdapterId {
  const slotDefinition = getSkinSlotDefinition(slotId);
  const configuredDefault = skin.defaultAdapters[slotId];

  if (configuredDefault && getSkinSlotAdapter(slotId, configuredDefault)) {
    return configuredDefault;
  }

  return slotDefinition.defaultAdapterId;
}

export function canOverrideSkinSlot(
  themeDefinition: ThemeDefinition,
  slotId: SkinSlotId,
) {
  const slotDefinition = getSkinSlotDefinition(slotId);

  return (
    slotDefinition.status === "ready" &&
    slotDefinition.allowUserOverride &&
    themeDefinition.skin.allowedOverrideSlots.includes(slotId)
  );
}

export function normalizeSkinSlotOverrides(
  value: unknown,
  themeDefinition?: ThemeDefinition,
): SkinSlotOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const overrides: SkinSlotOverrides = {};

  for (const [slotId, adapterId] of Object.entries(value)) {
    if (!isSkinSlotId(slotId) || typeof adapterId !== "string") {
      continue;
    }

    if (!getSkinSlotAdapter(slotId, adapterId)) {
      continue;
    }

    if (themeDefinition && !canOverrideSkinSlot(themeDefinition, slotId)) {
      continue;
    }

    overrides[slotId] = adapterId;
  }

  return overrides;
}

export function parseSkinSlotOverrides(
  value: string | null,
  themeDefinition?: ThemeDefinition,
): SkinSlotOverrides {
  if (!value) {
    return {};
  }

  try {
    return normalizeSkinSlotOverrides(JSON.parse(value), themeDefinition);
  } catch {
    return {};
  }
}

export function resolveSkinSlots(
  themeDefinition: ThemeDefinition,
  slotOverrides: SkinSlotOverrides,
): ResolvedSkinSlots {
  const resolvedSlots = {} as ResolvedSkinSlots;

  for (const slotDefinition of SKIN_SLOT_DEFINITIONS) {
    const defaultAdapterId = getSkinSlotDefaultAdapterId(
      themeDefinition.skin,
      slotDefinition.id,
    );
    const fallbackAdapter =
      getSkinSlotAdapter(slotDefinition.id, defaultAdapterId) ??
      getSkinSlotAdapter(slotDefinition.id, slotDefinition.defaultAdapterId) ??
      slotDefinition.adapters[0];
    const overrideAdapterId = slotOverrides[slotDefinition.id];
    const overrideAdapter =
      overrideAdapterId &&
      canOverrideSkinSlot(themeDefinition, slotDefinition.id)
        ? getSkinSlotAdapter(slotDefinition.id, overrideAdapterId)
        : undefined;
    const adapter = overrideAdapter ?? fallbackAdapter;

    resolvedSlots[slotDefinition.id] = {
      adapter,
      adapterId: adapter.id,
      allowedAdapterIds: slotDefinition.adapters
        .filter((adapterOption) => adapterOption.status === "ready")
        .map((adapterOption) => adapterOption.id),
      defaultAdapterId: fallbackAdapter.id,
      definition: slotDefinition,
      isUserConfigurable: canOverrideSkinSlot(
        themeDefinition,
        slotDefinition.id,
      ),
      source: overrideAdapter ? "userOverride" : "themeDefault",
    };
  }

  return resolvedSlots;
}
