export type SkinCatalogStatus = "ready" | "preview" | "todo";

export type SkinCatalogLayer =
  | "shell"
  | "page-layout"
  | "page-module"
  | "ui-foundation"
  | "interaction-state"
  | "motion"
  | "preview";

export type SkinCatalogItem = {
  description: string;
  id: string;
  owner: "shell" | "domains" | "shared" | "features";
  previewTarget?: string;
  status: SkinCatalogStatus;
  title: string;
};

export type SkinCatalogGroup = {
  description: string;
  icon: string;
  id: string;
  items: SkinCatalogItem[];
  layer: SkinCatalogLayer;
  title: string;
};

export const skinCatalogStatusLabel: Record<SkinCatalogStatus, string> = {
  preview: "可预览",
  ready: "已接入",
  todo: "待接入",
};

export const skinCatalogLayerLabel: Record<SkinCatalogLayer, string> = {
  "interaction-state": "交互状态",
  motion: "动画系统",
  "page-layout": "页面布局",
  "page-module": "页面模块",
  preview: "预览入口",
  shell: "壳层结构",
  "ui-foundation": "基础 UI",
};

export const skinUiCatalog: SkinCatalogGroup[] = [
  {
    description:
      "App 外框、全局导航和跨页面主入口。这里决定页面被装进什么样的壳里。",
    icon: "dashboard-customize",
    id: "shell-structure",
    layer: "shell",
    title: "壳层结构",
    items: [
      {
        description:
          "底部主导航结构，已经支持 centerAdd / rightFab 两种 preset。",
        id: "shell.tab-bar",
        owner: "shell",
        previewTarget: "Theme Lab / 外观设置",
        status: "ready",
        title: "底部导航栏",
      },
      {
        description: "加号打开的全局快捷操作入口，包括新建行程、AI 规划等。",
        id: "shell.quick-action-sheet",
        owner: "shell",
        previewTarget: "Theme Lab / AppSheet",
        status: "ready",
        title: "加号快捷面板",
      },
      {
        description:
          "右下独立主按钮结构已可切换，后续需要继续打磨默认皮肤下的尺寸、层级和动效。",
        id: "shell.right-fab",
        owner: "shell",
        previewTarget: "外观设置",
        status: "preview",
        title: "右下悬浮主按钮",
      },
      {
        description:
          "ScreenHeader、返回按钮、页面标题、右侧动作区。后续不同皮肤可改成沉浸式、贴纸式或工具栏式。",
        id: "shell.screen-header",
        owner: "shared",
        previewTarget: "Theme Lab / 页面预览",
        status: "preview",
        title: "页面标题栏",
      },
      {
        description: "安全区、页面背景、内容最大宽度和底部操作避让。",
        id: "shell.safe-area-surface",
        owner: "shared",
        previewTarget: "Theme Lab / AppSurface",
        status: "preview",
        title: "页面背景与安全区",
      },
    ],
  },
  {
    description:
      "页面级骨架和模块顺序。这里决定同一业务页面在不同皮肤下的空间编排。",
    icon: "view-carousel",
    id: "page-layouts",
    layer: "page-layout",
    title: "页面布局",
    items: [
      {
        description:
          "首页模块顺序已接入 simpleList / todayFirst / dashboard preset。",
        id: "page.home",
        owner: "domains",
        previewTarget: "外观设置 / 首页",
        status: "ready",
        title: "首页 / 行程列表",
      },
      {
        description:
          "行程详情总览已接入 standard / itineraryFirst / journalFirst preset，天详情结构已接入 day layout preset。",
        id: "page.trip-detail",
        owner: "domains",
        previewTarget: "外观设置 / 行程详情",
        status: "ready",
        title: "行程详情",
      },
      {
        description:
          "新建行程页已接入 tripForm layout preset，可控制表单间距和卡片密度。",
        id: "page.trip-new",
        owner: "domains",
        previewTarget: "Theme Lab / 表单预览",
        status: "ready",
        title: "新建行程",
      },
      {
        description:
          "编辑行程页已接入 tripForm layout preset，保存区和批量编辑入口后续继续细化。",
        id: "page.trip-edit",
        owner: "domains",
        previewTarget: "Theme Lab / 表单预览",
        status: "ready",
        title: "编辑行程",
      },
      {
        description:
          "我的页已接入 profile layout preset，可先控制头像区和快捷入口密度。",
        id: "page.profile",
        owner: "domains",
        previewTarget: "Theme Lab / 我的页预览",
        status: "ready",
        title: "我的",
      },
      {
        description:
          "外观、偏好、关于、隐私、反馈等设置页需要统一列表密度和页面标题。",
        id: "page.settings-group",
        owner: "domains",
        previewTarget: "Theme Lab / 设置页面组",
        status: "preview",
        title: "设置页面组",
      },
      {
        description:
          "Agent 对话页已接入 conversation layout preset，可控制消息列宽、输入区密度和内容间距。",
        id: "page.agent-conversation",
        owner: "domains",
        previewTarget: "Theme Lab / 助手模块",
        status: "ready",
        title: "智能助手对话",
      },
      {
        description: "全局搜索页包含搜索框、结果分组、历史记录、空状态。",
        id: "page.global-search",
        owner: "domains",
        previewTarget: "Theme Lab / 搜索预览",
        status: "preview",
        title: "全局搜索",
      },
      {
        description:
          "地点详情、收藏地点、导入攻略等旅行辅助页面还未接入皮肤布局 preset。",
        id: "page.trip-supporting",
        owner: "domains",
        status: "todo",
        title: "旅行辅助页面组",
      },
    ],
  },
  {
    description:
      "页面内部可重排、可替换形态的业务模块。这里决定皮肤能控制哪些内容块。",
    icon: "widgets",
    id: "page-modules",
    layer: "page-module",
    title: "页面模块",
    items: [
      {
        description:
          "首页主展示卡，可演进为票券、纸片、玻璃、手账封面等不同结构。",
        id: "module.home.featured-trip",
        owner: "domains",
        previewTarget: "首页 / Theme Lab",
        status: "ready",
        title: "首页特色行程",
      },
      {
        description: "首页当日安排模块，可置顶、压缩成入口或展开成横向路线。",
        id: "module.home.today-plan",
        owner: "domains",
        previewTarget: "首页 / Theme Lab",
        status: "ready",
        title: "首页今日安排",
      },
      {
        description: "全部行程列表，后续需要支持卡片密度、分组和空状态风格。",
        id: "module.home.all-trips",
        owner: "domains",
        previewTarget: "首页",
        status: "ready",
        title: "首页全部行程",
      },
      {
        description:
          "详情页总览摘要、费用、清单、手账、路线、旅行信息已能按 preset 调整顺序。",
        id: "module.trip-detail.overview",
        owner: "domains",
        previewTarget: "行程详情",
        status: "ready",
        title: "详情页总览模块组",
      },
      {
        description:
          "沉浸式天行程已接入 day layout preset，可控制 Sheet 内地图预览和时间线优先级。",
        id: "module.trip-detail.day-immersive",
        owner: "domains",
        previewTarget: "行程详情 / 沉浸式日视图",
        status: "ready",
        title: "详情页天行程结构",
      },
      {
        description:
          "费用、清单、天气、路线、交通、住宿、备忘等旅行小卡需要统一语义接口。",
        id: "module.trip-detail.travel-cards",
        owner: "domains",
        previewTarget: "Theme Lab / 旅行业务模块",
        status: "preview",
        title: "旅行小卡模块",
      },
      {
        description:
          "Agent 消息、快捷建议、候选地点、提案确认、错误限流和用量审计。",
        id: "module.agent.cards",
        owner: "shared",
        previewTarget: "Theme Lab / 助手模块",
        status: "preview",
        title: "智能助手卡片组",
      },
    ],
  },
  {
    description:
      "跨页面复用的语义基础 UI。这里决定按钮、卡片、输入等家具长什么样。",
    icon: "category",
    id: "ui-foundation",
    layer: "ui-foundation",
    title: "基础 UI 零件",
    items: [
      {
        description:
          "AppButton / AppIconButton 已有语义 variant，后续需要更多尺寸和状态。",
        id: "ui.button",
        owner: "shared",
        previewTarget: "Theme Lab / 按钮与图标动作",
        status: "ready",
        title: "按钮 / 图标按钮",
      },
      {
        description:
          "AppCard 已有 default / elevated / profile / ticket recipe。",
        id: "ui.card",
        owner: "shared",
        previewTarget: "Theme Lab / 卡片",
        status: "ready",
        title: "卡片",
      },
      {
        description:
          "AppInput 已有 default / search / error，后续需要日期、金额、地点等输入语义。",
        id: "ui.input",
        owner: "shared",
        previewTarget: "Theme Lab / 输入框",
        status: "ready",
        title: "输入框",
      },
      {
        description:
          "AppListRow / AppBadge 已可预览，设置页、账号页、详情入口会大量使用。",
        id: "ui.list-row-badge",
        owner: "shared",
        previewTarget: "Theme Lab / 列表与徽章",
        status: "ready",
        title: "列表行 / 徽章",
      },
      {
        description: "AppSheet 已有基础外观，复杂业务 Sheet 仍需要逐步迁移。",
        id: "ui.sheet",
        owner: "shared",
        previewTarget: "Theme Lab / 底部面板",
        status: "ready",
        title: "底部弹层",
      },
      {
        description:
          "AppDialog 已建立，ConfirmDialog 已迁入统一语义外壳，长尾业务 Modal 后续逐步迁移。",
        id: "ui.dialog-modal",
        owner: "shared",
        previewTarget: "Theme Lab / 弹窗预览",
        status: "ready",
        title: "Dialog / Modal",
      },
      {
        description:
          "AppFeedback 已建立，可承接 Toast、InlineError、同步失败和限流提示的统一外观。",
        id: "ui.feedback",
        owner: "shared",
        previewTarget: "Theme Lab / 反馈提示",
        status: "ready",
        title: "Toast / 状态提示",
      },
      {
        description:
          "EmptyState、SkeletonBone 已可预览，后续要让所有页面复用同一语义。",
        id: "ui.empty-loading",
        owner: "shared",
        previewTarget: "Theme Lab / 空状态和加载",
        status: "preview",
        title: "空状态 / 加载态",
      },
    ],
  },
  {
    description:
      "同一个 UI 在不同状态下的表现。这里保证换皮肤后按压、禁用、错误等不会散掉。",
    icon: "touch-app",
    id: "interaction-states",
    layer: "interaction-state",
    title: "交互状态",
    items: [
      {
        description:
          "基础 pressed helper 已建立，AppButton / AppIconButton 已开始复用，长尾组件后续迁移。",
        id: "state.pressed",
        owner: "shared",
        previewTarget: "Theme Lab / 按钮",
        status: "ready",
        title: "pressed / hover",
      },
      {
        description:
          "disabled / loading helper 已建立，基础按钮已开始复用，触觉策略后续进入 motion preset。",
        id: "state.disabled-loading",
        owner: "shared",
        previewTarget: "Theme Lab / 按钮",
        status: "ready",
        title: "disabled / loading",
      },
      {
        description: "selected、active、checked、expanded 需要统一选中态层级。",
        id: "state.selected-active",
        owner: "shared",
        previewTarget: "Theme Lab / 列表与开关",
        status: "preview",
        title: "selected / active",
      },
      {
        description:
          "error、warning、success、info 要继续保持业务语义稳定，不随皮肤改变含义。",
        id: "state.semantic-feedback",
        owner: "shared",
        previewTarget: "Theme Lab / 徽章",
        status: "ready",
        title: "error / success / warning",
      },
      {
        description:
          "空数据、权限缺失、网络失败、骨架屏需要统一空状态语言和视觉密度。",
        id: "state.empty-skeleton",
        owner: "shared",
        previewTarget: "Theme Lab / 空状态和加载",
        status: "preview",
        title: "empty / skeleton",
      },
    ],
  },
  {
    description:
      "皮肤级动画与反馈。这里决定默认皮肤可以有微 3D，简洁皮肤可以更轻。",
    icon: "animation",
    id: "motion-system",
    layer: "motion",
    title: "动画系统",
    items: [
      {
        description: "基础转场、按压和展开动画，适合作为简洁皮肤默认动效。",
        id: "motion.simple",
        owner: "shared",
        status: "todo",
        title: "simple motion preset",
      },
      {
        description:
          "轻拟物、微 3D、纸片浮起、柔和回弹，适合作为默认精致皮肤方向。",
        id: "motion.soft-3d",
        owner: "shared",
        status: "todo",
        title: "soft3d motion preset",
      },
      {
        description:
          "未来高级皮肤可使用更强光效、扫描、滑入，但必须由皮肤 preset 管理。",
        id: "motion.premium-sci-fi",
        owner: "shared",
        status: "todo",
        title: "premiumSciFi motion preset",
      },
      {
        description: "触觉反馈强度、触发时机和降级策略需要进入 motion 配置。",
        id: "motion.haptics",
        owner: "shared",
        status: "todo",
        title: "触觉反馈策略",
      },
    ],
  },
  {
    description:
      "设计与验收入口。这里不是最终 UI，而是让每个模块能被独立看见、比较和打磨。",
    icon: "science",
    id: "preview-entry",
    layer: "preview",
    title: "预览入口",
    items: [
      {
        description:
          "Theme Lab 已能预览基础 UI、页面缩略图、弹窗、旅行和 Agent 模块。",
        id: "preview.theme-lab",
        owner: "domains",
        previewTarget: "/theme-lab",
        status: "ready",
        title: "Theme Lab",
      },
      {
        description:
          "外观设置已提供皮肤、底部导航、首页布局、详情页布局的真实开关。",
        id: "preview.appearance-settings",
        owner: "domains",
        previewTarget: "/appearance",
        status: "ready",
        title: "外观设置",
      },
      {
        description:
          "后续需要给每个 Catalog item 绑定真实预览组件或目标页面链接。",
        id: "preview.catalog-driven",
        owner: "shared",
        status: "todo",
        title: "Catalog 驱动预览",
      },
      {
        description: "后续设计默认皮肤时，需要为每个模块建立移动端截图验收点。",
        id: "preview.visual-regression",
        owner: "shared",
        status: "todo",
        title: "视觉验收清单",
      },
    ],
  },
];

export function getSkinCatalogGroupsByLayer(layer: SkinCatalogLayer) {
  return skinUiCatalog.filter((group) => group.layer === layer);
}

export function getSkinCatalogItemById(id: string) {
  for (const group of skinUiCatalog) {
    const item = group.items.find((candidate) => candidate.id === id);

    if (item) {
      return item;
    }
  }

  return undefined;
}
