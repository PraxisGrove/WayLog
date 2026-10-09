import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateRangePicker } from "@/domains/trips/components/date-range-picker";
import {
  resolveTripFormLayoutPreset,
  type TripFormLayoutPreset,
} from "@/domains/trips/screens/trip-form-layout-preset";
import {
  deleteAgentTripDraft,
  getAgentTripDraft,
  tripDraftToCreateTripInput,
} from "@/features/agent";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  addDaysToDateKey,
  createScheduledTripPlaceFromSuggestion,
  createTrip,
  createTripDay,
  createTripDayItemFromPlaceSuggestion,
  defaultTripExpensePreference,
  formatDateKeyForDisplay,
  formatDateRangeWithDayCount,
  getInclusiveDateRangeDays,
  getSortedTripDayItems,
  getTripCurrencyDisplayLabel,
  getTripCurrencyMeta,
  getTripDayPlaceSearchCenter,
  getTripExpensePreference,
  getTripTitlePlaceSearchRegion,
  type PlaceSuggestion,
  type TripDay,
  type TripPlace,
  tripCurrencyCatalog,
} from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import { PlaceSearchSheet } from "@/shared/places/place-search-sheet";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme, useTheme } from "@/shared/theme/use-app-theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { ModalTransition } from "@/shared/ui/modal-transition";
import { useScreenContentStyle } from "@/shared/ui/screen-content";
import { ScreenHeader } from "@/shared/ui/screen-header";

const tripNewScreenLogger = createDiagnosticLogger("trip-new-screen");
type SelectedDateRange = {
  endDate: string;
  startDate: string;
};

type DraftPlacesByItemId = Record<string, TripPlace>;

function createTripDays(dayCount: number): TripDay[] {
  return Array.from({ length: Math.max(dayCount, 1) }, (_, index) =>
    createTripDay(index + 1),
  );
}

function getDraftPlaces(
  days: TripDay[],
  draftPlacesByItemId: DraftPlacesByItemId,
): TripPlace[] {
  return days.flatMap((day) =>
    day.items
      .map((item) => draftPlacesByItemId[item.id])
      .filter((place): place is TripPlace => Boolean(place)),
  );
}

function createDraftPlacesByItemId(
  days: TripDay[],
  places: TripPlace[],
): DraftPlacesByItemId {
  const placesById = new Map(places.map((place) => [place.id, place]));
  const entries = days.flatMap((day) =>
    day.items.flatMap((item) => {
      const place = item.placeId ? placesById.get(item.placeId) : undefined;

      return place ? [[item.id, place] as const] : [];
    }),
  );

  return Object.fromEntries(entries);
}

export function TripNewScreen({
  draftId,
  returnTo,
}: {
  draftId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const resolvedTheme = useTheme();
  const tripFormLayout = useMemo(
    () => resolveTripFormLayoutPreset(resolvedTheme.tripForm.layoutPreset),
    [resolvedTheme.tripForm.layoutPreset],
  );
  const styles = useMemo(
    () => createStyles(theme, tripFormLayout),
    [theme, tripFormLayout],
  );
  const screenContentStyle = useScreenContentStyle();
  const returnPath =
    returnTo === "/trips/import" || returnTo === "/trips/favorite-place"
      ? returnTo
      : "/";

  const [title, setTitle] = useState("");
  const [days, setDays] = useState<TripDay[]>(() => [createTripDay(1)]);
  const [draftPlacesByItemId, setDraftPlacesByItemId] =
    useState<DraftPlacesByItemId>({});
  const [activeDayId, setActiveDayId] = useState<string | undefined>();
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isCurrencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);
  const [isConfirmingLastDayDelete, setConfirmingLastDayDelete] =
    useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(
    defaultTripExpensePreference.defaultCurrency,
  );
  const hasSelectedCurrencyManually = useRef(false);

  const hasDateRange = Boolean(startDate && endDate);
  const dateRangeText =
    startDate && endDate
      ? formatDateRangeWithDayCount(startDate, endDate)
      : "日期未定";
  const activeDay = days.find((day) => day.id === activeDayId);
  const draftPlaces = useMemo(
    () => getDraftPlaces(days, draftPlacesByItemId),
    [days, draftPlacesByItemId],
  );
  const activePlaceSearchCenter = useMemo(
    () =>
      activeDay
        ? getTripDayPlaceSearchCenter(activeDay, draftPlaces)
        : undefined,
    [activeDay, draftPlaces],
  );
  const activePlaceSearchRegionText = useMemo(
    () => getTripTitlePlaceSearchRegion(title),
    [title],
  );
  const lastDay = days[days.length - 1];
  const selectedCurrencyMeta = getTripCurrencyMeta(selectedCurrency);
  const selectedCurrencyText = getTripCurrencyDisplayLabel(selectedCurrency);

  useEffect(() => {
    let isMounted = true;

    void getTripExpensePreference()
      .then((preference) => {
        if (isMounted && !hasSelectedCurrencyManually.current) {
          setSelectedCurrency(preference.defaultCurrency);
        }
      })
      .catch((error) => {
        tripNewScreenLogger.warn(
          "legacy.warn",
          { args: ["Failed to load default expense preference.", error] },
          "Legacy warning captured",
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!draftId) {
      return;
    }

    let isMounted = true;

    void getAgentTripDraft(draftId)
      .then((draft) => {
        if (!isMounted) {
          return;
        }

        if (!draft) {
          setError("没有找到这份 Agent 行程草案，请重新生成");
          return;
        }

        const createInput = tripDraftToCreateTripInput(draft);
        const nextDays =
          createInput.days && createInput.days.length > 0
            ? createInput.days
            : [createTripDay(1)];
        const nextPlaces = createInput.places ?? [];

        setTitle(createInput.title);
        setStartDate(createInput.startDate);
        setEndDate(createInput.endDate);
        setDays(nextDays);
        setDraftPlacesByItemId(createDraftPlacesByItemId(nextDays, nextPlaces));
        setActiveDayId(undefined);
        setConfirmingLastDayDelete(false);
      })
      .catch((error) => {
        tripNewScreenLogger.warn(
          "legacy.warn",
          { args: ["Failed to load Agent trip draft.", error] },
          "Legacy warning captured",
        );
        if (isMounted) {
          setError("读取 Agent 行程草案失败，请稍后再试");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [draftId]);

  const addDay = () => {
    triggerHaptic("light");
    setDays((currentDays) => [
      ...currentDays,
      createTripDay(currentDays.length + 1),
    ]);
  };

  const removeLastDay = () => {
    triggerHaptic("medium");
    setDays((currentDays) => {
      if (currentDays.length <= 1) {
        return currentDays;
      }

      const removedDay = currentDays[currentDays.length - 1];
      const removedItemIds = new Set(removedDay.items.map((item) => item.id));

      setDraftPlacesByItemId((currentPlaces) =>
        Object.fromEntries(
          Object.entries(currentPlaces).filter(
            ([itemId]) => !removedItemIds.has(itemId),
          ),
        ),
      );

      if (activeDayId === removedDay.id) {
        setActiveDayId(undefined);
      }

      setConfirmingLastDayDelete(false);
      return currentDays.slice(0, -1);
    });
  };

  const confirmDateRange = (value: SelectedDateRange) => {
    const dayCount = getInclusiveDateRangeDays(value.startDate, value.endDate);

    setStartDate(value.startDate);
    setEndDate(value.endDate);
    setDays(createTripDays(dayCount));
    setDraftPlacesByItemId({});
    setActiveDayId(undefined);
    setConfirmingLastDayDelete(false);
    setDatePickerVisible(false);
  };

  const clearDateRange = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDatePickerVisible(false);
    setConfirmingLastDayDelete(false);
    setDays((currentDays) =>
      currentDays.length > 0 ? currentDays : [createTripDay(1)],
    );
  };

  const addPlaceToActiveDay = (suggestion: PlaceSuggestion) => {
    if (!activeDayId) {
      return;
    }

    const nextPlace = createScheduledTripPlaceFromSuggestion(suggestion);
    const nextItem = createTripDayItemFromPlaceSuggestion(
      suggestion,
      nextPlace.id,
    );

    setDays((currentDays) =>
      currentDays.map((day) =>
        day.id === activeDayId
          ? {
              ...day,
              items: [...day.items, nextItem],
            }
          : day,
      ),
    );
    setDraftPlacesByItemId((currentPlaces) => ({
      ...currentPlaces,
      [nextItem.id]: nextPlace,
    }));
    setActiveDayId(undefined);
  };

  const selectCurrency = (currency: string) => {
    hasSelectedCurrencyManually.current = true;
    setSelectedCurrency(currency);
    setCurrencyPickerVisible(false);
  };

  const saveTrip = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("请先填写本次行程的名称");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const createdTrip = await createTrip({
        currency: selectedCurrency,
        title: trimmedTitle,
        days,
        places: draftPlaces,
        startDate,
        endDate,
      });
      if (draftId) {
        await deleteAgentTripDraft(draftId);
      }
      triggerHaptic("success");
      if (returnPath === "/trips/import") {
        router.replace({
          pathname: "/trips/import",
          params: { createdTripId: createdTrip.id },
        });
        return;
      }

      router.replace(returnPath);
    } catch (saveError) {
      tripNewScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to create trip.", saveError] },
        "Legacy warning captured",
      );
      setError("保存失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={16}
        style={styles.keyboardRoot}
      >
        <ScrollView
          contentContainerStyle={[screenContentStyle, styles.content]}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            accessibilityLabel="返回行程列表"
            onBack={() => router.replace(returnPath)}
            subtitle="搭好每天的行程框架"
            title="新建行程"
          />

          <View style={styles.card}>
            <Text style={styles.label}>行程名称</Text>
            <TextInput
              autoFocus
              onChangeText={(value) => {
                setTitle(value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="例如：西安 3 日历史文化行"
              placeholderTextColor={theme.colors.textSubtle}
              returnKeyType="done"
              style={styles.input}
              value={title}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>账本币种</Text>
            <Text style={styles.mutedText}>
              默认使用偏好设置：{selectedCurrencyText}，也可为本次行程单独调整。
            </Text>
            <Pressable
              accessibilityLabel={`选择账本币种，当前为${selectedCurrencyText}`}
              accessibilityRole="button"
              onPress={() => setCurrencyPickerVisible(true)}
              style={({ pressed }) => [
                styles.currencySelect,
                pressed && styles.currencySelectPressed,
              ]}
            >
              <View style={styles.currencySymbolBadge}>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.currencySymbolText}
                >
                  {selectedCurrencyMeta.symbol}
                </Text>
              </View>
              <View style={styles.currencySelectCopy}>
                <Text numberOfLines={1} style={styles.currencySelectTitle}>
                  {selectedCurrencyMeta.label}
                </Text>
                <Text numberOfLines={1} style={styles.currencySelectMeta}>
                  {selectedCurrencyMeta.code}
                </Text>
              </View>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={24}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>行程日期</Text>
              {hasDateRange ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={clearDateRange}
                  style={({ pressed }) => [
                    styles.dateClearButton,
                    pressed && styles.dateClearButtonPressed,
                  ]}
                >
                  <Text style={styles.dateClearText}>清除</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setDatePickerVisible(true)}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.dateButtonPressed,
              ]}
            >
              <View style={styles.dateIcon}>
                <MaterialIcons
                  name="event"
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.dateCopy}>
                <Text style={styles.dateTitle}>{dateRangeText}</Text>
                <Text style={styles.mutedText}>
                  {hasDateRange
                    ? "已按日期自动同步每日行程"
                    : "可先不选日期，后续再补"}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={theme.colors.textSubtle}
              />
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>每日行程</Text>
              <Text style={styles.sectionHint}>
                {hasDateRange
                  ? `已按日期生成 ${days.length} 天`
                  : `当前共 ${days.length} 天`}
              </Text>
            </View>
            {!hasDateRange ? (
              <View style={styles.dayActions}>
                <Pressable
                  accessibilityLabel="删除最后一天"
                  accessibilityRole="button"
                  disabled={days.length === 1}
                  onPress={() => setConfirmingLastDayDelete(true)}
                  style={({ pressed }) => [
                    styles.smallIconButton,
                    days.length === 1 && styles.smallIconButtonDisabled,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="remove"
                    size={20}
                    color={
                      days.length === 1
                        ? theme.colors.borderStrong
                        : theme.colors.textMuted
                    }
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="添加一天"
                  accessibilityRole="button"
                  onPress={addDay}
                  style={({ pressed }) => [
                    styles.smallIconButton,
                    pressed && styles.iconButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="add"
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.dayList}>
            {days.map((day) => {
              const dayDate =
                startDate && endDate
                  ? addDaysToDateKey(startDate, day.dayIndex - 1)
                  : undefined;

              return (
                <View key={day.id} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayIndexPill}>
                      <Text style={styles.dayIndexText}>{day.dayIndex}</Text>
                    </View>
                    <View style={styles.dayCopy}>
                      <Text style={styles.dayTitle}>{day.title}</Text>
                      <Text style={styles.mutedText}>
                        {dayDate
                          ? `${formatDateKeyForDisplay(dayDate)} · ${
                              day.items.length > 0
                                ? `${day.items.length} 个地点`
                                : "还没有添加地点"
                            }`
                          : day.items.length > 0
                            ? `${day.items.length} 个地点`
                            : "还没有添加地点"}
                      </Text>
                    </View>
                  </View>

                  {day.items.length > 0 ? (
                    <View style={styles.placePreviewList}>
                      {getSortedTripDayItems(day.items).map((item, index) => (
                        <View key={item.id} style={styles.placePreviewRow}>
                          <PlaceLogo
                            category={item.category}
                            iconKey={item.iconKey}
                            size={30}
                          />
                          <View style={styles.placePreviewCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.placePreviewName}
                            >
                              {index + 1}. {item.title}
                            </Text>
                            {item.note ? (
                              <Text
                                numberOfLines={1}
                                style={styles.placePreviewMeta}
                              >
                                {item.note}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setActiveDayId(day.id)}
                    style={({ pressed }) => [
                      styles.addPlaceButton,
                      pressed && styles.addPlaceButtonPressed,
                    ]}
                  >
                    <MaterialIcons
                      name="add-location-alt"
                      size={20}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.addPlaceText}>添加地点</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(returnPath)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>取消</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={saveTrip}
            style={({ pressed }) => [
              styles.primaryButton,
              isSaving && styles.primaryButtonDisabled,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? "保存中" : "保存行程"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <DateRangePicker
        endDate={endDate}
        onClear={clearDateRange}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={confirmDateRange}
        startDate={startDate}
        visible={isDatePickerVisible}
      />
      <PlaceSearchSheet
        dayTitle={activeDay?.title}
        nearbyCenter={activePlaceSearchCenter}
        onClose={() => setActiveDayId(undefined)}
        onSelect={addPlaceToActiveDay}
        regionText={activePlaceSearchRegionText}
        visible={Boolean(activeDay)}
      />
      <ModalTransition
        backdropAccessibilityLabel="关闭币种选择"
        contentStyle={styles.currencySheet}
        onRequestClose={() => setCurrencyPickerVisible(false)}
        overlayColor={theme.colors.overlay}
        preset="sheet"
        rootStyle={styles.currencySheetOverlay}
        visible={isCurrencyPickerVisible}
      >
        <View style={styles.currencySheetHandle} />
        <View style={styles.currencySheetHeader}>
          <View style={styles.currencySheetTitleCopy}>
            <Text style={styles.currencySheetTitle}>选择账本币种</Text>
            <Text style={styles.currencySheetSubtitle}>
              只影响本次行程的预算和记账显示。
            </Text>
          </View>
          <Pressable
            accessibilityLabel="关闭币种选择"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setCurrencyPickerVisible(false)}
            style={({ pressed }) => [
              styles.currencySheetCloseButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <MaterialIcons
              name="close"
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.currencySheetList}
          showsVerticalScrollIndicator={false}
        >
          {tripCurrencyCatalog.map((currency) => {
            const isSelected = selectedCurrency === currency.code;

            return (
              <Pressable
                accessibilityLabel={`选择${currency.label}${currency.code}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={currency.code}
                onPress={() => selectCurrency(currency.code)}
                style={({ pressed }) => [
                  styles.currencySheetOption,
                  isSelected && styles.currencySheetOptionSelected,
                  pressed && styles.currencySheetOptionPressed,
                ]}
              >
                <View style={styles.currencyOptionBadge}>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.currencyOptionSymbol}
                  >
                    {currency.symbol}
                  </Text>
                </View>
                <View style={styles.currencyOptionCopy}>
                  <Text
                    style={[
                      styles.currencyOptionTitle,
                      isSelected && { color: theme.colors.primary },
                    ]}
                  >
                    {currency.label}
                  </Text>
                  <Text style={styles.currencyOptionMeta}>{currency.code}</Text>
                </View>
                {isSelected ? (
                  <MaterialIcons
                    name="check"
                    size={20}
                    color={theme.colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </ModalTransition>
      <ConfirmDialog
        message={`确认删除「${lastDay?.title ?? "最后一天"}」吗？${
          lastDay && lastDay.items.length > 0
            ? `这一天的 ${lastDay.items.length} 个地点也会一起移除。`
            : "这一天会从行程草稿中移除。"
        }`}
        onCancel={() => setConfirmingLastDayDelete(false)}
        onConfirm={removeLastDay}
        title="删除这一天"
        visible={isConfirmingLastDayDelete && days.length > 1}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme, tripFormLayout: TripFormLayoutPreset) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surfaceMuted,
    },
    keyboardRoot: {
      flex: 1,
    },
    content: {
      paddingVertical: 20,
      paddingBottom: theme.layout.bottomActionClearance,
      gap: tripFormLayout.contentGap,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingTop: 8,
    },
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.glassStrong,
      ...theme.shadow.sheet,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    iconButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    card: {
      gap: 8,
      padding: tripFormLayout.cardDensity === "compact" ? 14 : 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    input: {
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      color: theme.colors.text,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    dateClearButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    dateClearButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    dateClearText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    dateButton: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    dateButtonPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    dateIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.primarySoft,
    },
    dateCopy: {
      flex: 1,
      gap: 3,
    },
    dateTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    sectionHint: {
      marginTop: 3,
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    dayActions: {
      flexDirection: "row",
      gap: 8,
    },
    smallIconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    smallIconButtonDisabled: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    dayList: {
      gap: tripFormLayout.sectionGap,
    },
    dayCard: {
      gap: 12,
      padding: tripFormLayout.cardDensity === "compact" ? 14 : 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    dayIndexPill: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },
    dayIndexText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: "700",
    },
    dayCopy: {
      flex: 1,
      gap: 3,
    },
    dayTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    currencySelect: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
    },
    currencySelectPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    currencySymbolBadge: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 40,
      height: 38,
      paddingHorizontal: 8,
      borderRadius: 19,
      backgroundColor: theme.colors.primarySoft,
    },
    currencySymbolText: {
      color: theme.colors.primary,
      fontSize: 17,
      fontWeight: "800",
    },
    currencySelectCopy: {
      flex: 1,
      gap: 2,
    },
    currencySelectTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    currencySelectMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    addPlaceButton: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primarySoft,
    },
    addPlaceButtonPressed: {
      backgroundColor: theme.colors.primarySoft,
    },
    addPlaceText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    placePreviewList: {
      gap: 8,
    },
    placePreviewRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    placePreviewIndex: {
      alignItems: "center",
      justifyContent: "center",
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.primarySoft,
    },
    placePreviewIndexText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "700",
    },
    placePreviewCopy: {
      flex: 1,
      gap: 2,
    },
    placePreviewName: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    placePreviewMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    secondaryButton: {
      minHeight: 46,
      minWidth: 104,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surface,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    secondaryButtonText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
    },
    primaryButton: {
      minHeight: 46,
      minWidth: 142,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    primaryButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    primaryButtonDisabled: {
      opacity: 0.68,
    },
    primaryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    currencySheetOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 16,
    },
    currencySheet: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 620,
      maxHeight: "72%",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 16,
    },
    currencySheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.borderStrong,
    },
    currencySheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingTop: 4,
    },
    currencySheetTitleCopy: {
      flex: 1,
      gap: 4,
    },
    currencySheetTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: "700",
    },
    currencySheetSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    currencySheetCloseButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    currencySheetList: {
      gap: 8,
      paddingBottom: 2,
    },
    currencySheetOption: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    currencySheetOptionPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    currencySheetOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceMuted,
    },
    currencyOptionBadge: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 42,
      height: 36,
      paddingHorizontal: 8,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    currencyOptionSymbol: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    currencyOptionCopy: {
      flex: 1,
      gap: 2,
    },
    currencyOptionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    currencyOptionTitleSelected: {
      color: theme.colors.primary,
    },
    currencyOptionMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
