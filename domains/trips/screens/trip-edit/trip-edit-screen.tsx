import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateRangePicker } from "@/domains/trips/components/date-range-picker";
import {
  resolveTripFormLayoutPreset,
  type TripFormLayoutPreset,
} from "@/domains/trips/screens/trip-form-layout-preset";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  addDaysToDateKey,
  createScheduledTripPlaceFromSuggestion,
  createTripDay,
  createTripDayItemFromPlaceSuggestion,
  formatDateKeyForDisplay,
  getInclusiveDateRangeDays,
  getSortedTripDayItems,
  getTripById,
  getTripDayPlaceSearchCenter,
  getTripTitlePlaceSearchRegion,
  type PlaceSuggestion,
  renumberTripDays,
  resizeTripDays,
  resolveTripDestination,
  type Trip,
  type TripDay,
  type TripPlace,
  updateTrip,
} from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import { PlaceSearchSheet } from "@/shared/places/place-search-sheet";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme, useTheme } from "@/shared/theme/use-app-theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import { useScreenContentStyle } from "@/shared/ui/screen-content";
import { ScreenHeader } from "@/shared/ui/screen-header";

const tripEditScreenLogger = createDiagnosticLogger("trip-edit-screen");
type SelectedDateRange = {
  endDate: string;
  startDate: string;
};

type PendingDateRangeResize = SelectedDateRange & {
  removedDayCount: number;
  removedItemCount: number;
};

type EditableTripSnapshotInput = {
  days: TripDay[];
  endDate?: string;
  places: TripPlace[];
  startDate?: string;
  title: string;
};

function createEditableTripSnapshot(
  trip: Trip,
  input: {
    days: TripDay[];
    endDate?: string;
    places: TripPlace[];
    startDate?: string;
  },
): Trip {
  return {
    ...trip,
    days: input.days,
    endDate: input.endDate,
    places: input.places,
    startDate: input.startDate,
  };
}

function createEditSnapshotKey(input: EditableTripSnapshotInput) {
  return JSON.stringify({
    days: renumberTripDays(input.days),
    endDate: input.endDate ?? null,
    places: input.places,
    startDate: input.startDate ?? null,
    title: input.title.trim(),
  });
}

type DayItemRowRect = {
  dayId: string;
  height: number;
  y: number;
};

type DaySectionRect = {
  height: number;
  y: number;
};

type DayItemDragState = {
  fromDayId: string;
  itemHeight: number;
  itemId: string;
  lastTargetDayId: string;
  lastTargetIndex: number;
  startPageY: number;
};

const EDIT_DAY_ITEM_ROW_HEIGHT = 52;

function doesItemMatchPlace(
  item: TripDay["items"][number],
  place: TripPlace,
): boolean {
  return (
    item.placeId === place.id ||
    item.placeName === place.name ||
    item.title === place.name
  );
}

function formatDateKeyForTripTicket(value: string | undefined) {
  if (!value) {
    return "待定";
  }

  const [, month, day] = value.split("-");
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (!Number.isFinite(monthNumber) || !Number.isFinite(dayNumber)) {
    return value;
  }

  return `${monthNumber}月${dayNumber}日`;
}

function moveDayItemBetweenDays(
  days: TripDay[],
  itemId: string,
  targetDayId: string,
  targetIndex: number,
): TripDay[] {
  let movingItem: TripDay["items"][number] | undefined;

  const withoutMovingItem = days.map((day) => {
    const orderedItems = getSortedTripDayItems(day.items);
    const nextItems = orderedItems.filter((item) => {
      if (item.id === itemId) {
        movingItem = item;
        return false;
      }

      return true;
    });

    return {
      ...day,
      items: nextItems,
    };
  });

  if (!movingItem) {
    return days;
  }

  const itemToMove = movingItem;

  return withoutMovingItem.map((day) => {
    if (day.id !== targetDayId) {
      return day;
    }

    const nextItems = [...day.items];
    const insertIndex = Math.max(0, Math.min(targetIndex, nextItems.length));
    nextItems.splice(insertIndex, 0, itemToMove);

    return {
      ...day,
      items: nextItems,
    };
  });
}

export function TripEditScreen({ tripId }: { tripId?: string }) {
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

  const [trip, setTrip] = useState<Trip | null>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<TripDay[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [activePlaceSearchDayId, setActivePlaceSearchDayId] = useState<
    string | undefined
  >();
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialEditSnapshot, setInitialEditSnapshot] = useState("");
  const [isDiscardConfirmVisible, setDiscardConfirmVisible] = useState(false);
  const [isConfirmingLastDayDelete, setConfirmingLastDayDelete] =
    useState(false);
  const [pendingDateRangeResize, setPendingDateRangeResize] = useState<
    PendingDateRangeResize | undefined
  >();
  const [draggedDayItem, setDraggedDayItem] = useState<
    DayItemDragState | undefined
  >();
  const [dayItemRowRects, setDayItemRowRects] = useState<
    Record<string, DayItemRowRect>
  >({});
  const [daySectionRects, setDaySectionRects] = useState<
    Record<string, DaySectionRect>
  >({});
  const [dayRowsOffsets, setDayRowsOffsets] = useState<Record<string, number>>(
    {},
  );
  const draggedDayItemRef = useRef<DayItemDragState | undefined>(undefined);
  const daysRef = useRef<TripDay[]>([]);

  const saveButtonScale = useSharedValue(1);

  const saveButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveButtonScale.value }],
  }));

  const hasDateRange = Boolean(startDate && endDate);
  const tripStartText = formatDateKeyForTripTicket(startDate);
  const tripEndText = formatDateKeyForTripTicket(endDate);
  const tripDayCountText =
    startDate && endDate
      ? `${getInclusiveDateRangeDays(startDate, endDate)}天`
      : `${days.length}天`;
  const tripDateRangeText =
    startDate && endDate ? `${tripStartText} - ${tripEndText}` : "日期待定";
  const activePlaceSearchDay = days.find(
    (day) => day.id === activePlaceSearchDayId,
  );
  const activePlaceSearchCenter = useMemo(
    () =>
      activePlaceSearchDay
        ? getTripDayPlaceSearchCenter(activePlaceSearchDay, places)
        : undefined,
    [activePlaceSearchDay, places],
  );
  const activePlaceSearchRegionText = useMemo(() => {
    const savedDestination = trip
      ? resolveTripDestination({ destination: trip.destination, places })
      : "";

    return savedDestination || getTripTitlePlaceSearchRegion(title);
  }, [places, title, trip]);
  const lastDay = days[days.length - 1];
  const currentEditSnapshot = useMemo(
    () =>
      trip
        ? createEditSnapshotKey({
            days,
            endDate,
            places,
            startDate,
            title,
          })
        : "",
    [days, endDate, places, startDate, title, trip],
  );
  const hasUnsavedChanges = Boolean(
    trip && initialEditSnapshot && currentEditSnapshot !== initialEditSnapshot,
  );

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  const loadTrip = useCallback(async () => {
    if (!tripId) {
      setError("没有找到这趟行程");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const localTrip = await getTripById(tripId);

      if (!localTrip) {
        setTrip(null);
        setError("没有找到这趟行程");
        return;
      }

      const normalizedDays =
        localTrip.days.length > 0
          ? renumberTripDays(localTrip.days)
          : [createTripDay(1)];
      const dateRangeDayCount =
        localTrip.startDate && localTrip.endDate
          ? getInclusiveDateRangeDays(localTrip.startDate, localTrip.endDate)
          : normalizedDays.length;
      const resizedResult =
        dateRangeDayCount > normalizedDays.length
          ? resizeTripDays(
              {
                ...localTrip,
                days: normalizedDays,
              },
              {
                dayCount: dateRangeDayCount,
                endDate: localTrip.endDate,
                startDate: localTrip.startDate,
              },
            )
          : undefined;
      const nextDays = resizedResult?.ok
        ? resizedResult.data.trip.days
        : normalizedDays;

      setTrip(localTrip);
      setTitle(localTrip.title);
      setStartDate(localTrip.startDate);
      setEndDate(localTrip.endDate);
      setDays(nextDays);
      setPlaces(localTrip.places);
      setInitialEditSnapshot(
        createEditSnapshotKey({
          days: nextDays,
          endDate: localTrip.endDate,
          places: localTrip.places,
          startDate: localTrip.startDate,
          title: localTrip.title,
        }),
      );
      setDiscardConfirmVisible(false);
    } catch (loadError) {
      tripEditScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to load trip for editing.", loadError] },
        "Legacy warning captured",
      );
      setTrip(null);
      setInitialEditSnapshot("");
      setError("读取行程失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const goBackToDetail = () => {
    if (tripId) {
      router.replace({
        pathname: "/trips/[id]",
        params: { id: tripId },
      });
      return;
    }

    router.replace("/");
  };

  const requestBackToDetail = () => {
    if (hasUnsavedChanges) {
      setDiscardConfirmVisible(true);
      return;
    }

    goBackToDetail();
  };

  const confirmDiscardChanges = () => {
    setDiscardConfirmVisible(false);
    goBackToDetail();
  };

  const addDay = () => {
    setDays((currentDays) => [
      ...currentDays,
      createTripDay(currentDays.length + 1),
    ]);
  };

  const removeLastDay = () => {
    setDays((currentDays) => {
      if (currentDays.length <= 1) {
        return currentDays;
      }

      const removedDay = currentDays[currentDays.length - 1];
      const nextDays = currentDays.slice(0, -1);

      if (activePlaceSearchDayId === removedDay.id) {
        setActivePlaceSearchDayId(undefined);
      }

      setPlaces((currentPlaces) =>
        currentPlaces.filter((place) => {
          const wasRemovedWithDay = removedDay.items.some((item) =>
            doesItemMatchPlace(item, place),
          );

          if (!wasRemovedWithDay) {
            return true;
          }

          return nextDays.some((day) =>
            day.items.some((item) => doesItemMatchPlace(item, place)),
          );
        }),
      );
      setConfirmingLastDayDelete(false);
      return nextDays;
    });
  };

  const applyDateRange = (value: SelectedDateRange) => {
    if (!trip) {
      return;
    }

    const dayCount = getInclusiveDateRangeDays(value.startDate, value.endDate);
    const result = resizeTripDays(
      createEditableTripSnapshot(trip, {
        days,
        endDate,
        places,
        startDate,
      }),
      {
        dayCount,
        endDate: value.endDate,
        startDate: value.startDate,
      },
    );

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    const nextTrip = result.data.trip;
    setStartDate(nextTrip.startDate);
    setEndDate(nextTrip.endDate);
    setDays(nextTrip.days);
    setPlaces(nextTrip.places);

    if (
      activePlaceSearchDayId &&
      !nextTrip.days.some((day) => day.id === activePlaceSearchDayId)
    ) {
      setActivePlaceSearchDayId(undefined);
    }

    setPendingDateRangeResize(undefined);
    setConfirmingLastDayDelete(false);
    setDatePickerVisible(false);
  };

  const confirmDateRange = (value: SelectedDateRange) => {
    const dayCount = getInclusiveDateRangeDays(value.startDate, value.endDate);
    const normalizedDays = renumberTripDays(
      days.length > 0 ? days : [createTripDay(1)],
    );
    const removedDays = normalizedDays.slice(dayCount);
    const removedItemCount = removedDays.reduce(
      (total, day) => total + day.items.length,
      0,
    );

    if (removedItemCount > 0) {
      setPendingDateRangeResize({
        ...value,
        removedDayCount: removedDays.length,
        removedItemCount,
      });
      setDatePickerVisible(false);
      return;
    }

    applyDateRange(value);
  };

  const clearDateRange = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDatePickerVisible(false);
    setConfirmingLastDayDelete(false);
    setPendingDateRangeResize(undefined);
    setDays((currentDays) =>
      renumberTripDays(
        currentDays.length > 0 ? currentDays : [createTripDay(1)],
      ),
    );
  };

  const removeDayItem = (dayId: string, itemId: string) => {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.id === dayId
          ? {
              ...day,
              items: day.items.filter((item) => item.id !== itemId),
            }
          : day,
      ),
    );
  };

  const startDayItemDrag = (dayId: string, itemId: string, pageY: number) => {
    if (!Number.isFinite(pageY)) {
      return;
    }

    const rowRect = dayItemRowRects[itemId];
    const sourceDay = daysRef.current.find((day) => day.id === dayId);
    const itemIndex = sourceDay
      ? getSortedTripDayItems(sourceDay.items).findIndex(
          (item) => item.id === itemId,
        )
      : 0;
    const dayRect = daySectionRects[dayId];
    const rowsOffset = dayRowsOffsets[dayId] ?? 70;
    const rowContentY =
      dayRect && rowRect
        ? dayRect.y + rowsOffset + rowRect.y + rowRect.height / 2
        : Math.max(0, itemIndex) * (EDIT_DAY_ITEM_ROW_HEIGHT + 8) +
          EDIT_DAY_ITEM_ROW_HEIGHT / 2;
    const nextDrag: DayItemDragState = {
      fromDayId: dayId,
      itemHeight: rowRect?.height ?? EDIT_DAY_ITEM_ROW_HEIGHT,
      itemId,
      lastTargetDayId: dayId,
      lastTargetIndex: Math.max(0, itemIndex),
      startPageY: pageY - rowContentY,
    };

    triggerHaptic("light");
    draggedDayItemRef.current = nextDrag;
    setDraggedDayItem(nextDrag);
  };

  const updateDayItemDrag = (pageY: number) => {
    if (!Number.isFinite(pageY)) {
      return;
    }

    const currentDrag = draggedDayItemRef.current;

    if (!currentDrag) {
      return;
    }

    const pointerY = pageY - currentDrag.startPageY;
    const sortedDayRects = Object.entries(daySectionRects)
      .map(([dayId, rect]) => ({ dayId, ...rect }))
      .sort((left, right) => left.y - right.y);
    const targetDayRect =
      sortedDayRects.find(
        (rect) => pointerY >= rect.y && pointerY <= rect.y + rect.height,
      ) ??
      sortedDayRects.reduce<
        { dayId: string; height: number; y: number } | undefined
      >((closest, rect) => {
        if (!closest) {
          return rect;
        }

        return Math.abs(pointerY - (rect.y + rect.height / 2)) <
          Math.abs(pointerY - (closest.y + closest.height / 2))
          ? rect
          : closest;
      }, undefined);

    if (!targetDayRect) {
      return;
    }

    const targetDay = daysRef.current.find(
      (day) => day.id === targetDayRect.dayId,
    );

    if (!targetDay) {
      return;
    }

    const remainingItems = getSortedTripDayItems(targetDay.items).filter(
      (item) => item.id !== currentDrag.itemId,
    );
    let targetIndex = remainingItems.length;

    for (let index = 0; index < remainingItems.length; index += 1) {
      const rowRect = dayItemRowRects[remainingItems[index]?.id];

      if (!rowRect) {
        const rowsOffset = dayRowsOffsets[targetDayRect.dayId] ?? 70;
        const estimatedCenterY =
          targetDayRect.y +
          rowsOffset +
          index * (currentDrag.itemHeight + 8) +
          currentDrag.itemHeight / 2;

        if (pointerY < estimatedCenterY) {
          targetIndex = index;
          break;
        }

        continue;
      }

      const rowsOffset = dayRowsOffsets[rowRect.dayId] ?? 70;
      const rowCenterY =
        targetDayRect.y + rowsOffset + rowRect.y + rowRect.height / 2;

      if (pointerY < rowCenterY) {
        targetIndex = index;
        break;
      }
    }

    if (
      targetDayRect.dayId === currentDrag.lastTargetDayId &&
      targetIndex === currentDrag.lastTargetIndex
    ) {
      return;
    }

    const nextDays = moveDayItemBetweenDays(
      daysRef.current,
      currentDrag.itemId,
      targetDayRect.dayId,
      targetIndex,
    );
    const nextDrag = {
      ...currentDrag,
      lastTargetDayId: targetDayRect.dayId,
      lastTargetIndex: targetIndex,
    };

    daysRef.current = nextDays;
    setDays(nextDays);
    draggedDayItemRef.current = nextDrag;
    setDraggedDayItem(nextDrag);
  };

  const endDayItemDrag = () => {
    const currentDrag = draggedDayItemRef.current;

    if (currentDrag && currentDrag.fromDayId !== currentDrag.lastTargetDayId) {
      triggerHaptic("success");
    }

    draggedDayItemRef.current = undefined;
    setDraggedDayItem(undefined);
  };

  const addPlaceToActiveDay = (suggestion: PlaceSuggestion) => {
    if (!activePlaceSearchDayId) {
      return;
    }

    const nextPlace = createScheduledTripPlaceFromSuggestion(suggestion);
    const nextItem = createTripDayItemFromPlaceSuggestion(
      suggestion,
      nextPlace.id,
    );

    setDays((currentDays) =>
      currentDays.map((day) =>
        day.id === activePlaceSearchDayId
          ? {
              ...day,
              items: [...day.items, nextItem],
            }
          : day,
      ),
    );
    setPlaces((currentPlaces) => [...currentPlaces, nextPlace]);
    setActivePlaceSearchDayId(undefined);
  };

  const saveTrip = async () => {
    if (!trip) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("请先填写本次行程的名称");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateTrip(
        {
          ...trip,
          title: trimmedTitle,
          startDate,
          endDate,
          days: renumberTripDays(days),
          places,
        },
        { expectedUpdatedAt: trip.updatedAt },
      );
      setTitle(trimmedTitle);
      setInitialEditSnapshot(
        createEditSnapshotKey({
          days: renumberTripDays(days),
          endDate,
          places,
          startDate,
          title: trimmedTitle,
        }),
      );

      triggerHaptic("success");
      saveButtonScale.value = withSequence(
        withTiming(1.05, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );

      setTimeout(() => {
        router.replace({
          pathname: "/trips/[id]",
          params: { id: trip.id },
        });
      }, 300);
    } catch (saveError) {
      tripEditScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to update trip.", saveError] },
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
          scrollEnabled={!draggedDayItem}
        >
          <ScreenHeader
            accessibilityLabel="返回行程详情"
            onBack={requestBackToDetail}
            title="编辑行程"
          />

          {isLoading ? (
            <View style={[styles.card, styles.loadingCard]}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.mutedText}>正在读取行程</Text>
            </View>
          ) : !trip && error ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>加载失败</Text>
              <Text style={styles.mutedText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={requestBackToDetail}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>返回详情</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.basicsPanel}>
                <View style={styles.tripIdentityRow}>
                  <View style={styles.titleField}>
                    <TextInput
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
                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                  </View>
                </View>

                <Pressable
                  accessibilityLabel="选择行程日期"
                  accessibilityRole="button"
                  onPress={() => setDatePickerVisible(true)}
                  style={({ pressed }) => [
                    styles.dateButton,
                    pressed && styles.dateButtonPressed,
                  ]}
                >
                  <View style={styles.dateIconPill}>
                    <MaterialIcons
                      name="event"
                      size={18}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.dateRangeText}>
                    {tripDateRangeText}
                  </Text>
                  <View style={styles.dateDurationBadge}>
                    <Text style={styles.dateDurationText}>
                      {tripDayCountText}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.textSubtle}
                  />
                </Pressable>
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

              <View style={styles.dayList}>
                {days.map((day) => {
                  const dayDate =
                    startDate && endDate
                      ? addDaysToDateKey(startDate, day.dayIndex - 1)
                      : undefined;
                  const orderedItems = getSortedTripDayItems(day.items);

                  return (
                    <View
                      key={day.id}
                      onLayout={(event) => {
                        const { height, y } = event.nativeEvent.layout;
                        setDaySectionRects((currentRects) => ({
                          ...currentRects,
                          [day.id]: { height, y },
                        }));
                      }}
                      style={styles.dayCard}
                    >
                      <View style={styles.dayContent}>
                        <View style={styles.dayHeader}>
                          <View style={styles.dayCopy}>
                            <Text style={styles.dayTitle}>{day.title}</Text>
                            <Text style={styles.mutedText}>
                              {dayDate
                                ? `${formatDateKeyForDisplay(dayDate)} · ${day.items.length} 个地点`
                                : `${day.items.length} 个地点`}
                            </Text>
                          </View>
                        </View>

                        {day.items.length > 0 ? (
                          <View
                            onLayout={(event) => {
                              const rowsOffsetY = event.nativeEvent.layout.y;
                              setDayRowsOffsets((currentOffsets) => ({
                                ...currentOffsets,
                                [day.id]: rowsOffsetY,
                              }));
                            }}
                            style={styles.placePreviewList}
                          >
                            {orderedItems.map((item, index) => (
                              <View
                                key={item.id}
                                onLayout={(event) => {
                                  const { height, y } =
                                    event.nativeEvent.layout;
                                  setDayItemRowRects((currentRects) => ({
                                    ...currentRects,
                                    [item.id]: { dayId: day.id, height, y },
                                  }));
                                }}
                                style={[
                                  styles.placePreviewRow,
                                  draggedDayItem?.itemId === item.id &&
                                    styles.placePreviewRowDragging,
                                ]}
                              >
                                <Pressable
                                  accessibilityLabel={`拖动${item.title}排序`}
                                  accessibilityRole="button"
                                  hitSlop={10}
                                  onTouchCancel={endDayItemDrag}
                                  onTouchEnd={endDayItemDrag}
                                  onTouchMove={(event) =>
                                    updateDayItemDrag(
                                      event.nativeEvent.pageY ?? 0,
                                    )
                                  }
                                  onTouchStart={(event) =>
                                    startDayItemDrag(
                                      day.id,
                                      item.id,
                                      event.nativeEvent.pageY ?? 0,
                                    )
                                  }
                                  style={({ pressed }) => [
                                    styles.placeDragHandle,
                                    pressed && styles.placeDragHandlePressed,
                                  ]}
                                >
                                  <MaterialIcons
                                    name="drag-indicator"
                                    size={21}
                                    color={theme.colors.textMuted}
                                  />
                                </Pressable>
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
                                <Pressable
                                  accessibilityLabel={`删除${item.title}`}
                                  accessibilityRole="button"
                                  hitSlop={8}
                                  onPress={() => removeDayItem(day.id, item.id)}
                                  style={({ pressed }) => [
                                    styles.placeDeleteButton,
                                    pressed && styles.placeDeleteButtonPressed,
                                  ]}
                                >
                                  <MaterialIcons
                                    name="close"
                                    size={18}
                                    color={theme.colors.danger}
                                  />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setActivePlaceSearchDayId(day.id)}
                          style={({ pressed }) => [
                            styles.addPlaceButton,
                            pressed && styles.addPlaceButtonPressed,
                          ]}
                        >
                          <MaterialIcons
                            name="add-location-alt"
                            size={19}
                            color={theme.colors.primary}
                          />
                          <Text style={styles.addPlaceText}>添加地点</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        {!isLoading && trip ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={requestBackToDetail}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>取消</Text>
            </Pressable>
            <Animated.View style={saveButtonAnimatedStyle}>
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
                  {isSaving ? "保存中" : "保存修改"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
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
        dayTitle={activePlaceSearchDay?.title}
        nearbyCenter={activePlaceSearchCenter}
        onClose={() => setActivePlaceSearchDayId(undefined)}
        onSelect={addPlaceToActiveDay}
        regionText={activePlaceSearchRegionText}
        visible={Boolean(activePlaceSearchDay)}
      />
      <ConfirmDialog
        cancelLabel="继续编辑"
        confirmLabel="放弃修改"
        message="当前修改还没有保存，返回后这些编辑会丢失。"
        onCancel={() => setDiscardConfirmVisible(false)}
        onConfirm={confirmDiscardChanges}
        title="放弃本次编辑？"
        visible={isDiscardConfirmVisible}
      />
      <ConfirmDialog
        message={`确认删除「${lastDay?.title ?? "最后一天"}」吗？${
          lastDay && lastDay.items.length > 0
            ? `这一天的 ${lastDay.items.length} 个地点也会一起移除。`
            : "这一天会从行程中移除。"
        }`}
        onCancel={() => setConfirmingLastDayDelete(false)}
        onConfirm={removeLastDay}
        title="删除这一天"
        visible={isConfirmingLastDayDelete && days.length > 1}
      />
      <ConfirmDialog
        message={
          pendingDateRangeResize
            ? `新的日期范围会少 ${pendingDateRangeResize.removedDayCount} 天，超出范围的 ${pendingDateRangeResize.removedItemCount} 个地点安排会被移除。确认继续吗？`
            : ""
        }
        onCancel={() => setPendingDateRangeResize(undefined)}
        onConfirm={() => {
          if (pendingDateRangeResize) {
            applyDateRange(pendingDateRangeResize);
          }
        }}
        title="缩短行程天数"
        visible={Boolean(pendingDateRangeResize)}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme, tripFormLayout: TripFormLayoutPreset) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardRoot: {
      flex: 1,
    },
    content: {
      paddingTop: 16,
      paddingBottom: theme.layout.bottomActionClearance + 44,
      gap: tripFormLayout.contentGap + 4,
    },
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.glassStrong,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    iconButtonPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    card: {
      gap: 8,
      padding: tripFormLayout.cardDensity === "compact" ? 14 : 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: "700",
    },
    loadingCard: {
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
    },
    basicsPanel: {
      gap: 14,
      paddingHorizontal: 2,
      paddingVertical: 0,
    },
    tripIdentityRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    titleField: {
      flex: 1,
      gap: 6,
    },
    input: {
      minHeight: 38,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderWidth: 0,
      color: theme.colors.text,
      fontSize: 23,
      fontWeight: "800",
      backgroundColor: "transparent",
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    dateButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateButtonPressed: {
      opacity: 0.72,
    },
    dateIconPill: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.surface,
    },
    dateRangeText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    dateDurationBadge: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 42,
      minHeight: 30,
      paddingHorizontal: 9,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
    },
    dateDurationText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    dayActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    smallIconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    smallIconButtonDisabled: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    dayList: {
      gap: 24,
    },
    dayCard: {
      paddingBottom: 0,
    },
    dayContent: {
      gap: 12,
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    dayCopy: {
      flex: 1,
      gap: 3,
    },
    dayTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
    addPlaceButton: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    addPlaceButtonPressed: {
      backgroundColor: theme.colors.primarySoft,
    },
    addPlaceText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },
    placePreviewList: {
      gap: 8,
    },
    placePreviewRow: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    placePreviewRowDragging: {
      backgroundColor: theme.colors.primarySoft,
      transform: [{ scale: 0.99 }],
    },
    placeDragHandle: {
      alignItems: "center",
      justifyContent: "center",
      width: 26,
      height: 34,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    placeDragHandlePressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    placePreviewCopy: {
      flex: 1,
      gap: 2,
    },
    placePreviewName: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    placePreviewMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    placeDeleteButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceMuted,
    },
    placeDeleteButtonPressed: {
      backgroundColor: theme.colors.dangerSoft,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.glassStrong,
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
      backgroundColor: theme.colors.surfacePressed,
    },
    secondaryButtonText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "800",
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
      fontWeight: "800",
    },
  });
}
