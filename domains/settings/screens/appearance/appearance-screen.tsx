/**
 * Appearance settings with complete light/dark skin previews.
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SettingsPageShell } from "@/domains/settings/components/settings-page-shell";
import { AppIconPreview } from "@/domains/settings/screens/appearance/components/app-icon-preview";
import { ThemeModeSelector } from "@/domains/settings/screens/appearance/components/theme-mode-selector";
import {
  APP_ICON_PATTERNS,
  type AppIconPatternId,
  getAppIconPalette,
} from "@/features/appearance/app-icon";
import {
  SKIN_SLOT_DEFINITIONS,
  skinSlotSurfaceLabels,
} from "@/shared/theme/skin-slot-registry";
import type {
  SkinSlotAdapterId,
  SkinSlotId,
} from "@/shared/theme/skin-slot-types";
import { getThemeSkinMode, THEME_COLORS } from "@/shared/theme/theme-colors";
import type {
  HomeLayoutPresetPreference,
  ShellTabBarPresetPreference,
  ThemeId,
  TripDetailLayoutPresetPreference,
} from "@/shared/theme/types";
import {
  useAppIconPreference,
  useAppTheme,
  useHomeLayoutPreset,
  useShellTabBarPreset,
  useSkinSlots,
  useThemeColor,
  useThemeId,
  useThemePreference,
  useTripDetailLayoutPreset,
} from "@/shared/theme/use-app-theme";

const skinModeOptions: {
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  id: ThemeId;
  title: string;
}[] = [
  {
    description: "极简无装饰骨架，后续默认皮肤直接在这里打磨。",
    icon: "crop-square",
    id: "default",
    title: "默认模式",
  },
  {
    description: "保留当前基础 UI 和五种主题色。",
    icon: "palette",
    id: "classic",
    title: "简洁模式",
  },
];

const shellTabBarPresetOptions: {
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  id: ShellTabBarPresetPreference;
  title: string;
}[] = [
  {
    description: "默认模式使用右侧独立加号，简洁模式使用中间加号。",
    icon: "auto-awesome",
    id: "themeDefault",
    title: "跟随皮肤",
  },
  {
    description: "加号固定在底部导航中间，保留当前熟悉结构。",
    icon: "add-circle-outline",
    id: "centerAdd",
    title: "中间加号",
  },
  {
    description: "加号脱离导航栏，浮在右下侧，导航只保留主要入口。",
    icon: "add-location-alt",
    id: "rightFab",
    title: "右侧独立",
  },
];

const homeLayoutPresetOptions: {
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  id: HomeLayoutPresetPreference;
  title: string;
}[] = [
  {
    description: "使用当前皮肤声明的首页模块顺序。",
    icon: "auto-awesome",
    id: "themeDefault",
    title: "跟随皮肤",
  },
  {
    description: "特色行程、今日安排、全部行程保持当前基础顺序。",
    icon: "view-agenda",
    id: "simpleList",
    title: "简洁列表",
  },
  {
    description: "今日安排优先展示，适合旅途中快速查看当天路线。",
    icon: "today",
    id: "todayFirst",
    title: "今日优先",
  },
  {
    description: "预留给后续信息密度更高的首页控制台草稿。",
    icon: "dashboard",
    id: "dashboard",
    title: "控制台",
  },
];

const tripDetailLayoutPresetOptions: {
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  id: TripDetailLayoutPresetPreference;
  title: string;
}[] = [
  {
    description: "使用当前皮肤声明的详情页总览编排。",
    icon: "auto-awesome",
    id: "themeDefault",
    title: "跟随皮肤",
  },
  {
    description: "保持当前总览、开销清单、手账、路线、信息的顺序。",
    icon: "view-stream",
    id: "standard",
    title: "标准总览",
  },
  {
    description: "路线和每日安排信息更靠前，适合规划和执行行程。",
    icon: "map",
    id: "itineraryFirst",
    title: "行程优先",
  },
  {
    description: "手账和旅途记录更靠前，适合偏记录感的皮肤。",
    icon: "edit-note",
    id: "journalFirst",
    title: "手账优先",
  },
];

const homeLayoutPresetLabels: Record<HomeLayoutPresetPreference, string> = {
  dashboard: "控制台",
  simpleList: "简洁列表",
  themeDefault: "跟随皮肤",
  todayFirst: "今日优先",
};

const tripDetailLayoutPresetLabels: Record<
  TripDetailLayoutPresetPreference,
  string
> = {
  itineraryFirst: "行程优先",
  journalFirst: "手账优先",
  standard: "标准总览",
  themeDefault: "跟随皮肤",
};

export function AppearanceScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const { resolvedThemeMode, setThemePreference, themePreference } =
    useThemePreference();
  const { setThemeId, themeId } = useThemeId();
  const {
    resolvedShellTabBarPreset,
    setShellTabBarPresetPreference,
    shellTabBarPresetPreference,
  } = useShellTabBarPreset();
  const {
    homeLayoutPresetPreference,
    resolvedHomeLayoutPreset,
    setHomeLayoutPresetPreference,
  } = useHomeLayoutPreset();
  const {
    resolvedTripDetailLayoutPreset,
    setTripDetailLayoutPresetPreference,
    tripDetailLayoutPresetPreference,
  } = useTripDetailLayoutPreset();
  const { resetSkinSlotOverride, resolvedSkinSlots, setSkinSlotOverride } =
    useSkinSlots();
  const { setThemeColor, themeColorId } = useThemeColor();
  const { appIconPattern, setAppIconPattern } = useAppIconPreference();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const preview = theme.colors.ticket.featured;
  const selectedColor =
    THEME_COLORS.find((color) => color.id === themeColorId) ?? THEME_COLORS[0];
  const selectedModeColors = getThemeSkinMode(selectedColor, resolvedThemeMode);
  const selectedIconPalette = getAppIconPalette(themeColorId);
  const isClassicMode = themeId === "classic";
  const appIconPatternRows = useMemo(
    () => [APP_ICON_PATTERNS.slice(0, 3), APP_ICON_PATTERNS.slice(3)],
    [],
  );
  const logoPreviewSize = useMemo(() => {
    const availableWidth = viewportWidth - 40 - 2 - 24 - 20;
    const columnWidth = Math.max(72, Math.floor(availableWidth / 3));
    return Math.max(50, Math.min(70, columnWidth - 22));
  }, [viewportWidth]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setToastMessage(null);
    }, 1700);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  const showSwitchResult = useCallback((updatedNativeIcon: boolean) => {
    setToastMessage(
      updatedNativeIcon
        ? "已保存，回到桌面后生效"
        : "已保存，当前环境不支持桌面 Logo 切换",
    );
  }, []);

  const handleThemeColorChange = useCallback(
    async (colorId: string) => {
      const updatedNativeIcon = await setThemeColor(colorId);
      showSwitchResult(updatedNativeIcon);
    },
    [setThemeColor, showSwitchResult],
  );

  const handleSkinModeChange = useCallback(
    (nextThemeId: ThemeId) => {
      setThemeId(nextThemeId);
      setToastMessage(
        nextThemeId === "classic" ? "已切换到简洁模式" : "已切换到默认模式",
      );
    },
    [setThemeId],
  );

  const handleShellTabBarPresetChange = useCallback(
    (nextPreference: ShellTabBarPresetPreference) => {
      setShellTabBarPresetPreference(nextPreference);
      setToastMessage(
        nextPreference === "themeDefault"
          ? "底部导航已设为跟随皮肤"
          : nextPreference === "centerAdd"
            ? "底部导航已切换为中间加号"
            : "底部导航已切换为右侧独立加号",
      );
    },
    [setShellTabBarPresetPreference],
  );

  const handleHomeLayoutPresetChange = useCallback(
    (nextPreference: HomeLayoutPresetPreference) => {
      setHomeLayoutPresetPreference(nextPreference);
      setToastMessage(
        nextPreference === "themeDefault"
          ? "首页布局已设为跟随皮肤"
          : `首页布局已切换为${homeLayoutPresetLabels[nextPreference]}`,
      );
    },
    [setHomeLayoutPresetPreference],
  );

  const handleTripDetailLayoutPresetChange = useCallback(
    (nextPreference: TripDetailLayoutPresetPreference) => {
      setTripDetailLayoutPresetPreference(nextPreference);
      setToastMessage(
        nextPreference === "themeDefault"
          ? "详情页布局已设为跟随皮肤"
          : `详情页布局已切换为${tripDetailLayoutPresetLabels[nextPreference]}`,
      );
    },
    [setTripDetailLayoutPresetPreference],
  );

  const handleAppIconPatternChange = useCallback(
    async (patternId: AppIconPatternId) => {
      const updatedNativeIcon = await setAppIconPattern(patternId);
      showSwitchResult(updatedNativeIcon);
    },
    [setAppIconPattern, showSwitchResult],
  );

  const handleSkinSlotAdapterChange = useCallback(
    (slotId: SkinSlotId, adapterId: SkinSlotAdapterId) => {
      setSkinSlotOverride(slotId, adapterId);
      setToastMessage("模块样式已切换");
    },
    [setSkinSlotOverride],
  );

  const handleResetSkinSlot = useCallback(
    (slotId: SkinSlotId) => {
      resetSkinSlotOverride(slotId);
      setToastMessage("模块样式已恢复为跟随皮肤");
    },
    [resetSkinSlotOverride],
  );

  return (
    <SettingsPageShell onBack={() => router.back()} title="外观设置">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemeModeSelector
            onChange={setThemePreference}
            resolvedThemeMode={resolvedThemeMode}
            theme={theme}
            themePreference={themePreference}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              皮肤模式
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              默认模式用于打磨未来正式 UI；简洁模式保留当前基础 UI 和主题色。
            </Text>
          </View>

          <View style={styles.skinModeGrid}>
            {skinModeOptions.map((option) => {
              const isSelected = option.id === themeId;

              return (
                <Pressable
                  accessibilityHint={option.description}
                  accessibilityLabel={`切换到${option.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.id}
                  onPress={() => handleSkinModeChange(option.id)}
                  style={({ pressed }) => [
                    styles.skinModeOption,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                    pressed && styles.skinModeOptionPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.skinModeIcon,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceMuted,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={18}
                      color={
                        isSelected
                          ? theme.colors.onPrimary
                          : theme.colors.textMuted
                      }
                    />
                  </View>
                  <View style={styles.skinModeCopy}>
                    <Text
                      style={[
                        styles.skinModeTitle,
                        { color: theme.colors.text },
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.skinModeDescription,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              底部导航
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              当前生效：
              {resolvedShellTabBarPreset === "centerAdd"
                ? "中间加号"
                : "右侧独立加号"}
            </Text>
          </View>

          <View style={styles.shellPresetStack}>
            {shellTabBarPresetOptions.map((option) => {
              const isSelected = option.id === shellTabBarPresetPreference;

              return (
                <Pressable
                  accessibilityHint={option.description}
                  accessibilityLabel={`设置底部导航为${option.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.id}
                  onPress={() => handleShellTabBarPresetChange(option.id)}
                  style={({ pressed }) => [
                    styles.shellPresetOption,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                    pressed && styles.skinModeOptionPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.skinModeIcon,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceMuted,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={18}
                      color={
                        isSelected
                          ? theme.colors.onPrimary
                          : theme.colors.textMuted
                      }
                    />
                  </View>
                  <View style={styles.skinModeCopy}>
                    <Text
                      style={[
                        styles.skinModeTitle,
                        { color: theme.colors.text },
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.skinModeDescription,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {isSelected ? (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              首页布局
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              当前生效：{homeLayoutPresetLabels[resolvedHomeLayoutPreset]}
            </Text>
          </View>

          <View style={styles.shellPresetStack}>
            {homeLayoutPresetOptions.map((option) => {
              const isSelected = option.id === homeLayoutPresetPreference;

              return (
                <Pressable
                  accessibilityHint={option.description}
                  accessibilityLabel={`设置首页布局为${option.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.id}
                  onPress={() => handleHomeLayoutPresetChange(option.id)}
                  style={({ pressed }) => [
                    styles.shellPresetOption,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                    pressed && styles.skinModeOptionPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.skinModeIcon,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceMuted,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={18}
                      color={
                        isSelected
                          ? theme.colors.onPrimary
                          : theme.colors.textMuted
                      }
                    />
                  </View>
                  <View style={styles.skinModeCopy}>
                    <Text
                      style={[
                        styles.skinModeTitle,
                        { color: theme.colors.text },
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.skinModeDescription,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {isSelected ? (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              详情页布局
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              当前生效：
              {tripDetailLayoutPresetLabels[resolvedTripDetailLayoutPreset]}
            </Text>
          </View>

          <View style={styles.shellPresetStack}>
            {tripDetailLayoutPresetOptions.map((option) => {
              const isSelected = option.id === tripDetailLayoutPresetPreference;

              return (
                <Pressable
                  accessibilityHint={option.description}
                  accessibilityLabel={`设置详情页布局为${option.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.id}
                  onPress={() => handleTripDetailLayoutPresetChange(option.id)}
                  style={({ pressed }) => [
                    styles.shellPresetOption,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                    },
                    pressed && styles.skinModeOptionPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.skinModeIcon,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceMuted,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={18}
                      color={
                        isSelected
                          ? theme.colors.onPrimary
                          : theme.colors.textMuted
                      }
                    />
                  </View>
                  <View style={styles.skinModeCopy}>
                    <Text
                      style={[
                        styles.skinModeTitle,
                        { color: theme.colors.text },
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.skinModeDescription,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  {isSelected ? (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              模块混搭
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              当前主皮肤：{themeId === "classic" ? "简洁模式" : "默认模式"}
              。基础 UI 跟随主皮肤，大模块可以单独切换。
            </Text>
          </View>

          <View style={styles.slotStack}>
            {SKIN_SLOT_DEFINITIONS.filter(
              (slotDefinition) =>
                resolvedSkinSlots[slotDefinition.id].isUserConfigurable,
            ).map((slotDefinition) => {
              const resolvedSlot = resolvedSkinSlots[slotDefinition.id];

              return (
                <View
                  key={slotDefinition.id}
                  style={[
                    styles.slotCard,
                    {
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <View style={styles.slotHeader}>
                    <View style={styles.skinModeCopy}>
                      <Text
                        style={[
                          styles.skinModeTitle,
                          { color: theme.colors.text },
                        ]}
                      >
                        {slotDefinition.title}
                      </Text>
                      <Text
                        style={[
                          styles.skinModeDescription,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {skinSlotSurfaceLabels[slotDefinition.surface]} · 当前：
                        {resolvedSlot.adapter.title}
                      </Text>
                    </View>
                    {resolvedSlot.source === "userOverride" ? (
                      <Pressable
                        accessibilityLabel={`恢复${slotDefinition.title}为跟随皮肤`}
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => handleResetSkinSlot(slotDefinition.id)}
                        style={({ pressed }) => [
                          styles.slotResetButton,
                          { backgroundColor: theme.colors.surfaceMuted },
                          pressed && styles.skinModeOptionPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotResetText,
                            { color: theme.colors.primary },
                          ]}
                        >
                          跟随
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.slotAdapterGrid}>
                    {slotDefinition.adapters
                      .filter((adapterOption) =>
                        resolvedSlot.allowedAdapterIds.includes(
                          adapterOption.id,
                        ),
                      )
                      .map((adapterOption) => {
                        const isSelected =
                          adapterOption.id === resolvedSlot.adapterId;

                        return (
                          <Pressable
                            accessibilityHint={adapterOption.description}
                            accessibilityLabel={`设置${slotDefinition.title}为${adapterOption.title}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            key={adapterOption.id}
                            onPress={() =>
                              handleSkinSlotAdapterChange(
                                slotDefinition.id,
                                adapterOption.id,
                              )
                            }
                            style={({ pressed }) => [
                              styles.slotAdapterOption,
                              {
                                backgroundColor: isSelected
                                  ? theme.colors.primarySoft
                                  : theme.colors.surfaceMuted,
                              },
                              pressed && styles.skinModeOptionPressed,
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.slotAdapterTitle,
                                {
                                  color: isSelected
                                    ? theme.colors.primary
                                    : theme.colors.text,
                                },
                              ]}
                            >
                              {adapterOption.title}
                            </Text>
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.slotAdapterDescription,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {adapterOption.description}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {isClassicMode ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                主题色
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  { color: theme.colors.textMuted },
                ]}
              >
                只在简洁模式下使用。默认模式先保持极简骨架，方便后续直接重做。
              </Text>
            </View>

            <View
              style={[
                styles.skinPicker,
                {
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <View style={styles.skinOptions}>
                {THEME_COLORS.map((color) => {
                  const isSelected = color.id === themeColorId;
                  const modeColors = getThemeSkinMode(color, resolvedThemeMode);

                  return (
                    <Pressable
                      accessibilityHint={color.description}
                      accessibilityLabel={`选择${color.name}主题`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={color.id}
                      onPress={() => {
                        void handleThemeColorChange(color.id);
                      }}
                      style={({ pressed }) => [
                        styles.skinOption,
                        pressed && {
                          opacity: 0.72,
                          transform: [{ scale: 0.96 }],
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.skinSwatchFrame,
                          {
                            backgroundColor: isSelected
                              ? modeColors.primarySoft
                              : theme.colors.surfaceSubtle,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.skinSwatch,
                            {
                              backgroundColor: theme.colors.surfaceSubtle,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.skinSwatchHero,
                              {
                                backgroundColor:
                                  modeColors.ticket.featured.heroBackground,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.skinSwatchPaper,
                              {
                                backgroundColor:
                                  modeColors.ticket.featured.paperBackground,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.skinSwatchAccent,
                                { backgroundColor: modeColors.primary },
                              ]}
                            />
                          </View>
                        </View>
                        {isSelected ? (
                          <View
                            style={[
                              styles.selectedMark,
                              {
                                backgroundColor: modeColors.primary,
                                borderColor: theme.colors.surface,
                              },
                            ]}
                          >
                            <MaterialIcons
                              name="check"
                              size={12}
                              color={modeColors.onPrimary}
                            />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.skinName,
                          {
                            color: isSelected
                              ? modeColors.primary
                              : theme.colors.textMuted,
                          },
                        ]}
                      >
                        {color.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.skinSummary,
                  {
                    backgroundColor: selectedModeColors.primarySoft,
                    borderTopColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.skinSummaryIcon,
                    { backgroundColor: selectedModeColors.primary },
                  ]}
                >
                  <MaterialIcons
                    name="palette"
                    size={17}
                    color={selectedModeColors.onPrimary}
                  />
                </View>
                <View style={styles.skinSummaryCopy}>
                  <Text
                    style={[
                      styles.skinSummaryName,
                      { color: theme.colors.text },
                    ]}
                  >
                    {selectedColor.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.skinSummaryDescription,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {selectedColor.description}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.skinSummaryStatus,
                    { color: selectedModeColors.primary },
                  ]}
                >
                  使用中
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Logo 背景
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              选择桌面 Logo 背景，应用进入后台后更新系统桌面图标
            </Text>
          </View>

          <View
            style={[
              styles.logoPicker,
              {
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={styles.logoOptions}>
              {appIconPatternRows.map((row) => (
                <View
                  key={row.map((pattern) => pattern.id).join("-")}
                  style={styles.logoRow}
                >
                  {row.map((pattern) => {
                    const isSelected = pattern.id === appIconPattern;

                    return (
                      <Pressable
                        accessibilityHint={pattern.description}
                        accessibilityLabel={`选择${pattern.name}Logo背景`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={pattern.id}
                        onPress={() => {
                          void handleAppIconPatternChange(pattern.id);
                        }}
                        style={({ pressed }) => [
                          styles.logoOption,
                          isSelected && {
                            backgroundColor: selectedModeColors.primarySoft,
                          },
                          pressed && styles.logoOptionPressed,
                        ]}
                      >
                        <View style={styles.logoPreviewFrame}>
                          <AppIconPreview
                            mainColor={selectedIconPalette.main}
                            patternId={pattern.id}
                            softColor={selectedIconPalette.soft}
                            style={[
                              styles.logoPreview,
                              {
                                borderRadius: Math.round(
                                  logoPreviewSize * 0.24,
                                ),
                                height: logoPreviewSize,
                                width: logoPreviewSize,
                              },
                            ]}
                          />
                          {isSelected ? (
                            <View
                              style={[
                                styles.logoSelectedMark,
                                {
                                  backgroundColor: selectedModeColors.primary,
                                  borderColor: theme.colors.surface,
                                },
                              ]}
                            >
                              <MaterialIcons
                                name="check"
                                size={12}
                                color={selectedModeColors.onPrimary}
                              />
                            </View>
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.logoName,
                            {
                              color: isSelected
                                ? selectedModeColors.primary
                                : theme.colors.textMuted,
                            },
                          ]}
                        >
                          {pattern.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              实时预览
            </Text>
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.colors.textMuted },
              ]}
            >
              当前为{resolvedThemeMode === "dark" ? "深色" : "浅色"}外观
            </Text>
          </View>

          <View style={[styles.previewCard, theme.shadow.card]}>
            <View
              style={[
                styles.previewHero,
                { backgroundColor: preview.heroBackground },
              ]}
            >
              <View style={styles.previewKickerRow}>
                <View
                  style={[
                    styles.previewIcon,
                    {
                      backgroundColor: theme.colors.status.traveling.background,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="confirmation-number"
                    size={16}
                    color={theme.colors.status.traveling.text}
                  />
                </View>
                <View style={styles.previewKickerCopy}>
                  <Text
                    style={[
                      styles.previewKicker,
                      { color: preview.heroMutedText },
                    ]}
                  >
                    当前行程
                  </Text>
                  <Text
                    style={[
                      styles.previewPass,
                      { color: preview.heroMutedText },
                    ]}
                  >
                    TRIP PASS
                  </Text>
                </View>
                <View
                  style={[
                    styles.previewStatus,
                    {
                      backgroundColor: theme.colors.status.traveling.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewStatusText,
                      { color: theme.colors.status.traveling.text },
                    ]}
                  >
                    旅途中
                  </Text>
                </View>
              </View>
              <Text style={[styles.previewTitle, { color: preview.heroText }]}>
                成都周末慢游
              </Text>
              <View style={styles.previewDestination}>
                <MaterialIcons
                  name="place"
                  size={14}
                  color={preview.heroMutedText}
                />
                <Text
                  style={[
                    styles.previewDestinationText,
                    { color: preview.heroMutedText },
                  ]}
                >
                  成都
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.previewPaper,
                { backgroundColor: preview.paperBackground },
              ]}
            >
              <View style={styles.previewDateRow}>
                <View>
                  <Text
                    style={[styles.previewLabel, { color: preview.accentText }]}
                  >
                    DATE
                  </Text>
                  <Text
                    style={[styles.previewDate, { color: preview.paperText }]}
                  >
                    6 月 19 日 - 6 月 21 日
                  </Text>
                </View>
                <Text
                  style={[
                    styles.previewDayNumber,
                    { color: preview.accentText },
                  ]}
                >
                  NO. 2
                </Text>
              </View>
              <View style={styles.previewStats}>
                {[
                  ["3", "天数"],
                  ["8", "地点"],
                  ["¥860", "开销"],
                ].map(([value, label]) => (
                  <View
                    key={label}
                    style={[
                      styles.previewStat,
                      { backgroundColor: preview.statBackground },
                    ]}
                  >
                    <Text
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={[
                        styles.previewStatValue,
                        { color: preview.paperText },
                      ]}
                    >
                      {value}
                    </Text>
                    <Text
                      style={[
                        styles.previewStatLabel,
                        { color: preview.accentText },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      {toastMessage ? (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              backgroundColor: theme.colors.text,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Text style={[styles.toastText, { color: theme.colors.background }]}>
            {toastMessage}
          </Text>
        </View>
      ) : null}
    </SettingsPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    gap: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  skinModeGrid: {
    flexDirection: "row",
    gap: 10,
  },
  skinModeOption: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  skinModeOptionPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  skinModeIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  skinModeCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  skinModeTitle: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  skinModeDescription: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  shellPresetStack: {
    gap: 10,
  },
  slotStack: {
    gap: 10,
  },
  slotCard: {
    gap: 12,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  slotHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  slotResetButton: {
    minHeight: 32,
    justifyContent: "center",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  slotResetText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  slotAdapterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotAdapterOption: {
    flex: 1,
    minWidth: 148,
    minHeight: 72,
    gap: 3,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  slotAdapterTitle: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  slotAdapterDescription: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  shellPresetOption: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  skinPicker: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    overflow: "hidden",
  },
  skinOptions: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingBottom: 13,
    paddingTop: 15,
  },
  skinOption: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    gap: 7,
  },
  skinSwatchFrame: {
    width: 50,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    position: "relative",
  },
  skinSwatch: {
    width: 40,
    height: 48,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 6,
    overflow: "hidden",
  },
  skinSwatchHero: {
    height: 29,
  },
  skinSwatchPaper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  skinSwatchAccent: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  selectedMark: {
    position: "absolute",
    right: -5,
    top: -5,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
  },
  skinName: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  skinSummary: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  skinSummaryIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  skinSummaryCopy: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  skinSummaryName: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  skinSummaryDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
  skinSummaryStatus: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  logoPicker: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 12,
  },
  logoOptions: {
    gap: 12,
  },
  logoRow: {
    flexDirection: "row",
    gap: 10,
  },
  logoOption: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    gap: 7,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 9,
  },
  logoOptionPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.97 }],
  },
  logoPreviewFrame: {
    position: "relative",
  },
  logoPreview: {
    borderWidth: 0,
    borderColor: "transparent",
  },
  logoSelectedMark: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
  },
  logoName: {
    width: "100%",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "center",
  },
  previewCard: {
    overflow: "hidden",
    borderRadius: 8,
  },
  previewHero: {
    minHeight: 132,
    justifyContent: "space-between",
    padding: 18,
  },
  previewKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  previewIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  previewKickerCopy: {
    flex: 1,
  },
  previewKicker: {
    fontSize: 12,
    fontWeight: "800",
  },
  previewPass: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  previewStatus: {
    minHeight: 30,
    justifyContent: "center",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  previewStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  previewTitle: {
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29,
  },
  previewDestination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewDestinationText: {
    fontSize: 13,
    fontWeight: "700",
  },
  previewPaper: {
    gap: 14,
    padding: 18,
  },
  previewDateRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: "900",
  },
  previewDate: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "800",
  },
  previewDayNumber: {
    fontSize: 16,
    fontWeight: "900",
  },
  previewStats: {
    flexDirection: "row",
    gap: 8,
  },
  previewStat: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    gap: 3,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  previewStatValue: {
    width: "100%",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  previewStatLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    bottom: 22,
    maxWidth: "86%",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
});
