import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  type SkinCatalogStatus,
  skinCatalogStatusLabel,
  skinUiCatalog,
} from "@/shared/theme/skin-ui-catalog";
import { THEME_DEFINITIONS } from "@/shared/theme/theme-registry";
import type { ThemeDefinition, ThemeId } from "@/shared/theme/types";
import { useTheme, useThemeId } from "@/shared/theme/use-app-theme";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppIconButton,
  AppInput,
  AppListRow,
  AppSheet,
  AppSurface,
} from "@/shared/ui";
import { EmptyState } from "@/shared/ui/empty-state";
import { ScreenHeader } from "@/shared/ui/screen-header";
import { SkeletonBone } from "@/shared/ui/skeleton";
import { ToggleSwitch } from "@/shared/ui/toggle-switch";

type IconName = keyof typeof MaterialIcons.glyphMap;

const statusTone: Record<SkinCatalogStatus, "success" | "info" | "warning"> = {
  ready: "success",
  preview: "info",
  todo: "warning",
};

const themeAccessLabel: Record<ThemeDefinition["access"], string> = {
  free: "免费",
  limited: "限时",
  premium: "高级",
};

const themeFamilyLabel: Record<ThemeDefinition["family"], string> = {
  classic: "简洁基础系",
  waylog: "默认精致系",
};

const themeIdLabel: Record<ThemeId, string> = {
  classic: "简洁基础皮肤",
  default: "默认精致皮肤",
};

const homeLayoutLabel = {
  dashboard: "仪表盘首页",
  simpleList: "简洁列表",
  todayFirst: "今日优先",
} as const;

const tabBarLabel = {
  centerAdd: "中间加号",
  rightFab: "右下悬浮",
} as const;
const formMiniatureInputKeys = ["name", "date", "destination", "note"] as const;
const settingsMiniatureRowKeys = [
  "account",
  "appearance",
  "preferences",
  "privacy",
  "about",
] as const;
const searchMiniatureResultKeys = ["trip", "place", "memo", "expense"] as const;

const primaryActionLabel = {
  bottomRight: "右下角",
  center: "底部居中",
} as const;

const buttonSamples = [
  { title: "主按钮", variant: "primary", icon: "check" },
  { title: "次按钮", variant: "secondary", icon: "bookmark-border" },
  { title: "轻按钮", variant: "ghost", icon: "more-horiz" },
  { title: "危险按钮", variant: "danger", icon: "delete-outline" },
] as const;

const badgeSamples = [
  { label: "信息", tone: "info" },
  { label: "成功", tone: "success" },
  { label: "提醒", tone: "warning" },
  { label: "危险", tone: "danger" },
] as const;

const cardSamples = [
  { title: "普通卡片", variant: "default" },
  { title: "强调卡片", variant: "elevated" },
  { title: "个人卡片", variant: "profile" },
  { title: "票券卡片", variant: "ticket" },
] as const;

const surfaceSamples = [
  { title: "页面底色", variant: "default" },
  { title: "弱背景", variant: "muted" },
  { title: "抬起表面", variant: "raised" },
] as const;

const pagePreviews = [
  {
    title: "首页 / 行程列表",
    description: "行程卡、今日入口、搜索与创建入口。",
    icon: "map",
    kind: "home",
    status: "preview",
  },
  {
    title: "新建 / 编辑行程",
    description: "表单密度、日期、目的地、预算与保存按钮。",
    icon: "edit-note",
    kind: "form",
    status: "preview",
  },
  {
    title: "行程详情",
    description: "地图、每日安排、预算、清单、路线模块。",
    icon: "route",
    kind: "detail",
    status: "preview",
  },
  {
    title: "我的 / 账号",
    description: "头像区、账号状态、资料入口与安全操作。",
    icon: "person-outline",
    kind: "profile",
    status: "preview",
  },
  {
    title: "设置页面组",
    description: "外观、偏好、关于、隐私、反馈入口。",
    icon: "settings",
    kind: "settings",
    status: "preview",
  },
  {
    title: "智能助手对话",
    description: "消息流、快捷建议、提案确认与候选地点。",
    icon: "auto-awesome",
    kind: "agent",
    status: "preview",
  },
  {
    title: "全局搜索",
    description: "搜索框、结果分组、空状态与历史记录。",
    icon: "search",
    kind: "search",
    status: "preview",
  },
] as const;

const dialogPreviews = [
  {
    title: "确认弹窗",
    description: "删除、退出登录、覆盖写入等高风险确认。",
    icon: "priority-high",
    kind: "confirm",
    status: "preview",
  },
  {
    title: "底部弹层",
    description: "加号面板、地点操作、列表筛选和更多动作。",
    icon: "vertical-align-bottom",
    kind: "sheet",
    status: "preview",
  },
  {
    title: "表单弹窗",
    description: "记账、清单、备忘、日期、住宿交通编辑。",
    icon: "dynamic-form",
    kind: "form",
    status: "preview",
  },
  {
    title: "搜索弹窗",
    description: "地点搜索、收藏地点、目的地选择与候选结果。",
    icon: "travel-explore",
    kind: "search",
    status: "preview",
  },
  {
    title: "智能助手提案弹窗",
    description: "操作预览、候选消歧、确认执行和错误反馈。",
    icon: "auto-fix-high",
    kind: "agent",
    status: "preview",
  },
] as const;

export function ThemeLabScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { setThemeId, themeId } = useThemeId();
  const tokens = theme.tokens;

  return (
    <AppSurface style={styles.root} variant="default">
      <ScreenHeader
        onBack={() => router.back()}
        style={[styles.header, { borderBottomColor: tokens.colors.border }]}
        title="皮肤实验室"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemeSwitcher activeThemeId={themeId} onSelectTheme={setThemeId} />

        <LabSection eyebrow="总览" title="全项目可设计清单">
          <View style={styles.inventoryGrid}>
            {skinUiCatalog.map((group) => (
              <InventoryGroup
                description={group.description}
                icon={group.icon as IconName}
                items={group.items}
                key={group.id}
                title={group.title}
              />
            ))}
          </View>
        </LabSection>

        <LabSection eyebrow="当前皮肤" title="生效配置">
          <AppCard style={styles.identityCard} variant="elevated">
            <View style={styles.identityHeader}>
              <View
                style={[
                  styles.identityIcon,
                  { backgroundColor: tokens.colors.primarySoft },
                ]}
              >
                <MaterialIcons
                  name="palette"
                  size={20}
                  color={tokens.colors.primary}
                />
              </View>
              <View style={styles.identityCopy}>
                <Text
                  style={[styles.kicker, { color: tokens.colors.textMuted }]}
                >
                  正在使用
                </Text>
                <Text
                  style={[styles.screenTitle, { color: tokens.colors.text }]}
                >
                  {theme.displayName}
                </Text>
              </View>
              <AppBadge
                label={themeAccessLabel[theme.access]}
                tone={theme.access === "free" ? "success" : "warning"}
              />
            </View>
            <View style={styles.metaGrid}>
              <MetaPill label="皮肤编号" value={themeIdLabel[theme.id]} />
              <MetaPill
                label="皮肤类型"
                value={themeFamilyLabel[theme.family]}
              />
              <MetaPill
                label="基础色组"
                value={theme.classicPalette?.name ?? "默认色组"}
              />
              <MetaPill
                label="首页布局"
                value={homeLayoutLabel[theme.defaultHomeLayoutPreset]}
              />
            </View>
          </AppCard>
        </LabSection>

        <LabSection eyebrow="材料" title="设计令牌">
          <AppCard style={styles.tokenCard} variant="default">
            <View style={styles.swatchRow}>
              <ColorSwatch label="主色" value={tokens.colors.primary} />
              <ColorSwatch label="页面" value={tokens.colors.background} />
              <ColorSwatch label="卡片" value={tokens.colors.surface} />
              <ColorSwatch label="文字" value={tokens.colors.text} />
            </View>
            <View style={styles.metaGrid}>
              <MetaPill
                label="明暗模式"
                value={tokens.mode === "dark" ? "深色" : "浅色"}
              />
              <MetaPill label="中圆角" value={`${tokens.radius.md}px`} />
              <MetaPill label="中间距" value={`${tokens.spacing.md}px`} />
              <MetaPill label="阴影层级" value="卡片 / 弹层 / 悬浮" />
            </View>
          </AppCard>
        </LabSection>

        <LabSection eyebrow="外壳" title="导航与全局动作">
          <AppCard style={styles.shellCard} variant="default">
            <View style={styles.shellPreview}>
              <View
                style={[
                  styles.shellTabPill,
                  {
                    backgroundColor: tokens.colors.surfaceMuted,
                    borderColor: tokens.colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="map"
                  size={16}
                  color={tokens.colors.primary}
                />
                <View
                  style={[
                    styles.shellMiniLabel,
                    { backgroundColor: tokens.colors.primarySoft },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.shellAddButton,
                  {
                    backgroundColor: tokens.colors.primary,
                    borderColor: tokens.colors.navigation.floatingBorder,
                  },
                ]}
              >
                <MaterialIcons
                  name="add"
                  size={18}
                  color={tokens.colors.onPrimary}
                />
              </View>
              <View
                style={[
                  styles.shellTabPill,
                  {
                    backgroundColor: tokens.colors.surfaceMuted,
                    borderColor: tokens.colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="person-outline"
                  size={16}
                  color={tokens.colors.textMuted}
                />
                <View
                  style={[
                    styles.shellMiniLabel,
                    { backgroundColor: tokens.colors.borderStrong },
                  ]}
                />
              </View>
            </View>
            <View style={styles.metaGrid}>
              <MetaPill
                label="导航样式"
                value={tabBarLabel[theme.shell.tabBarPreset]}
              />
              <MetaPill
                label="主按钮位置"
                value={primaryActionLabel[theme.shell.primaryActionPlacement]}
              />
            </View>
          </AppCard>
        </LabSection>

        <LabSection eyebrow="页面" title="页面级预览">
          <View style={styles.previewGrid}>
            {pagePreviews.map((preview) => (
              <PagePreview
                description={preview.description}
                icon={preview.icon}
                key={preview.title}
                kind={preview.kind}
                status={preview.status}
                title={preview.title}
              />
            ))}
          </View>
        </LabSection>

        <LabSection eyebrow="弹窗" title="弹窗与底部弹层预览">
          <View style={styles.previewGrid}>
            {dialogPreviews.map((preview) => (
              <DialogPreview
                description={preview.description}
                icon={preview.icon}
                key={preview.title}
                kind={preview.kind}
                status={preview.status}
                title={preview.title}
              />
            ))}
          </View>
        </LabSection>

        <LabSection eyebrow="基础" title="按钮与图标动作">
          <View style={styles.buttonGrid}>
            {buttonSamples.map((sample) => (
              <AppButton
                icon={
                  <MaterialIcons
                    color={
                      theme.recipes.button[sample.variant].color ??
                      tokens.colors.text
                    }
                    name={sample.icon}
                    size={17}
                  />
                }
                key={sample.variant}
                title={sample.title}
                variant={sample.variant}
              />
            ))}
          </View>
          <View style={styles.iconRow}>
            <AppIconButton
              accessibilityLabel="保存"
              icon={
                <MaterialIcons
                  name="save-alt"
                  size={20}
                  color={tokens.colors.primary}
                />
              }
              variant="secondary"
            />
            <AppIconButton
              accessibilityLabel="搜索"
              icon={
                <MaterialIcons
                  name="search"
                  size={20}
                  color={tokens.colors.primary}
                />
              }
              variant="ghost"
            />
            <AppIconButton
              accessibilityLabel="删除"
              icon={
                <MaterialIcons
                  name="delete-outline"
                  size={20}
                  color={tokens.colors.onPrimary}
                />
              }
              variant="danger"
            />
          </View>
        </LabSection>

        <LabSection eyebrow="基础" title="卡片、徽章、输入框">
          <View style={styles.badgeRow}>
            {badgeSamples.map((sample) => (
              <AppBadge
                key={sample.tone}
                label={sample.label}
                tone={sample.tone}
              />
            ))}
          </View>
          <View style={styles.cardGrid}>
            {cardSamples.map((sample) => (
              <AppCard
                key={sample.variant}
                style={styles.sampleCard}
                variant={sample.variant}
              >
                <Text style={[styles.cardTitle, { color: tokens.colors.text }]}>
                  {sample.title}
                </Text>
                <Text
                  style={[styles.cardBody, { color: tokens.colors.textMuted }]}
                >
                  用来观察背景、边框、圆角、阴影和内容密度。
                </Text>
              </AppCard>
            ))}
          </View>
          <View style={styles.inputStack}>
            <AppInput label="普通输入" placeholder="输入行程名称" />
            <AppInput
              label="搜索输入"
              placeholder="搜索城市、地点、行程"
              variant="search"
            />
            <AppInput
              errorText="这里会显示错误原因"
              label="错误输入"
              placeholder="预算金额"
            />
          </View>
        </LabSection>

        <LabSection eyebrow="基础" title="列表、开关、空状态和加载">
          <View style={styles.listStack}>
            <AppListRow
              description="设置页、账号页、详情入口会大量使用。"
              leading={
                <MaterialIcons
                  name="tune"
                  size={20}
                  color={tokens.colors.primary}
                />
              }
              title="列表行"
              trailing={
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={tokens.colors.textMuted}
                />
              }
            />
            <AppListRow
              description="用于偏好设置、智能助手快捷代办等开关项。"
              leading={
                <MaterialIcons
                  name="bolt"
                  size={20}
                  color={tokens.colors.primary}
                />
              }
              title="开关行"
              trailing={
                <ToggleSwitch
                  onValueChange={() => undefined}
                  value
                  variant="setting"
                />
              }
            />
            <AppListRow
              description="更强风格的局部开关。"
              leading={
                <MaterialIcons
                  name="auto-awesome"
                  size={20}
                  color={tokens.colors.primary}
                />
              }
              title="强调开关"
              trailing={
                <ToggleSwitch
                  onValueChange={() => undefined}
                  value={false}
                  variant="accent"
                />
              }
            />
          </View>
          <View style={styles.stateGrid}>
            <AppCard style={styles.stateCard} variant="default">
              <EmptyState
                actionLabel="新建行程"
                description="这里展示列表为空时的文字、图标和按钮密度。"
                icon="map"
                onActionPress={() => undefined}
                title="还没有行程"
              />
            </AppCard>
            <AppCard style={styles.stateCard} variant="default">
              <View style={styles.skeletonStack}>
                <SkeletonBone height={22} />
                <SkeletonBone height={14} width={180} />
                <SkeletonBone height={14} width={130} />
                <View style={styles.skeletonFooter}>
                  <SkeletonBone height={28} width={72} />
                  <SkeletonBone height={28} width={96} />
                </View>
              </View>
            </AppCard>
          </View>
        </LabSection>

        <LabSection eyebrow="表面" title="页面容器与底部面板">
          <View style={styles.surfaceGrid}>
            {surfaceSamples.map((sample) => (
              <AppSurface
                key={sample.variant}
                style={styles.surfaceSample}
                variant={sample.variant}
              >
                <Text style={[styles.cardTitle, { color: tokens.colors.text }]}>
                  {sample.title}
                </Text>
                <Text
                  style={[styles.cardBody, { color: tokens.colors.textMuted }]}
                >
                  用来校验整页背景、弱背景和抬起容器的层级关系。
                </Text>
              </AppSurface>
            ))}
          </View>
          <AppSheet
            description="用于加号面板、地点操作、筛选和更多动作。"
            title="底部面板"
            variant="default"
          >
            <View style={styles.sheetActionGrid}>
              <SheetAction icon="add-location-alt" title="添加地点" />
              <SheetAction icon="receipt-long" title="记一笔" />
              <SheetAction icon="checklist" title="加清单" />
            </View>
          </AppSheet>
        </LabSection>

        <LabSection eyebrow="旅行" title="旅行业务模块">
          <TravelModulePreview />
        </LabSection>

        <LabSection eyebrow="助手" title="对话、候选与提案模块">
          <AgentModulePreview />
        </LabSection>
      </ScrollView>
    </AppSurface>
  );
}

type ThemeSwitcherProps = {
  activeThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
};

function ThemeSwitcher({ activeThemeId, onSelectTheme }: ThemeSwitcherProps) {
  return (
    <LabSection eyebrow="切换" title="皮肤选择">
      <View style={styles.themeGrid}>
        {THEME_DEFINITIONS.map((definition) => (
          <ThemeOptionCard
            active={definition.id === activeThemeId}
            definition={definition}
            key={definition.id}
            onPress={() => onSelectTheme(definition.id)}
          />
        ))}
      </View>
    </LabSection>
  );
}

type ThemeOptionCardProps = {
  active: boolean;
  definition: ThemeDefinition;
  onPress: () => void;
};

function ThemeOptionCard({
  active,
  definition,
  onPress,
}: ThemeOptionCardProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <AppCard
      style={[
        styles.themeOption,
        active ? { borderColor: tokens.colors.primary } : null,
      ]}
      variant={active ? "elevated" : "default"}
    >
      <View style={styles.themeOptionHeader}>
        <View>
          <Text
            style={[styles.themeOptionTitle, { color: tokens.colors.text }]}
          >
            {definition.displayName}
          </Text>
          <Text
            style={[styles.themeOptionMeta, { color: tokens.colors.textMuted }]}
          >
            {themeFamilyLabel[definition.family]} ·{" "}
            {themeIdLabel[definition.id]}
          </Text>
        </View>
        <AppBadge
          label={active ? "使用中" : themeAccessLabel[definition.access]}
          tone={active ? "success" : "info"}
        />
      </View>
      <Text
        style={[
          styles.themeOptionDescription,
          { color: tokens.colors.textMuted },
        ]}
      >
        {definition.description}
      </Text>
      <AppButton
        disabled={active}
        icon={
          active ? (
            <MaterialIcons
              name="done"
              size={17}
              color={tokens.colors.onPrimary}
            />
          ) : undefined
        }
        onPress={onPress}
        title={active ? "当前皮肤" : "切换到这里"}
        variant={active ? "primary" : "secondary"}
      />
    </AppCard>
  );
}

type LabSectionProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
};

function LabSection({ children, eyebrow, title }: LabSectionProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionEyebrow, { color: tokens.colors.primary }]}>
          {eyebrow}
        </Text>
        <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

type InventoryGroupProps = {
  description: string;
  icon: IconName;
  items: readonly {
    status: SkinCatalogStatus;
    title: string;
  }[];
  title: string;
};

function InventoryGroup({
  description,
  icon,
  items,
  title,
}: InventoryGroupProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <AppCard style={styles.inventoryCard} variant="default">
      <View style={styles.inventoryHeader}>
        <View
          style={[
            styles.smallIcon,
            { backgroundColor: tokens.colors.primarySoft },
          ]}
        >
          <MaterialIcons color={tokens.colors.primary} name={icon} size={18} />
        </View>
        <Text style={[styles.inventoryTitle, { color: tokens.colors.text }]}>
          {title}
        </Text>
      </View>
      <Text
        style={[
          styles.inventoryDescription,
          { color: tokens.colors.textMuted },
        ]}
      >
        {description}
      </Text>
      <View style={styles.inventoryList}>
        {items.map((item) => (
          <ModuleChip
            key={item.title}
            status={item.status}
            title={item.title}
          />
        ))}
      </View>
    </AppCard>
  );
}

type ModuleChipProps = {
  status: SkinCatalogStatus;
  title: string;
};

function ModuleChip({ status, title }: ModuleChipProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.moduleChip,
        {
          backgroundColor: tokens.colors.surfaceMuted,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <Text style={[styles.moduleTitle, { color: tokens.colors.text }]}>
        {title}
      </Text>
      <AppBadge
        label={skinCatalogStatusLabel[status]}
        tone={statusTone[status]}
      />
    </View>
  );
}

type MetaPillProps = {
  label: string;
  value: string;
};

function MetaPill({ label, value }: MetaPillProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.metaPill,
        {
          backgroundColor: tokens.colors.surfaceMuted,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <Text style={[styles.metaLabel, { color: tokens.colors.textMuted }]}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.metaValue, { color: tokens.colors.text }]}
      >
        {value}
      </Text>
    </View>
  );
}

type ColorSwatchProps = {
  label: string;
  value: string;
};

function ColorSwatch({ label, value }: ColorSwatchProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.swatchItem}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: value, borderColor: tokens.colors.border },
        ]}
      />
      <Text style={[styles.swatchLabel, { color: tokens.colors.textMuted }]}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.swatchValue, { color: tokens.colors.text }]}
      >
        {value}
      </Text>
    </View>
  );
}

type PagePreviewProps = {
  description: string;
  icon: IconName;
  kind: (typeof pagePreviews)[number]["kind"];
  status: SkinCatalogStatus;
  title: string;
};

function PagePreview({
  description,
  icon,
  kind,
  status,
  title,
}: PagePreviewProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <AppCard style={styles.previewCard} variant="default">
      <PreviewCardHeader
        description={description}
        icon={icon}
        status={status}
        title={title}
      />
      <View
        style={[
          styles.phoneFrame,
          {
            backgroundColor: tokens.colors.background,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.phoneTopBar,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.phoneTitleLine,
              { backgroundColor: tokens.colors.text },
            ]}
          />
          <View
            style={[
              styles.phoneDot,
              { backgroundColor: tokens.colors.primary },
            ]}
          />
        </View>
        {renderPageMiniature(kind)}
      </View>
    </AppCard>
  );
}

function renderPageMiniature(kind: (typeof pagePreviews)[number]["kind"]) {
  switch (kind) {
    case "home":
      return <HomeMiniature />;
    case "form":
      return <FormMiniature />;
    case "detail":
      return <DetailMiniature />;
    case "profile":
      return <ProfileMiniature />;
    case "settings":
      return <SettingsMiniature />;
    case "agent":
      return <AgentMiniature />;
    case "search":
      return <SearchMiniature />;
    default:
      return null;
  }
}

type DialogPreviewProps = {
  description: string;
  icon: IconName;
  kind: (typeof dialogPreviews)[number]["kind"];
  status: SkinCatalogStatus;
  title: string;
};

function DialogPreview({
  description,
  icon,
  kind,
  status,
  title,
}: DialogPreviewProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <AppCard style={styles.previewCard} variant="default">
      <PreviewCardHeader
        description={description}
        icon={icon}
        status={status}
        title={title}
      />
      <View
        style={[
          styles.dialogStage,
          {
            backgroundColor: tokens.colors.background,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        {renderDialogMiniature(kind)}
      </View>
    </AppCard>
  );
}

function renderDialogMiniature(kind: (typeof dialogPreviews)[number]["kind"]) {
  switch (kind) {
    case "confirm":
      return <ConfirmDialogMiniature />;
    case "sheet":
      return <BottomSheetMiniature />;
    case "form":
      return <FormDialogMiniature />;
    case "search":
      return <SearchDialogMiniature />;
    case "agent":
      return <AgentDialogMiniature />;
    default:
      return null;
  }
}

type PreviewCardHeaderProps = {
  description: string;
  icon: IconName;
  status: SkinCatalogStatus;
  title: string;
};

function PreviewCardHeader({
  description,
  icon,
  status,
  title,
}: PreviewCardHeaderProps) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.previewHeader}>
      <View
        style={[
          styles.smallIcon,
          { backgroundColor: tokens.colors.primarySoft },
        ]}
      >
        <MaterialIcons color={tokens.colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.previewHeaderCopy}>
        <View style={styles.previewTitleRow}>
          <Text style={[styles.previewTitle, { color: tokens.colors.text }]}>
            {title}
          </Text>
          <AppBadge
            label={skinCatalogStatusLabel[status]}
            tone={statusTone[status]}
          />
        </View>
        <Text
          style={[
            styles.previewDescription,
            { color: tokens.colors.textMuted },
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

function HomeMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      <View
        style={[
          styles.miniSearch,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View
        style={[
          styles.miniTripCard,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.miniLineStrong,
            { backgroundColor: tokens.colors.text },
          ]}
        />
        <View
          style={[
            styles.miniLine,
            { backgroundColor: tokens.colors.textMuted },
          ]}
        />
        <View style={styles.miniBadgeRow}>
          <View
            style={[
              styles.miniBadge,
              { backgroundColor: tokens.colors.primarySoft },
            ]}
          />
          <View
            style={[
              styles.miniBadge,
              { backgroundColor: tokens.colors.successSoft },
            ]}
          />
        </View>
      </View>
      <View style={styles.miniGridTwo}>
        <View
          style={[
            styles.miniTile,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        />
        <View
          style={[
            styles.miniTile,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        />
      </View>
    </View>
  );
}

function FormMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      {formMiniatureInputKeys.map((inputKey) => (
        <View
          key={inputKey}
          style={[
            styles.miniInput,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        />
      ))}
      <View
        style={[styles.miniButton, { backgroundColor: tokens.colors.primary }]}
      />
    </View>
  );
}

function DetailMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      <View
        style={[
          styles.miniMap,
          {
            backgroundColor: tokens.colors.primarySoft,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <MaterialIcons color={tokens.colors.primary} name="place" size={18} />
      </View>
      <View style={styles.miniGridTwo}>
        <View
          style={[
            styles.miniTile,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        />
        <View
          style={[
            styles.miniTile,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.miniTimeline,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: tokens.colors.primary },
          ]}
        />
        <View
          style={[
            styles.miniLine,
            { backgroundColor: tokens.colors.textMuted },
          ]}
        />
      </View>
    </View>
  );
}

function ProfileMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      <View
        style={[
          styles.profileHero,
          {
            backgroundColor: tokens.colors.primarySoft,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: tokens.colors.primary },
          ]}
        />
        <View
          style={[
            styles.miniLineStrong,
            { backgroundColor: tokens.colors.text },
          ]}
        />
      </View>
      <View
        style={[
          styles.miniListBlock,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View
        style={[
          styles.miniListBlock,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      />
    </View>
  );
}

function SettingsMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      {settingsMiniatureRowKeys.map((rowKey) => (
        <View
          key={rowKey}
          style={[
            styles.settingsRow,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.settingsIcon,
              { backgroundColor: tokens.colors.primarySoft },
            ]}
          />
          <View
            style={[
              styles.settingsLine,
              { backgroundColor: tokens.colors.textMuted },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function AgentMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      <View
        style={[
          styles.agentBubbleLeft,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View
        style={[
          styles.agentBubbleRight,
          { backgroundColor: tokens.colors.primary },
        ]}
      />
      <View
        style={[
          styles.agentProposal,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.miniLineStrong,
            { backgroundColor: tokens.colors.text },
          ]}
        />
        <View
          style={[
            styles.miniButton,
            { backgroundColor: tokens.colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

function SearchMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.miniStack}>
      <View
        style={[
          styles.miniSearch,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      {searchMiniatureResultKeys.map((resultKey) => (
        <View
          key={resultKey}
          style={[
            styles.searchResultRow,
            {
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.settingsIcon,
              { backgroundColor: tokens.colors.primarySoft },
            ]}
          />
          <View
            style={[
              styles.settingsLine,
              { backgroundColor: tokens.colors.textMuted },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function ConfirmDialogMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.dialogOverlay}>
      <View
        style={[
          styles.confirmBox,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <MaterialIcons
          color={tokens.colors.danger}
          name="warning-amber"
          size={20}
        />
        <View
          style={[
            styles.miniLineStrong,
            { backgroundColor: tokens.colors.text },
          ]}
        />
        <View
          style={[
            styles.miniLine,
            { backgroundColor: tokens.colors.textMuted },
          ]}
        />
        <View style={styles.dialogButtonRow}>
          <View
            style={[
              styles.dialogButton,
              { backgroundColor: tokens.colors.surfaceMuted },
            ]}
          />
          <View
            style={[
              styles.dialogButton,
              { backgroundColor: tokens.colors.danger },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function BottomSheetMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.bottomSheetStage}>
      <View
        style={[
          styles.bottomSheetBox,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.sheetHandle,
            { backgroundColor: tokens.colors.borderStrong },
          ]}
        />
        <View style={styles.sheetIconRow}>
          <SheetMiniIcon icon="map" />
          <SheetMiniIcon icon="auto-awesome" />
          <SheetMiniIcon icon="receipt-long" />
        </View>
      </View>
    </View>
  );
}

function SheetMiniIcon({ icon }: { icon: IconName }) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.sheetMiniIcon,
        { backgroundColor: tokens.colors.primarySoft },
      ]}
    >
      <MaterialIcons color={tokens.colors.primary} name={icon} size={17} />
    </View>
  );
}

function FormDialogMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.formDialogBox,
        {
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <View
        style={[styles.miniLineStrong, { backgroundColor: tokens.colors.text }]}
      />
      <View
        style={[
          styles.miniInput,
          {
            backgroundColor: tokens.colors.surfaceMuted,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View
        style={[
          styles.miniInput,
          {
            backgroundColor: tokens.colors.surfaceMuted,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View
        style={[styles.miniButton, { backgroundColor: tokens.colors.primary }]}
      />
    </View>
  );
}

function SearchDialogMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.formDialogBox,
        {
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.miniSearch,
          {
            backgroundColor: tokens.colors.surfaceMuted,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View style={styles.searchChipRow}>
        <View
          style={[
            styles.searchChip,
            { backgroundColor: tokens.colors.primarySoft },
          ]}
        />
        <View
          style={[
            styles.searchChip,
            { backgroundColor: tokens.colors.successSoft },
          ]}
        />
      </View>
      <View
        style={[
          styles.searchResultRow,
          {
            backgroundColor: tokens.colors.surfaceMuted,
            borderColor: tokens.colors.border,
          },
        ]}
      />
    </View>
  );
}

function AgentDialogMiniature() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.formDialogBox,
        {
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <View style={styles.agentDialogTitleRow}>
        <MaterialIcons
          color={tokens.colors.primary}
          name="auto-awesome"
          size={18}
        />
        <View
          style={[
            styles.miniLineStrong,
            { backgroundColor: tokens.colors.text },
          ]}
        />
      </View>
      <View
        style={[
          styles.agentOperationRow,
          {
            backgroundColor: tokens.colors.primarySoft,
            borderColor: tokens.colors.border,
          },
        ]}
      />
      <View style={styles.dialogButtonRow}>
        <View
          style={[
            styles.dialogButton,
            { backgroundColor: tokens.colors.surfaceMuted },
          ]}
        />
        <View
          style={[
            styles.dialogButton,
            { backgroundColor: tokens.colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

function SheetAction({ icon, title }: { icon: IconName; title: string }) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.sheetAction,
        {
          backgroundColor: tokens.colors.surfaceMuted,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <MaterialIcons color={tokens.colors.primary} name={icon} size={20} />
      <Text style={[styles.sheetActionText, { color: tokens.colors.text }]}>
        {title}
      </Text>
    </View>
  );
}

function TravelModulePreview() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.travelGrid}>
      <AppCard style={styles.travelLargeCard} variant="elevated">
        <View style={styles.travelHeroHeader}>
          <View>
            <Text style={[styles.travelTitle, { color: tokens.colors.text }]}>
              云南 5 日
            </Text>
            <Text style={[styles.cardBody, { color: tokens.colors.textMuted }]}>
              今日：大理古城 · 洱海骑行
            </Text>
          </View>
          <AppBadge label="进行中" tone="success" />
        </View>
        <View style={styles.travelStatsRow}>
          <TravelStat label="地点" value="18" />
          <TravelStat label="预算" value="¥3.2k" />
          <TravelStat label="清单" value="12/18" />
        </View>
      </AppCard>
      <TravelSmallModule icon="event" title="今日行程" value="4 个安排" />
      <TravelSmallModule icon="cloud" title="天气" value="24° 多云" />
      <TravelSmallModule icon="route" title="路线" value="步行 12 分钟" />
      <TravelSmallModule icon="checklist" title="打包清单" value="还有 6 项" />
    </View>
  );
}

function TravelStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View
      style={[
        styles.travelStat,
        {
          backgroundColor: tokens.colors.surfaceMuted,
          borderColor: tokens.colors.border,
        },
      ]}
    >
      <Text style={[styles.travelStatValue, { color: tokens.colors.text }]}>
        {value}
      </Text>
      <Text
        style={[styles.travelStatLabel, { color: tokens.colors.textMuted }]}
      >
        {label}
      </Text>
    </View>
  );
}

function TravelSmallModule({
  icon,
  title,
  value,
}: {
  icon: IconName;
  title: string;
  value: string;
}) {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <AppCard style={styles.travelSmallCard} variant="default">
      <View
        style={[
          styles.smallIcon,
          { backgroundColor: tokens.colors.primarySoft },
        ]}
      >
        <MaterialIcons color={tokens.colors.primary} name={icon} size={18} />
      </View>
      <Text style={[styles.travelSmallTitle, { color: tokens.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.cardBody, { color: tokens.colors.textMuted }]}>
        {value}
      </Text>
    </AppCard>
  );
}

function AgentModulePreview() {
  const theme = useTheme();
  const tokens = theme.tokens;

  return (
    <View style={styles.agentGrid}>
      <AppCard style={styles.agentConversationCard} variant="default">
        <View
          style={[
            styles.chatBubble,
            {
              backgroundColor: tokens.colors.surfaceMuted,
              alignSelf: "flex-start",
            },
          ]}
        >
          <Text style={[styles.chatText, { color: tokens.colors.text }]}>
            帮我把洱海加入第 2 天。
          </Text>
        </View>
        <View
          style={[
            styles.chatBubble,
            {
              backgroundColor: tokens.colors.primarySoft,
              alignSelf: "flex-end",
            },
          ]}
        >
          <Text style={[styles.chatText, { color: tokens.colors.text }]}>
            我找到了候选地点，确认后写入行程。
          </Text>
        </View>
        <View style={styles.quickActionRow}>
          <AppBadge label="补全路线" tone="info" />
          <AppBadge label="整理清单" tone="success" />
          <AppBadge label="估算预算" tone="warning" />
        </View>
      </AppCard>
      <AppCard style={styles.agentProposalCard} variant="elevated">
        <View style={styles.agentProposalHeader}>
          <MaterialIcons
            color={tokens.colors.primary}
            name="auto-awesome"
            size={20}
          />
          <Text
            style={[styles.travelSmallTitle, { color: tokens.colors.text }]}
          >
            提案确认
          </Text>
          <AppBadge label="低风险" tone="success" />
        </View>
        <View
          style={[
            styles.agentOperationRow,
            {
              backgroundColor: tokens.colors.primarySoft,
              borderColor: tokens.colors.border,
            },
          ]}
        >
          <Text
            style={[styles.agentOperationText, { color: tokens.colors.text }]}
          >
            第 2 天 · 添加地点 · 洱海公园
          </Text>
        </View>
        <View style={styles.dialogButtonRow}>
          <AppButton title="稍后" variant="ghost" />
          <AppButton title="确认写入" variant="primary" />
        </View>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  agentBubbleLeft: {
    width: "70%",
    height: 26,
    borderWidth: 1,
    borderRadius: 12,
  },
  agentBubbleRight: {
    width: "62%",
    height: 28,
    alignSelf: "flex-end",
    borderRadius: 12,
  },
  agentConversationCard: {
    flex: 1,
    minWidth: 260,
    gap: 12,
    padding: 16,
  },
  agentDialogTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  agentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  agentOperationRow: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  agentOperationText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  agentProposal: {
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  agentProposalCard: {
    flex: 1,
    minWidth: 260,
    gap: 12,
    padding: 16,
  },
  agentProposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  bottomSheetBox: {
    width: "100%",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetStage: {
    flex: 1,
    justifyContent: "flex-end",
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cardBody: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  chatBubble: {
    maxWidth: "84%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  chatText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  confirmBox: {
    width: "82%",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  content: {
    gap: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  dialogButton: {
    flex: 1,
    height: 28,
    borderRadius: 10,
  },
  dialogButtonRow: {
    flexDirection: "row",
    gap: 8,
  },
  dialogOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    borderRadius: 18,
  },
  dialogStage: {
    height: 220,
    overflow: "hidden",
    padding: 12,
    borderWidth: 1,
    borderRadius: 20,
  },
  formDialogBox: {
    width: "100%",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  identityCard: {
    gap: 16,
    padding: 16,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  identityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  identityIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  inputStack: {
    gap: 12,
    marginTop: 12,
  },
  inventoryCard: {
    flex: 1,
    minWidth: 280,
    gap: 12,
    padding: 14,
  },
  inventoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  inventoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inventoryDescription: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  inventoryList: {
    gap: 8,
  },
  inventoryTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 14,
  },
  listStack: {
    gap: 10,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  metaPill: {
    minWidth: 122,
    flexGrow: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  miniBadge: {
    width: 44,
    height: 20,
    borderRadius: 10,
  },
  miniBadgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  miniButton: {
    width: "70%",
    height: 30,
    alignSelf: "flex-end",
    borderRadius: 12,
  },
  miniGridTwo: {
    flexDirection: "row",
    gap: 8,
  },
  miniInput: {
    height: 34,
    borderWidth: 1,
    borderRadius: 12,
  },
  miniLine: {
    width: "78%",
    height: 8,
    opacity: 0.42,
    borderRadius: 99,
  },
  miniLineStrong: {
    width: "62%",
    height: 10,
    opacity: 0.72,
    borderRadius: 99,
  },
  miniListBlock: {
    height: 38,
    borderWidth: 1,
    borderRadius: 12,
  },
  miniMap: {
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 16,
  },
  miniSearch: {
    height: 34,
    borderWidth: 1,
    borderRadius: 16,
  },
  miniStack: {
    gap: 9,
  },
  miniTile: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
  },
  miniTimeline: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  miniTripCard: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  moduleChip: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  moduleTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  phoneDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  phoneFrame: {
    minHeight: 250,
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 22,
  },
  phoneTitleLine: {
    width: "42%",
    height: 10,
    opacity: 0.68,
    borderRadius: 99,
  },
  phoneTopBar: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 16,
  },
  previewCard: {
    flex: 1,
    minWidth: 290,
    gap: 14,
    padding: 14,
  },
  previewDescription: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  previewHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  previewTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  previewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileHero: {
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  quickActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  root: {
    flex: 1,
  },
  sampleCard: {
    flex: 1,
    minWidth: 160,
    gap: 7,
    padding: 14,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  searchChip: {
    flex: 1,
    height: 24,
    borderRadius: 12,
  },
  searchChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchResultRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  section: {
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 28,
  },
  settingsIcon: {
    width: 20,
    height: 20,
    borderRadius: 8,
  },
  settingsLine: {
    flex: 1,
    height: 8,
    opacity: 0.42,
    borderRadius: 99,
  },
  settingsRow: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  sheetAction: {
    flex: 1,
    minWidth: 88,
    alignItems: "center",
    gap: 7,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  sheetActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sheetActionText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 99,
  },
  sheetIconRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 12,
  },
  sheetMiniIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  shellAddButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderRadius: 23,
  },
  shellCard: {
    gap: 16,
    padding: 16,
  },
  shellMiniLabel: {
    width: 42,
    height: 7,
    borderRadius: 99,
  },
  shellPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  shellTabPill: {
    minWidth: 104,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 22,
  },
  skeletonFooter: {
    flexDirection: "row",
    gap: 8,
  },
  skeletonStack: {
    gap: 12,
  },
  smallIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  stateCard: {
    flex: 1,
    minWidth: 260,
    padding: 16,
  },
  stateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  surfaceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  surfaceSample: {
    flex: 1,
    minWidth: 180,
    gap: 7,
    padding: 14,
    borderRadius: 14,
  },
  swatch: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
  },
  swatchItem: {
    flex: 1,
    minWidth: 120,
    gap: 6,
  },
  swatchLabel: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  swatchValue: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    minWidth: 260,
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  themeOptionDescription: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  themeOptionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  themeOptionMeta: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  themeOptionTitle: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tokenCard: {
    gap: 16,
    padding: 16,
  },
  travelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  travelHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  travelLargeCard: {
    flex: 2,
    minWidth: 290,
    gap: 14,
    padding: 16,
  },
  travelSmallCard: {
    flex: 1,
    minWidth: 160,
    gap: 8,
    padding: 14,
  },
  travelSmallTitle: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  travelStat: {
    flex: 1,
    minWidth: 82,
    gap: 2,
    padding: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  travelStatLabel: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  travelStatValue: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  travelStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  travelTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
});
