import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  type AmapPrimaryPoiCategory,
  amapPrimaryPoiCategories,
  type FavoritePlaceRecord,
  formatPlacePoiType,
  formatPlaceSearchDistance,
  getFavoritePlaces,
  inferPlaceKind,
  isValidPlaceSearchCenter,
  joinAmapPoiTypeCodes,
  type PlaceSearchCenter,
  type PlaceSearchContext,
  type PlaceSuggestion,
  searchPlaceSuggestions,
  sortPlaceSuggestionsByPreference,
} from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { BACK_BUTTON_SIDE_WIDTH, BackButton } from "@/shared/ui/back-button";

const placeSearchSheetLogger = createDiagnosticLogger("place-search-sheet");
type PlaceSearchSheetProps = {
  dayTitle?: string;
  nearbyCenter?: PlaceSearchCenter;
  onClose: () => void;
  onSelect: (suggestion: PlaceSuggestion) => void;
  regionText?: string;
  searchContext?: PlaceSearchContext;
  visible: boolean;
};

export type PlaceSearchChromeSlots = {
  categoryRail: ReactNode;
  resultViewport: ReactNode;
  searchField: ReactNode;
};

export type PlaceSearchChromeRenderer = (
  slots: PlaceSearchChromeSlots,
) => ReactNode;

type PlaceSearchContentProps = {
  actionColor?: string;
  actionDisabledColor?: string;
  actionMutedColor?: string;
  actionSelectedColor?: string;
  backLabel?: string;
  closeIcon?: keyof typeof MaterialIcons.glyphMap;
  customActionVerb?: string;
  emptyText?: string;
  emptyTitle?: string;
  formatSuggestionMeta?: (suggestion: PlaceSuggestion) => string;
  getResultActionLabel?: (suggestion: PlaceSuggestion) => string | undefined;
  headerExtra?: ReactNode;
  isActive?: boolean;
  isQuickSuggestionsLoading?: boolean;
  isSecondActionDisabled?: (suggestion: PlaceSuggestion) => boolean;
  isSelecting?: boolean;
  isSuggestionSelected?: (suggestion: PlaceSuggestion) => boolean;
  nearbyCenter?: PlaceSearchCenter;
  notice?: string;
  noticeTone?: "error" | "success";
  onClose: () => void;
  onResultAction?: (suggestion: PlaceSuggestion) => void;
  onSecondAction?: (suggestion: PlaceSuggestion) => void;
  onSelect: (suggestion: PlaceSuggestion) => void;
  quickSuggestions?: PlaceSuggestion[];
  quickSuggestionsEmptyText?: string;
  quickSuggestionsEmptyTitle?: string;
  quickSuggestionsLoadingText?: string;
  quickSuggestionsTitle?: string;
  resetOnSelect?: boolean;
  resultActionIcon?: keyof typeof MaterialIcons.glyphMap;
  resultActionLabel?: string;
  regionText?: string;
  renderSearchChrome?: PlaceSearchChromeRenderer;
  searchContext?: PlaceSearchContext;
  searchPrefix?: ReactNode;
  searchPlaceholder?: string;
  secondActionDisabledLabel?: string;
  secondActionIcon?: keyof typeof MaterialIcons.glyphMap;
  secondActionLabel?: string | ((suggestion: PlaceSuggestion) => string);
  showHandle?: boolean;
  showHeader?: boolean;
  showProviderNote?: boolean;
  subtitle?: string;
  title?: string;
  useQuickSuggestionsOnEmptyQuery?: boolean;
  useNearbySuggestionsOnEmptyQuery?: boolean;
  variant?: "sheet" | "page";
};

type PrimaryCategoryButton = AmapPrimaryPoiCategory & {
  icon: keyof typeof MaterialIcons.glyphMap;
};

const primaryCategoryIcons: Record<
  AmapPrimaryPoiCategory["id"],
  keyof typeof MaterialIcons.glyphMap
> = {
  attractions: "attractions",
  education: "school",
  food: "restaurant",
  medical: "local-hospital",
  stay: "hotel",
  transit: "directions-transit",
  shopping: "shopping-bag",
  leisure: "sports-basketball",
  services: "room-service",
  urgent: "medical-services",
};

const primaryCategoryButtons: PrimaryCategoryButton[] =
  amapPrimaryPoiCategories.map((category) => ({
    ...category,
    icon: primaryCategoryIcons[category.id] ?? "place",
  }));

function createCustomSuggestion(query: string): PlaceSuggestion {
  const name = query.trim();
  const kind = inferPlaceKind({
    category: "其他",
    name,
  });

  return {
    id: `custom-${name}`,
    name,
    category: kind.category,
    area: "自定义地点",
    address: "稍后补充详细地址",
    iconKey: kind.iconKey,
    poiGroup: kind.poiGroup,
    poiType: kind.poiType,
    provider: "mock",
  };
}

function createSuggestionFromFavoritePlace(
  place: FavoritePlaceRecord,
): PlaceSuggestion {
  const kind = inferPlaceKind({
    category: place.category,
    name: place.name,
    osmKey: place.osmKey,
    osmValue: place.osmValue,
  });

  return {
    id: `favorite-${place.id}`,
    provider: "mock",
    providerPlaceId: place.providerPlaceId ?? place.id,
    name: place.name,
    category: place.category,
    area: place.area ?? "已收藏地点",
    address: place.address ?? place.note ?? "地址信息待补充",
    iconKey: place.iconKey ?? kind.iconKey,
    latitude: place.latitude,
    longitude: place.longitude,
    osmKey: place.osmKey,
    osmValue: place.osmValue,
    poiGroup: place.poiGroup ?? kind.poiGroup,
    poiType: place.poiType ?? kind.poiType,
    externalRefs: place.externalRefs,
  };
}

function formatDefaultSuggestionMeta(suggestion: PlaceSuggestion): string {
  const distanceText = formatPlaceSearchDistance(suggestion.distanceKm);
  const parts = [
    suggestion.category,
    formatPlacePoiType(suggestion.poiType),
    suggestion.area,
    suggestion.address,
  ].filter((part): part is string => Boolean(part));

  return [
    ...new Set(
      [distanceText, ...parts].filter((part): part is string => Boolean(part)),
    ),
  ].join(" · ");
}

export function PlaceSearchContent({
  actionColor: actionColorProp,
  actionDisabledColor: actionDisabledColorProp,
  actionMutedColor: actionMutedColorProp,
  actionSelectedColor: actionSelectedColorProp,
  backLabel,
  closeIcon = "close",
  customActionVerb = "添加",
  emptyText = "可以换个关键词，或直接添加为自定义地点。",
  emptyTitle = "没有匹配地点",
  formatSuggestionMeta,
  getResultActionLabel,
  headerExtra,
  isActive = true,
  isQuickSuggestionsLoading = false,
  isSecondActionDisabled,
  isSelecting = false,
  isSuggestionSelected,
  nearbyCenter,
  notice,
  noticeTone = "success",
  onClose,
  onResultAction,
  onSecondAction,
  onSelect,
  quickSuggestions = [],
  quickSuggestionsEmptyText = "先去收藏一些地点，之后可以在这里一键添加到当天行程。",
  quickSuggestionsEmptyTitle = "还没有收藏地点",
  quickSuggestionsLoadingText = "正在读取收藏地点",
  quickSuggestionsTitle = "已收藏地点",
  resetOnSelect = true,
  resultActionIcon,
  resultActionLabel,
  regionText,
  renderSearchChrome,
  searchContext = "trip",
  searchPrefix,
  searchPlaceholder = "搜索地点",
  secondActionDisabledLabel,
  secondActionIcon = "event",
  secondActionLabel,
  showHandle = false,
  showHeader = true,
  showProviderNote = true,
  subtitle = "先选择地点，之后再补时间和预算",
  title = "添加地点",
  useQuickSuggestionsOnEmptyQuery = false,
  useNearbySuggestionsOnEmptyQuery = true,
  variant = "sheet",
}: PlaceSearchContentProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors } = theme;
  const actionColor = actionColorProp ?? colors.link;
  const actionDisabledColor = actionDisabledColorProp ?? colors.textSubtle;
  const actionMutedColor = actionMutedColorProp ?? colors.textSubtle;
  const actionSelectedColor = actionSelectedColorProp ?? colors.danger;
  const [query, setQuery] = useState("");
  const [selectedPrimaryCategory, setSelectedPrimaryCategory] = useState<
    AmapPrimaryPoiCategory | undefined
  >();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const trimmedQuery = query.trim();
  const normalizedNearbyCenter = useMemo(
    () => (isValidPlaceSearchCenter(nearbyCenter) ? nearbyCenter : undefined),
    [nearbyCenter],
  );
  const normalizedRegionText = useMemo(
    () => regionText?.trim() || undefined,
    [regionText],
  );
  const hasNearbyCenter = Boolean(normalizedNearbyCenter);
  const searchContextTitlePrefix = hasNearbyCenter
    ? "附近优先"
    : searchContext === "trip" && normalizedRegionText
      ? "行程地优先"
      : "";
  const withSearchContextTitlePrefix = (value: string) =>
    searchContextTitlePrefix ? `${searchContextTitlePrefix} · ${value}` : value;
  const hasCustomAction =
    trimmedQuery.length > 0 &&
    !suggestions.some((suggestion) => suggestion.name === trimmedQuery);
  const isPage = variant === "page";
  const isShowingQuickSuggestions =
    useQuickSuggestionsOnEmptyQuery &&
    !trimmedQuery &&
    (isQuickSuggestionsLoading || quickSuggestions.length > 0);
  const shouldSearchEmptyNearby =
    useNearbySuggestionsOnEmptyQuery &&
    !trimmedQuery &&
    hasNearbyCenter &&
    !isShowingQuickSuggestions;
  const prioritizedQuickSuggestions = useMemo(
    () =>
      sortPlaceSuggestionsByPreference(quickSuggestions, {
        nearbyCenter: normalizedNearbyCenter,
        preferredCategory: selectedPrimaryCategory?.preferredTripCategory,
      }),
    [normalizedNearbyCenter, quickSuggestions, selectedPrimaryCategory],
  );
  const visibleSuggestions = isShowingQuickSuggestions
    ? prioritizedQuickSuggestions
    : suggestions;
  const isShowingLoading =
    isSearching || (isShowingQuickSuggestions && isQuickSuggestionsLoading);
  const resultSectionTitle = isShowingQuickSuggestions
    ? selectedPrimaryCategory
      ? withSearchContextTitlePrefix(
          `${selectedPrimaryCategory.label} · ${quickSuggestionsTitle}`,
        )
      : withSearchContextTitlePrefix(quickSuggestionsTitle)
    : trimmedQuery
      ? selectedPrimaryCategory
        ? withSearchContextTitlePrefix(
            `${selectedPrimaryCategory.label}搜索结果`,
          )
        : withSearchContextTitlePrefix("搜索结果")
      : withSearchContextTitlePrefix("附近地点");
  const emptyStateTitle = trimmedQuery
    ? emptyTitle
    : isShowingQuickSuggestions
      ? quickSuggestionsEmptyTitle
      : shouldSearchEmptyNearby
        ? "附近暂未找到地点"
        : "搜索地点";
  const emptyStateText = trimmedQuery
    ? emptyText
    : isShowingQuickSuggestions
      ? quickSuggestionsEmptyText
      : shouldSearchEmptyNearby
        ? "可以输入关键词继续搜索，或稍后添加为自定义地点。"
        : selectedPrimaryCategory
          ? `输入地点名称继续搜索，会优先按${selectedPrimaryCategory.label}相关地点查找。`
          : "输入地点名称，搜索后再添加到行程。";
  const shouldShowProviderNote = showProviderNote && !isShowingQuickSuggestions;

  useEffect(() => {
    if (isActive) {
      setQuery("");
      setSelectedPrimaryCategory(undefined);
      setSearchError("");
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const controller = new AbortController();
    const delay = 500;

    setSearchError("");

    if (!trimmedQuery && !shouldSearchEmptyNearby) {
      setSearching(false);
      setSuggestions([]);
      return () => {
        controller.abort();
      };
    }

    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const nextSuggestions = await searchPlaceSuggestions(
          trimmedQuery,
          selectedPrimaryCategory?.preferredTripCategory,
          {
            amapTypes: selectedPrimaryCategory
              ? joinAmapPoiTypeCodes(selectedPrimaryCategory.secondaryTypeCodes)
              : undefined,
            context: searchContext,
            nearbyCenter: normalizedNearbyCenter,
            regionText: normalizedRegionText,
            signal: controller.signal,
          },
        );

        if (!controller.signal.aborted) {
          setSuggestions(nextSuggestions);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          placeSearchSheetLogger.warn(
            "legacy.warn",
            { args: ["Failed to search places.", error] },
            "Legacy warning captured",
          );
          const errorMessage = error instanceof Error ? error.message : "";
          setSearchError(
            errorMessage.includes("HTTP 401")
              ? "高德代理还在要求登录 JWT：请登录后搜索，或重新部署 amap-proxy 为公开函数。"
              : errorMessage.includes("amap-proxy") ||
                  errorMessage.includes("高德地点服务未配置")
                ? "高德地点服务未配置，请先部署 Supabase amap-proxy Function 并设置 AMAP_WEB_SERVICE_KEY。"
                : "地点服务暂时不可用，可以换个关键词或添加自定义地点。",
          );
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    isActive,
    normalizedNearbyCenter,
    normalizedRegionText,
    searchContext,
    selectedPrimaryCategory,
    shouldSearchEmptyNearby,
    trimmedQuery,
  ]);

  const handleSelect = (suggestion: PlaceSuggestion) => {
    if (isSelecting) {
      return;
    }

    onSelect(suggestion);

    if (resetOnSelect) {
      setQuery("");
      setSelectedPrimaryCategory(undefined);
    }
  };

  const handleCustomSelect = () => {
    if (!trimmedQuery) {
      return;
    }

    handleSelect(createCustomSuggestion(trimmedQuery));
  };

  const searchFieldSlot = (
    <View style={styles.searchField}>
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.surfaceMuted,
            borderBottomWidth: 0,
            borderColor: "transparent",
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderTopWidth: 0,
          },
        ]}
      >
        {searchPrefix ? (
          <>
            <View style={styles.searchPrefix}>{searchPrefix}</View>
            <View
              style={[styles.searchDivider, { backgroundColor: colors.border }]}
            />
          </>
        ) : null}
        <View style={styles.searchInputWrap}>
          <MaterialIcons name="search" size={18} color={colors.textMuted} />
          <TextInput
            autoFocus
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textSubtle}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
          />
        </View>
        {query ? (
          <Pressable
            accessibilityLabel="清除搜索"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setQuery("")}
            style={({ pressed }) => [
              styles.clearSearchButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <MaterialIcons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const categoryRailSlot = (
    <View style={styles.categorySection}>
      <View style={styles.categorySectionHeader}>
        <Text style={[styles.categorySectionTitle, { color: colors.text }]}>
          常用分类
        </Text>
        {notice ? (
          <Text
            numberOfLines={1}
            style={[
              styles.notice,
              {
                color: noticeTone === "error" ? colors.danger : colors.success,
              },
            ]}
          >
            {notice}
          </Text>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={styles.categoryList}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroller}
      >
        {primaryCategoryButtons.map((category) => {
          const isSelected = selectedPrimaryCategory?.id === category.id;

          return (
            <Pressable
              accessibilityLabel={`${category.label}一级分类`}
              accessibilityRole="button"
              key={category.id}
              onPress={() =>
                setSelectedPrimaryCategory(isSelected ? undefined : category)
              }
              style={({ pressed }) => [
                styles.categoryButton,
                { backgroundColor: colors.surfaceSubtle },
                isSelected && [
                  styles.categoryButtonSelected,
                  {
                    borderColor: colors.linkBorder,
                    backgroundColor: colors.linkSoft,
                  },
                ],
                pressed && styles.categoryButtonPressed,
              ]}
            >
              <MaterialIcons
                name={category.icon}
                size={16}
                color={isSelected ? colors.primary : colors.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.categoryButtonText,
                  { color: colors.text },
                  isSelected && { color: colors.primary },
                ]}
              >
                {category.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const resultViewportSlot = (
    <ScrollView
      contentContainerStyle={[
        styles.resultList,
        isPage && styles.pageResultList,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[styles.resultScroller, isPage && styles.pageResultScroller]}
    >
      {searchError ? (
        <Text style={[styles.inlineErrorText, { color: colors.danger }]}>
          {searchError}
        </Text>
      ) : null}

      {isShowingLoading ? (
        <View
          style={[styles.loadingRow, { backgroundColor: colors.surfaceMuted }]}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {isSearching ? "正在搜索地点" : quickSuggestionsLoadingText}
          </Text>
        </View>
      ) : null}

      {!isShowingLoading && visibleSuggestions.length > 0 ? (
        <>
          <Text
            style={[styles.resultSectionTitle, { color: colors.textMuted }]}
          >
            {resultSectionTitle}
          </Text>
          {visibleSuggestions.map((suggestion) => {
            const isSelectedSuggestion =
              isSuggestionSelected?.(suggestion) ?? false;
            const actionLabel =
              getResultActionLabel?.(suggestion) ?? resultActionLabel;
            const hasSeparateAction = Boolean(onResultAction);
            const hasSecondAction = Boolean(onSecondAction);
            const secondLabel =
              typeof secondActionLabel === "function"
                ? secondActionLabel(suggestion)
                : secondActionLabel;
            const secondDisabled =
              isSecondActionDisabled?.(suggestion) ?? false;

            return (
              <Pressable
                disabled={
                  isSelecting || (isSelectedSuggestion && !hasSeparateAction)
                }
                accessibilityRole="button"
                key={suggestion.id}
                onPress={() => handleSelect(suggestion)}
                style={({ pressed }) => [
                  styles.resultRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                  isSelectedSuggestion && {
                    backgroundColor: colors.surfaceMuted,
                  },
                  isSelecting && styles.resultRowDisabled,
                  pressed &&
                    !isSelecting &&
                    !isSelectedSuggestion && {
                      backgroundColor: colors.surfacePressed,
                    },
                ]}
              >
                <PlaceLogo
                  category={suggestion.category}
                  iconKey={suggestion.iconKey}
                />
                <View style={styles.resultCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.resultName, { color: colors.text }]}
                  >
                    {suggestion.name}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.resultMeta, { color: colors.textMuted }]}
                  >
                    {formatSuggestionMeta
                      ? formatSuggestionMeta(suggestion)
                      : formatDefaultSuggestionMeta(suggestion)}
                  </Text>
                </View>
                <View style={styles.resultActions}>
                  {hasSecondAction ? (
                    <Pressable
                      disabled={isSelecting || secondDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={secondLabel || "操作"}
                      onPress={() => onSecondAction?.(suggestion)}
                      style={({ pressed }) => [
                        styles.resultActionPill,
                        secondDisabled && styles.resultActionPillSelected,
                        pressed &&
                          !isSelecting &&
                          !secondDisabled && { opacity: 0.6 },
                      ]}
                    >
                      {secondActionIcon ? (
                        <MaterialIcons
                          name={secondActionIcon}
                          size={18}
                          color={
                            secondDisabled ? actionDisabledColor : actionColor
                          }
                        />
                      ) : null}
                      {secondLabel ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.resultActionText,
                            { color: actionMutedColor },
                            secondDisabled && {
                              color: actionDisabledColor,
                            },
                          ]}
                        >
                          {secondDisabled && secondActionDisabledLabel
                            ? secondActionDisabledLabel
                            : secondLabel}
                        </Text>
                      ) : null}
                    </Pressable>
                  ) : null}
                  {hasSeparateAction ? (
                    <Pressable
                      disabled={isSelecting}
                      accessibilityRole="button"
                      accessibilityLabel={actionLabel || "操作"}
                      onPress={() => onResultAction?.(suggestion)}
                      style={({ pressed }) => [
                        styles.resultActionPill,
                        isSelectedSuggestion && styles.resultActionPillSelected,
                        pressed && !isSelecting && { opacity: 0.6 },
                      ]}
                    >
                      {resultActionIcon ? (
                        <MaterialIcons
                          name={resultActionIcon}
                          size={18}
                          color={
                            isSelectedSuggestion
                              ? actionSelectedColor
                              : actionMutedColor
                          }
                        />
                      ) : null}
                      {actionLabel ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.resultActionText,
                            { color: actionMutedColor },
                            isSelectedSuggestion && {
                              color: actionSelectedColor,
                            },
                          ]}
                        >
                          {isSelecting ? "保存中" : actionLabel}
                        </Text>
                      ) : null}
                    </Pressable>
                  ) : actionLabel ? (
                    <View
                      style={[
                        styles.resultActionPill,
                        isSelectedSuggestion && styles.resultActionPillSelected,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.resultActionText,
                          { color: actionMutedColor },
                          isSelectedSuggestion && {
                            color: actionSelectedColor,
                          },
                        ]}
                      >
                        {isSelecting ? "保存中" : actionLabel}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.resultAddButton,
                        { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <MaterialIcons name="add" size={21} color={actionColor} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}

      {!isShowingLoading && visibleSuggestions.length === 0 ? (
        <View style={styles.emptyBlock}>
          <MaterialIcons
            name="travel-explore"
            size={28}
            color={colors.textSubtle}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {emptyStateTitle}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {emptyStateText}
          </Text>
        </View>
      ) : null}

      {hasCustomAction ? (
        <Pressable
          disabled={isSelecting}
          accessibilityRole="button"
          onPress={handleCustomSelect}
          style={({ pressed }) => [
            styles.customButton,
            {
              backgroundColor: colors.linkSoft,
              borderColor: colors.linkBorder,
            },
            isSelecting && styles.resultRowDisabled,
            pressed && !isSelecting && { backgroundColor: colors.linkSoft },
          ]}
        >
          <MaterialIcons
            name="edit-location-alt"
            size={20}
            color={actionColor}
          />
          <Text
            numberOfLines={1}
            style={[styles.customButtonText, { color: actionColor }]}
          >
            {customActionVerb}“{trimmedQuery}”
          </Text>
        </Pressable>
      ) : null}

      {shouldShowProviderNote ? (
        <Text style={[styles.providerNote, { color: colors.textSubtle }]}>
          地点数据：高德地图
        </Text>
      ) : null}
    </ScrollView>
  );

  const searchChrome = renderSearchChrome ? (
    renderSearchChrome({
      categoryRail: categoryRailSlot,
      resultViewport: resultViewportSlot,
      searchField: searchFieldSlot,
    })
  ) : (
    <>
      {searchFieldSlot}
      {categoryRailSlot}
      {resultViewportSlot}
    </>
  );

  return (
    <View style={styles.contentRoot}>
      {showHandle ? (
        <View
          style={[styles.sheetHandle, { backgroundColor: colors.border }]}
        />
      ) : null}
      {showHeader ? (
        backLabel ? (
          <View
            style={[
              styles.sheetHeader,
              styles.backSheetHeader,
              isPage && styles.pageHeader,
            ]}
          >
            <BackButton
              accessibilityLabel={`返回${backLabel}`}
              onPress={onClose}
              style={styles.backSheetButton}
            />
            <View style={styles.backSheetTitleCopy}>
              <Text
                numberOfLines={1}
                style={[
                  styles.sheetTitle,
                  styles.backSheetTitle,
                  { color: colors.text },
                ]}
              >
                {title}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.sheetSubtitle,
                  styles.backSheetSubtitle,
                  { color: colors.textMuted },
                ]}
              >
                {subtitle}
              </Text>
            </View>
            <View style={styles.backSheetHeaderPlaceholder} />
          </View>
        ) : (
          <View style={[styles.sheetHeader, isPage && styles.pageHeader]}>
            <View style={styles.sheetTitleCopy}>
              <Text
                style={[
                  styles.sheetTitle,
                  isPage && styles.pageTitle,
                  { color: colors.text },
                ]}
              >
                {title}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
                {subtitle}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="关闭"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <MaterialIcons
                name={closeIcon}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        )
      ) : null}

      <View style={styles.bodyArea}>
        {headerExtra}
        {searchChrome}
      </View>
    </View>
  );
}

export function PlaceSearchSheet({
  dayTitle,
  nearbyCenter,
  onClose,
  onSelect,
  regionText,
  searchContext = "trip",
  visible,
}: PlaceSearchSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { colors } = theme;
  const [quickSuggestions, setQuickSuggestions] = useState<PlaceSuggestion[]>(
    [],
  );
  const [isQuickSuggestionsLoading, setQuickSuggestionsLoading] =
    useState(false);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    let isActive = true;
    setQuickSuggestionsLoading(true);

    const loadQuickSuggestions = async () => {
      try {
        const favoritePlaces = await getFavoritePlaces();

        if (isActive) {
          setQuickSuggestions(
            favoritePlaces.map(createSuggestionFromFavoritePlace),
          );
        }
      } catch (error) {
        if (isActive) {
          placeSearchSheetLogger.warn(
            "legacy.warn",
            {
              args: ["Failed to load favorite places for place search.", error],
            },
            "Legacy warning captured",
          );
          setQuickSuggestions([]);
        }
      } finally {
        if (isActive) {
          setQuickSuggestionsLoading(false);
        }
      }
    };

    void loadQuickSuggestions();

    return () => {
      isActive = false;
    };
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      visible={visible}
    >
      <View style={[styles.modalRoot, { backgroundColor: colors.surface }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
          style={styles.keyboardRoot}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingTop: Math.max(insets.top, 16),
              },
            ]}
          >
            <PlaceSearchContent
              isActive={visible}
              isQuickSuggestionsLoading={isQuickSuggestionsLoading}
              nearbyCenter={nearbyCenter}
              onClose={onClose}
              onSelect={onSelect}
              quickSuggestions={quickSuggestions}
              regionText={regionText}
              searchContext={searchContext}
              subtitle={
                dayTitle
                  ? `添加到 ${dayTitle}`
                  : "先选择地点，之后再补时间和预算"
              }
              useQuickSuggestionsOnEmptyQuery
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    contentRoot: {
      flex: 1,
      position: "relative",
    },
    bodyArea: {
      flex: 1,
      position: "relative",
    },
    modalRoot: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    keyboardRoot: {
      flex: 1,
      width: "100%",
    },
    sheet: {
      flex: 1,
      alignSelf: "center",
      width: "100%",
      maxWidth: 620,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surface,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingBottom: 10,
      paddingTop: 14,
    },
    backSheetHeader: {
      alignItems: "center",
      gap: 8,
    },
    backSheetButton: {
      width: BACK_BUTTON_SIDE_WIDTH,
    },
    backSheetTitleCopy: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 2,
    },
    backSheetTitle: {
      textAlign: "center",
      fontSize: 20,
      fontWeight: "800",
    },
    backSheetSubtitle: {
      textAlign: "center",
    },
    backSheetHeaderPlaceholder: {
      width: BACK_BUTTON_SIDE_WIDTH,
      height: 34,
    },
    sheetTitleCopy: {
      flex: 1,
      gap: 4,
    },
    sheetTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: "700",
    },
    pageHeader: {
      paddingTop: 8,
    },
    pageTitle: {
      fontSize: 30,
    },
    sheetSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    iconButton: {
      alignItems: "center",
      justifyContent: "flex-start",
      width: 38,
      height: 38,
      paddingTop: 5,
    },
    iconButtonPressed: {
      opacity: 0.6,
    },
    notice: {
      flexShrink: 1,
      maxWidth: "68%",
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 16,
      textAlign: "right",
    },
    searchBox: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 0,
      backgroundColor: theme.colors.surfaceMuted,
      boxShadow: "none",
      outlineWidth: 0,
    },
    searchField: {
      position: "relative",
      zIndex: 9,
    },
    searchPrefix: {
      zIndex: 10,
    },
    searchDivider: {
      width: 1,
      alignSelf: "stretch",
      marginVertical: 4,
      backgroundColor: theme.colors.border,
    },
    searchInputWrap: {
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
      outlineStyle: "solid",
      outlineWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    clearSearchButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    categorySection: {
      gap: 10,
      paddingBottom: 8,
      paddingTop: 10,
    },
    categorySectionHeader: {
      height: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    categorySectionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    categoryScroller: {
      marginHorizontal: -2,
    },
    categoryList: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 2,
    },
    categoryButton: {
      minWidth: 82,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: theme.colors.surfaceSubtle,
    },
    categoryButtonSelected: {
      borderColor: theme.colors.primaryBorder,
      backgroundColor: theme.colors.primarySoft,
    },
    categoryButtonPressed: {
      opacity: 0.78,
    },
    categoryButtonText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    categoryButtonTextSelected: {
      color: theme.colors.primary,
    },
    resultList: {
      gap: 8,
      paddingBottom: 14,
      paddingTop: 2,
    },
    resultScroller: {
      flex: 1,
    },
    pageResultScroller: {
      flex: 1,
    },
    pageResultList: {
      paddingBottom: 24,
    },
    inlineErrorText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
    },
    loadingRow: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    resultSectionTitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
      paddingHorizontal: 2,
      paddingTop: 6,
    },
    resultRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultRowPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    resultRowSelected: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    resultRowDisabled: {
      opacity: 0.68,
    },
    resultIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.primarySoft,
    },
    resultCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    resultName: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    resultMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    resultActions: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      gap: 4,
      justifyContent: "flex-end",
    },
    resultActionPill: {
      minWidth: 72,
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      gap: 4,
      paddingHorizontal: 4,
    },
    resultActionPillSelected: {},
    resultActionText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    resultActionTextSelected: {
      color: theme.colors.danger,
    },
    resultAddButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },
    emptyBlock: {
      gap: 6,
      paddingVertical: 22,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    customButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primaryBorder,
    },
    customButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    customButtonText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: "700",
    },
    providerNote: {
      color: theme.colors.textSubtle,
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
    },
  });
}
