import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getSettingsGlassCardStyle,
  SettingsPageShell,
} from "@/domains/settings/components/settings-page-shell";
import {
  createUserTripChecklistTemplate,
  defaultTripChecklistTemplatePreference,
  defaultTripExpensePreference,
  defaultTripRoutePreference,
  defaultTripSyncPreference,
  getAllTripChecklistTemplates,
  getTripChecklistTemplatePreference,
  getTripCurrencyDisplayLabel,
  getTripExpensePreference,
  getTripRouteModeLabel,
  getTripRoutePreference,
  getTripSyncNetworkPolicyLabel,
  getTripSyncPreference,
  parseChecklistTemplateItemsText,
  saveTripChecklistTemplatePreference,
  saveTripExpensePreference,
  saveTripRoutePreference,
  saveTripSyncPreference,
  sortTripExpenseCategoriesByPreference,
  type TripChecklistTemplate,
  type TripChecklistTemplatePreference,
  type TripExpensePreference,
  type TripRoutePreference,
  type TripRoutePreferredMode,
  type TripSyncNetworkPolicy,
  type TripSyncPreference,
  tripCurrencyCatalog,
  tripExpenseCategories,
  tripExpenseWarningRatioOptions,
} from "@/features/trips";
import { getProfileGlassSurface } from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ToggleSwitch } from "@/shared/ui/toggle-switch";
import { createDiagnosticLogger } from "@/features/diagnostics";
const preferencesScreenLogger = createDiagnosticLogger("preferences-screen");
type StatusTone = "error" | "info" | "success";

type OpenPreferenceSelect = "currency" | "routeMode" | "syncNetwork" | null;

type PreferenceSelectOption<Value extends string> = {
  description?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  label: string;
  leadingText?: string;
  value: Value;
};

type PreferenceSelectProps<Value extends string> = {
  accessibilityLabel: string;
  isOpen: boolean;
  menuMaxHeight?: number;
  onChange: (value: Value) => void;
  onClose: () => void;
  onToggle: () => void;
  options: readonly PreferenceSelectOption<Value>[];
  value: Value;
};

const routePreferredModeOptions: PreferenceSelectOption<TripRoutePreferredMode>[] =
  [
    { icon: "auto-awesome", label: "智能推荐", value: "auto" },
    { icon: "directions-walk", label: "步行优先", value: "walking" },
    { icon: "directions-bike", label: "骑行优先", value: "cycling" },
    { icon: "directions-bus", label: "公交优先", value: "transit" },
    { icon: "directions-car", label: "驾车优先", value: "driving" },
  ];

const syncNetworkPolicyOptions: PreferenceSelectOption<TripSyncNetworkPolicy>[] =
  [
    {
      description: "只在连接 Wi-Fi 时自动同步",
      icon: "wifi",
      label: "仅 Wi-Fi",
      value: "wifiOnly",
    },
    {
      description: "Wi-Fi 和手机流量下都可同步",
      icon: "cell-tower",
      label: "Wi-Fi 与流量都允许",
      value: "wifiAndCellular",
    },
  ];

function getPreferredModeLabel(value: TripRoutePreferredMode): string {
  return value === "auto" ? "智能推荐" : getTripRouteModeLabel(value);
}

function PreferenceSelect<Value extends string>({
  accessibilityLabel,
  isOpen,
  menuMaxHeight,
  onChange,
  onClose,
  onToggle,
  options,
  value,
}: PreferenceSelectProps<Value>) {
  const theme = useAppTheme();
  const activeOption =
    options.find((option) => option.value === value) ?? options[0];

  if (!activeOption) {
    return null;
  }

  return (
    <View style={styles.preferenceSelect}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.selectButton,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isOpen ? theme.colors.primary : theme.colors.border,
          },
          pressed && { backgroundColor: theme.colors.surfacePressed },
        ]}
      >
        {activeOption.icon ? (
          <MaterialIcons
            name={activeOption.icon}
            size={20}
            color={theme.colors.primary}
          />
        ) : null}
        {activeOption.leadingText ? (
          <View
            style={[
              styles.selectSymbolBadge,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.selectSymbolText, { color: theme.colors.primary }]}
            >
              {activeOption.leadingText}
            </Text>
          </View>
        ) : null}
        <View style={styles.selectCopy}>
          <Text
            numberOfLines={1}
            style={[styles.selectValueText, { color: theme.colors.text }]}
          >
            {activeOption.label}
          </Text>
          {activeOption.description ? (
            <Text
              numberOfLines={1}
              style={[styles.selectMetaText, { color: theme.colors.textMuted }]}
            >
              {activeOption.description}
            </Text>
          ) : null}
        </View>
        <MaterialIcons
          name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={22}
          color={theme.colors.textMuted}
        />
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.selectMenu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.text,
            },
            menuMaxHeight ? { maxHeight: menuMaxHeight } : null,
          ]}
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={Boolean(menuMaxHeight)}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.value}
                  onPress={() => {
                    onClose();

                    if (!isSelected) {
                      onChange(option.value);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.selectMenuItem,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                      borderTopColor: theme.colors.border,
                      borderTopWidth: index === 0 ? 0 : 1,
                    },
                    pressed && { backgroundColor: theme.colors.surfacePressed },
                  ]}
                >
                  <View style={styles.selectOptionLeading}>
                    {option.icon ? (
                      <MaterialIcons
                        name={option.icon}
                        size={19}
                        color={
                          isSelected
                            ? theme.colors.primary
                            : theme.colors.textMuted
                        }
                      />
                    ) : null}
                    {option.leadingText ? (
                      <View
                        style={[
                          styles.selectSymbolBadge,
                          { backgroundColor: theme.colors.primarySoft },
                        ]}
                      >
                        <Text
                          adjustsFontSizeToFit
                          numberOfLines={1}
                          style={[
                            styles.selectSymbolText,
                            { color: theme.colors.primary },
                          ]}
                        >
                          {option.leadingText}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.selectCopy}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectOptionText,
                        {
                          color: isSelected
                            ? theme.colors.primary
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.selectMetaText,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {option.description}
                      </Text>
                    ) : null}
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
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function getToneColors(
  theme: ReturnType<typeof useAppTheme>,
  tone: StatusTone,
) {
  if (tone === "error") {
    return {
      backgroundColor: theme.colors.dangerSoft,
      borderColor: theme.colors.dangerBorder,
      iconColor: theme.colors.danger,
      textColor: theme.colors.danger,
    };
  }

  if (tone === "success") {
    return {
      backgroundColor: theme.colors.successSoft,
      borderColor: theme.colors.success,
      iconColor: theme.colors.success,
      textColor: theme.colors.success,
    };
  }

  return {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    iconColor: theme.colors.primary,
    textColor: theme.colors.textMuted,
  };
}

export function PreferencesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const profileGlassTone = useMemo(
    () => getProfileGlassSurface(theme),
    [theme],
  );
  const [expensePreference, setExpensePreference] =
    useState<TripExpensePreference>(defaultTripExpensePreference);
  const [routePreference, setRoutePreference] = useState<TripRoutePreference>(
    defaultTripRoutePreference,
  );
  const [syncPreference, setSyncPreference] = useState<TripSyncPreference>(
    defaultTripSyncPreference,
  );
  const [checklistTemplatePreference, setChecklistTemplatePreference] =
    useState<TripChecklistTemplatePreference>(
      defaultTripChecklistTemplatePreference,
    );
  const [editingChecklistTemplateId, setEditingChecklistTemplateId] = useState<
    string | null
  >(null);
  const [checklistTemplateName, setChecklistTemplateName] = useState("");
  const [checklistTemplateItemsText, setChecklistTemplateItemsText] =
    useState("");
  const [checklistTemplateError, setChecklistTemplateError] = useState("");
  const [isChecklistTemplateEditorOpen, setChecklistTemplateEditorOpen] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [openSelect, setOpenSelect] = useState<OpenPreferenceSelect>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");

  const statusColors = getToneColors(theme, statusTone);
  const currencySelectOptions = useMemo(
    () =>
      tripCurrencyCatalog.map((currency) => ({
        description: currency.code,
        label: currency.label,
        leadingText: currency.symbol,
        value: currency.code,
      })),
    [],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getTripRoutePreference(),
      getTripExpensePreference(),
      getTripSyncPreference(),
      getTripChecklistTemplatePreference(),
    ])
      .then(
        ([
          routeNextPreference,
          expenseNextPreference,
          syncNextPreference,
          checklistNextPreference,
        ]) => {
          if (isMounted) {
            setRoutePreference(routeNextPreference);
            setExpensePreference(expenseNextPreference);
            setSyncPreference(syncNextPreference);
            setChecklistTemplatePreference(checklistNextPreference);
          }
        },
      )
      .catch((error) => {
        preferencesScreenLogger.warn(
          "legacy.warn",
          { args: ["Failed to load preferences.", error] },
          "Legacy warning captured",
        );
        if (isMounted) {
          setStatusTone("error");
          setStatusMessage("偏好加载失败，已使用默认设置。");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateRoutePreference = (nextPreference: TripRoutePreference) => {
    setRoutePreference(nextPreference);
    setStatusTone("success");
    setStatusMessage("偏好已保存。");

    saveTripRoutePreference(nextPreference).catch((error) => {
      preferencesScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to save route preference.", error] },
        "Legacy warning captured",
      );
      setStatusTone("error");
      setStatusMessage("偏好保存失败，请稍后再试。");
    });
  };

  const updateExpensePreference = (nextPreference: TripExpensePreference) => {
    setExpensePreference(nextPreference);
    setStatusTone("success");
    setStatusMessage("偏好已保存。");

    saveTripExpensePreference(nextPreference).catch((error) => {
      preferencesScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to save expense preference.", error] },
        "Legacy warning captured",
      );
      setStatusTone("error");
      setStatusMessage("偏好保存失败，请稍后再试。");
    });
  };

  const updateSyncPreference = (nextPreference: TripSyncPreference) => {
    setSyncPreference(nextPreference);
    setStatusTone("success");
    setStatusMessage("偏好已保存。");

    saveTripSyncPreference(nextPreference).catch((error) => {
      preferencesScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to save sync preference.", error] },
        "Legacy warning captured",
      );
      setStatusTone("error");
      setStatusMessage("偏好保存失败，请稍后再试。");
    });
  };

  const updateChecklistTemplatePreference = (
    nextPreference: TripChecklistTemplatePreference,
  ) => {
    setChecklistTemplatePreference(nextPreference);
    setStatusTone("success");
    setStatusMessage("清单模板已保存。");

    saveTripChecklistTemplatePreference(nextPreference).catch((error) => {
      preferencesScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to save checklist template preference.", error] },
        "Legacy warning captured",
      );
      setStatusTone("error");
      setStatusMessage("清单模板保存失败，请稍后再试。");
    });
  };

  const orderedExpenseCategories = useMemo(
    () =>
      sortTripExpenseCategoriesByPreference(
        tripExpenseCategories,
        expensePreference,
      ),
    [expensePreference],
  );
  const checklistTemplates = useMemo(
    () => getAllTripChecklistTemplates(checklistTemplatePreference),
    [checklistTemplatePreference],
  );
  const selectedChecklistTemplate = useMemo(
    () =>
      checklistTemplates.find(
        (template) =>
          template.id === checklistTemplatePreference.selectedTemplateId,
      ) ?? checklistTemplates[0],
    [checklistTemplatePreference.selectedTemplateId, checklistTemplates],
  );

  const resetChecklistTemplateForm = () => {
    setEditingChecklistTemplateId(null);
    setChecklistTemplateName("");
    setChecklistTemplateItemsText("");
    setChecklistTemplateError("");
    setChecklistTemplateEditorOpen(false);
  };

  const openNewChecklistTemplateForm = () => {
    setEditingChecklistTemplateId(null);
    setChecklistTemplateName("");
    setChecklistTemplateItemsText("");
    setChecklistTemplateError("");
    setChecklistTemplateEditorOpen(true);
  };

  const beginEditChecklistTemplate = (template: TripChecklistTemplate) => {
    if (template.source !== "user") {
      setEditingChecklistTemplateId(null);
      setChecklistTemplateName(`${template.name}副本`);
    } else {
      setEditingChecklistTemplateId(template.id);
      setChecklistTemplateName(template.name);
    }

    setChecklistTemplateItemsText(template.titles.join("\n"));
    setChecklistTemplateError("");
    setChecklistTemplateEditorOpen(true);
  };

  const saveChecklistTemplateForm = () => {
    const titles = parseChecklistTemplateItemsText(checklistTemplateItemsText);
    const template = createUserTripChecklistTemplate({
      id: editingChecklistTemplateId ?? undefined,
      name: checklistTemplateName,
      titles,
    });

    if (!template) {
      setChecklistTemplateError("请填写模板名称，并至少保留一个清单物品。");
      return;
    }

    const userTemplates = editingChecklistTemplateId
      ? checklistTemplatePreference.userTemplates.map((item) =>
          item.id === editingChecklistTemplateId ? template : item,
        )
      : [...checklistTemplatePreference.userTemplates, template];

    updateChecklistTemplatePreference({
      selectedTemplateId: template.id,
      userTemplates,
    });
    resetChecklistTemplateForm();
  };

  const deleteChecklistTemplate = (templateId: string) => {
    const userTemplates = checklistTemplatePreference.userTemplates.filter(
      (template) => template.id !== templateId,
    );
    const selectedTemplateId =
      checklistTemplatePreference.selectedTemplateId === templateId
        ? defaultTripChecklistTemplatePreference.selectedTemplateId
        : checklistTemplatePreference.selectedTemplateId;

    updateChecklistTemplatePreference({
      selectedTemplateId,
      userTemplates,
    });

    if (editingChecklistTemplateId === templateId) {
      resetChecklistTemplateForm();
    }
  };

  return (
    <SettingsPageShell onBack={() => router.back()} title="偏好设置">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {statusMessage ? (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: statusColors.backgroundColor,
                borderColor: statusColors.borderColor,
              },
            ]}
          >
            <MaterialIcons
              name={
                statusTone === "error"
                  ? "error-outline"
                  : "check-circle-outline"
              }
              size={18}
              color={statusColors.iconColor}
            />
            <Text
              style={[styles.statusText, { color: statusColors.textColor }]}
            >
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            styles.profileGlassCard,
            getSettingsGlassCardStyle(profileGlassTone),
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text
                style={[styles.loadingText, { color: theme.colors.textMuted }]}
              >
                正在读取偏好
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.preferenceBlock}>
                <Text
                  style={[styles.preferenceLabel, { color: theme.colors.text }]}
                >
                  默认路线方式
                </Text>
                <PreferenceSelect
                  accessibilityLabel={`选择默认路线方式，当前为${getPreferredModeLabel(routePreference.preferredMode)}`}
                  isOpen={openSelect === "routeMode"}
                  onChange={(preferredMode) =>
                    updateRoutePreference({ ...routePreference, preferredMode })
                  }
                  onClose={() => setOpenSelect(null)}
                  onToggle={() =>
                    setOpenSelect((value) =>
                      value === "routeMode" ? null : "routeMode",
                    )
                  }
                  options={routePreferredModeOptions}
                  value={routePreference.preferredMode}
                />
              </View>

              <View
                style={[
                  styles.settingRow,
                  { borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.settingCopy}>
                  <Text
                    style={[
                      styles.preferenceLabel,
                      { color: theme.colors.text },
                    ]}
                  >
                    允许估算路线兜底
                  </Text>
                  <Text
                    style={[
                      styles.preferenceHint,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    高德暂未返回路线时，继续显示距离和耗时估算。
                  </Text>
                </View>
                <ToggleSwitch
                  accessibilityLabel="切换是否允许估算路线兜底"
                  onValueChange={(value) =>
                    updateRoutePreference({
                      ...routePreference,
                      allowEstimatedRoutes: value,
                    })
                  }
                  value={routePreference.allowEstimatedRoutes}
                />
              </View>
            </>
          )}
        </View>

        <View
          style={[
            styles.sectionCard,
            styles.profileGlassCard,
            getSettingsGlassCardStyle(profileGlassTone),
          ]}
        >
          <View style={styles.templateSectionHeader}>
            <View style={styles.templateSectionTitleCopy}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                清单模板
              </Text>
              <Text
                style={[
                  styles.preferenceHint,
                  { color: theme.colors.textMuted },
                ]}
              >
                新建行程会自动套用选中的模板；已创建行程不会被覆盖。
              </Text>
            </View>
            {selectedChecklistTemplate ? (
              <View
                style={[
                  styles.templateDefaultBadge,
                  { backgroundColor: theme.colors.primarySoft },
                ]}
              >
                <MaterialIcons
                  name="check-circle"
                  size={15}
                  color={theme.colors.primary}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.templateDefaultBadgeText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {selectedChecklistTemplate.name}
                </Text>
              </View>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text
                style={[styles.loadingText, { color: theme.colors.textMuted }]}
              >
                正在读取模板
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={styles.templateRail}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.templateRailScroll}
              >
                {checklistTemplates.map((template) => {
                  const isSelected =
                    checklistTemplatePreference.selectedTemplateId ===
                    template.id;
                  const visibleTitles = template.titles.slice(0, 3);
                  const hiddenTitleCount = Math.max(
                    0,
                    template.titles.length - visibleTitles.length,
                  );

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={template.id}
                      onPress={() =>
                        updateChecklistTemplatePreference({
                          ...checklistTemplatePreference,
                          selectedTemplateId: template.id,
                        })
                      }
                      style={({ pressed }) => [
                        styles.templateCard,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                        pressed && { opacity: 0.78 },
                      ]}
                    >
                      {isSelected ? (
                        <View
                          style={[
                            styles.templateSelectedAccent,
                            { backgroundColor: theme.colors.primary },
                          ]}
                        />
                      ) : null}
                      <View style={styles.templateCardHeader}>
                        <View
                          style={[
                            styles.templateSourceBadge,
                            {
                              backgroundColor:
                                template.source === "system"
                                  ? theme.colors.primarySoft
                                  : theme.colors.surfaceMuted,
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.templateSourceBadgeText,
                              {
                                color:
                                  template.source === "system"
                                    ? theme.colors.primary
                                    : theme.colors.textMuted,
                              },
                            ]}
                          >
                            {template.source === "system" ? "官方" : "自定义"}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View
                            style={[
                              styles.templateSelectedBadge,
                              { backgroundColor: theme.colors.primarySoft },
                            ]}
                          >
                            <MaterialIcons
                              name="done"
                              size={14}
                              color={theme.colors.primary}
                            />
                            <Text
                              style={[
                                styles.templateSelectedBadgeText,
                                { color: theme.colors.primary },
                              ]}
                            >
                              默认
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.templateCardBody}>
                        <View style={styles.templateCardTitleWrap}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.templateName,
                              { color: theme.colors.text },
                            ]}
                          >
                            {template.name}
                          </Text>
                          <Text
                            style={[
                              styles.templateMeta,
                              { color: theme.colors.textMuted },
                            ]}
                          >
                            {template.titles.length} 项清单物品
                          </Text>
                        </View>
                        {template.description ? (
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.templateDescription,
                              { color: theme.colors.textMuted },
                            ]}
                          >
                            {template.description}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.templateItemPreview}>
                        {visibleTitles.map((title) => (
                          <View
                            key={title}
                            style={[
                              styles.templateItemChip,
                              { backgroundColor: theme.colors.surfaceMuted },
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.templateItemText,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {title}
                            </Text>
                          </View>
                        ))}
                        {hiddenTitleCount > 0 ? (
                          <View
                            style={[
                              styles.templateItemChip,
                              { backgroundColor: theme.colors.surfaceMuted },
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.templateItemText,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              +{hiddenTitleCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.templateActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={(event) => {
                            event.stopPropagation();
                            beginEditChecklistTemplate(template);
                          }}
                          style={({ pressed }) => [
                            styles.templateActionButton,
                            { borderColor: theme.colors.border },
                            pressed && {
                              backgroundColor: theme.colors.surfacePressed,
                            },
                          ]}
                        >
                          <MaterialIcons
                            name={
                              template.source === "system"
                                ? "content-copy"
                                : "edit"
                            }
                            size={15}
                            color={theme.colors.primary}
                          />
                          <Text
                            style={[
                              styles.templateActionText,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {template.source === "system" ? "复制" : "编辑"}
                          </Text>
                        </Pressable>
                        {template.source === "user" ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={(event) => {
                              event.stopPropagation();
                              deleteChecklistTemplate(template.id);
                            }}
                            style={({ pressed }) => [
                              styles.templateActionButton,
                              { borderColor: theme.colors.dangerBorder },
                              pressed && {
                                backgroundColor: theme.colors.dangerSoft,
                              },
                            ]}
                          >
                            <MaterialIcons
                              name="delete-outline"
                              size={15}
                              color={theme.colors.danger}
                            />
                            <Text
                              style={[
                                styles.templateActionText,
                                { color: theme.colors.danger },
                              ]}
                            >
                              删除
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {isChecklistTemplateEditorOpen ? (
                <View
                  style={[
                    styles.templateEditor,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <View style={styles.templateEditorHeader}>
                    <Text
                      style={[
                        styles.preferenceLabel,
                        { color: theme.colors.text },
                      ]}
                    >
                      {editingChecklistTemplateId
                        ? "编辑自定义模板"
                        : "新增自定义模板"}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={resetChecklistTemplateForm}
                    >
                      <Text
                        style={[
                          styles.templateEditorClearText,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        取消
                      </Text>
                    </Pressable>
                  </View>
                  <TextInput
                    onChangeText={(value) => {
                      setChecklistTemplateName(value);
                      setChecklistTemplateError("");
                    }}
                    placeholder="模板名称，例如：海边度假"
                    placeholderTextColor={theme.colors.textSubtle}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    value={checklistTemplateName}
                  />
                  <TextInput
                    multiline
                    onChangeText={(value) => {
                      setChecklistTemplateItemsText(value);
                      setChecklistTemplateError("");
                    }}
                    placeholder={
                      "每行一个物品，也支持顿号/逗号分隔\n身份证\n泳衣\n防晒霜"
                    }
                    placeholderTextColor={theme.colors.textSubtle}
                    style={[
                      styles.textInput,
                      styles.templateItemsInput,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    textAlignVertical="top"
                    value={checklistTemplateItemsText}
                  />
                  {checklistTemplateError ? (
                    <Text
                      style={[
                        styles.templateErrorText,
                        { color: theme.colors.danger },
                      ]}
                    >
                      {checklistTemplateError}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={saveChecklistTemplateForm}
                    style={({ pressed }) => [
                      styles.primaryPreferenceButton,
                      { backgroundColor: theme.colors.primary },
                      pressed && { opacity: 0.82 },
                    ]}
                  >
                    <MaterialIcons
                      name="save"
                      size={17}
                      color={theme.colors.onPrimary}
                    />
                    <Text
                      style={[
                        styles.primaryPreferenceButtonText,
                        { color: theme.colors.onPrimary },
                      ]}
                    >
                      保存模板
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={openNewChecklistTemplateForm}
                  style={({ pressed }) => [
                    styles.templateAddButton,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                    pressed && { backgroundColor: theme.colors.surfacePressed },
                  ]}
                >
                  <MaterialIcons
                    name="add"
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.templateAddButtonText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    新增自定义模板
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <View
          style={[
            styles.sectionCard,
            styles.profileGlassCard,
            getSettingsGlassCardStyle(profileGlassTone),
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            预算记账
          </Text>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text
                style={[styles.loadingText, { color: theme.colors.textMuted }]}
              >
                正在读取偏好
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.preferenceBlock}>
                <Text
                  style={[styles.preferenceLabel, { color: theme.colors.text }]}
                >
                  默认币种
                </Text>
                <PreferenceSelect
                  accessibilityLabel={`选择默认币种，当前为${getTripCurrencyDisplayLabel(expensePreference.defaultCurrency)}`}
                  isOpen={openSelect === "currency"}
                  menuMaxHeight={282}
                  onChange={(defaultCurrency) =>
                    updateExpensePreference({
                      ...expensePreference,
                      defaultCurrency,
                    })
                  }
                  onClose={() => setOpenSelect(null)}
                  onToggle={() =>
                    setOpenSelect((value) =>
                      value === "currency" ? null : "currency",
                    )
                  }
                  options={currencySelectOptions}
                  value={expensePreference.defaultCurrency}
                />
              </View>

              <View
                style={[
                  styles.settingRow,
                  { borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.settingCopy}>
                  <Text
                    style={[
                      styles.preferenceLabel,
                      { color: theme.colors.text },
                    ]}
                  >
                    预算提醒阈值
                  </Text>
                </View>
              </View>
              <View style={styles.chipGrid}>
                {tripExpenseWarningRatioOptions.map((ratio) => {
                  const isSelected =
                    expensePreference.budgetWarningRatio === ratio;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={ratio}
                      onPress={() =>
                        updateExpensePreference({
                          ...expensePreference,
                          budgetWarningRatio: ratio,
                        })
                      }
                      style={({ pressed }) => [
                        styles.chipOption,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primarySoft
                            : theme.colors.surfaceMuted,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                        pressed && { opacity: 0.72 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipOptionText,
                          {
                            color: isSelected
                              ? theme.colors.primary
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {Math.round(ratio * 100)}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.settingRow,
                  { borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.settingCopy}>
                  <Text
                    style={[
                      styles.preferenceLabel,
                      { color: theme.colors.text },
                    ]}
                  >
                    常用消费分类
                  </Text>
                  <Text
                    style={[
                      styles.preferenceHint,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    置顶后的分类会优先出现在记账表单里
                  </Text>
                </View>
              </View>
              <View style={styles.chipGrid}>
                {orderedExpenseCategories.map((category) => {
                  const isPinned =
                    expensePreference.pinnedCategories.includes(category);

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isPinned }}
                      key={category}
                      onPress={() => {
                        const nextPinnedCategories = isPinned
                          ? expensePreference.pinnedCategories.filter(
                              (item) => item !== category,
                            )
                          : [...expensePreference.pinnedCategories, category];

                        updateExpensePreference({
                          ...expensePreference,
                          pinnedCategories: nextPinnedCategories,
                        });
                      }}
                      style={({ pressed }) => [
                        styles.chipOption,
                        {
                          backgroundColor: isPinned
                            ? theme.colors.primarySoft
                            : theme.colors.surfaceMuted,
                          borderColor: isPinned
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                        pressed && { opacity: 0.72 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipOptionText,
                          {
                            color: isPinned
                              ? theme.colors.primary
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <View
          style={[
            styles.sectionCard,
            styles.profileGlassCard,
            getSettingsGlassCardStyle(profileGlassTone),
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            云同步
          </Text>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text
                style={[styles.loadingText, { color: theme.colors.textMuted }]}
              >
                正在读取偏好
              </Text>
            </View>
          ) : (
            <View style={styles.preferenceBlock}>
              <Text
                style={[styles.preferenceLabel, { color: theme.colors.text }]}
              >
                同步网络策略
              </Text>
              <Text
                style={[
                  styles.preferenceHint,
                  { color: theme.colors.textMuted },
                ]}
              >
                当前：
                {getTripSyncNetworkPolicyLabel(syncPreference.networkPolicy)}
              </Text>
              <PreferenceSelect
                accessibilityLabel={`选择同步网络策略，当前为${getTripSyncNetworkPolicyLabel(syncPreference.networkPolicy)}`}
                isOpen={openSelect === "syncNetwork"}
                onChange={(networkPolicy) =>
                  updateSyncPreference({ ...syncPreference, networkPolicy })
                }
                onClose={() => setOpenSelect(null)}
                onToggle={() =>
                  setOpenSelect((value) =>
                    value === "syncNetwork" ? null : "syncNetwork",
                  )
                }
                options={syncNetworkPolicyOptions}
                value={syncPreference.networkPolicy}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SettingsPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 144,
  },
  statusBanner: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  sectionCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  profileGlassCard: {
    elevation: 3,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 24,
  },
  loadingRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  preferenceBlock: {
    gap: 8,
  },
  preferenceLabel: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  preferenceHint: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  preferenceSelect: {
    gap: 8,
    paddingTop: 2,
  },
  selectButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectSymbolBadge: {
    minWidth: 40,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  selectSymbolText: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  selectCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  selectValueText: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  selectMetaText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  selectMenu: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 8,
  },
  selectMenuItem: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectOptionLeading: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipOption: {
    minHeight: 38,
    minWidth: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOptionText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  templateSectionHeader: {
    gap: 10,
  },
  templateSectionTitleCopy: {
    gap: 6,
  },
  templateDefaultBadge: {
    maxWidth: 220,
    minHeight: 30,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateDefaultBadgeText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  templateRailScroll: {
    marginHorizontal: -18,
  },
  templateRail: {
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 2,
  },
  templateCard: {
    width: 238,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  templateSelectedAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  templateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  templateSourceBadge: {
    minHeight: 24,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  templateSourceBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
  },
  templateSelectedBadge: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  templateSelectedBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
  },
  templateCardBody: {
    gap: 5,
  },
  templateCardTitleWrap: {
    gap: 1,
    minWidth: 0,
  },
  templateName: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  templateMeta: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  templateDescription: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  templateItemPreview: {
    minHeight: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  templateItemChip: {
    maxWidth: 92,
    minHeight: 26,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  templateItemText: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  templateActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateActionButton: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateActionText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  templateEditor: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  templateEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  templateEditorClearText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
  },
  textInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  templateItemsInput: {
    minHeight: 118,
  },
  templateErrorText: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  primaryPreferenceButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryPreferenceButtonText: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  templateAddButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  templateAddButtonText: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  settingCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
});
