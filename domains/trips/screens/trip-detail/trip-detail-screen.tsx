import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAndroidNavigationBar } from "@/shared/hooks/use-android-navigation-bar";
import {
  useAppTheme,
  useTheme,
  useTripDetailLayoutPreset,
} from "@/shared/theme/use-app-theme";
import type { ImmersiveDayTimelineListRef } from "@/domains/trips/screens/trip-detail/components/immersive/immersive-day-timeline";
import { TripDetailImmersiveSection } from "@/domains/trips/screens/trip-detail/components/immersive/trip-detail-immersive-section";
import { TripDetailScrollSection } from "@/domains/trips/screens/trip-detail/components/overview/trip-detail-scroll-section";
import { TripDetailDialogHost } from "@/domains/trips/screens/trip-detail/components/trip-detail-dialog-host";
import { useTripChecklist } from "@/domains/trips/screens/trip-detail/hooks/checklist/use-trip-checklist";
import { useTripDetailDialogController } from "@/domains/trips/screens/trip-detail/hooks/dialogs/use-trip-detail-dialog-controller";
import { useTripDetailBackgroundRefresh } from "@/domains/trips/screens/trip-detail/hooks/entry/use-trip-detail-background-refresh";
import { useTripDetailEntryActions } from "@/domains/trips/screens/trip-detail/hooks/entry/use-trip-detail-entry-actions";
import { useTripDetailImmersiveController } from "@/domains/trips/screens/trip-detail/hooks/immersive/use-trip-detail-immersive-controller";
import { useTripDetailImmersiveSectionProps } from "@/domains/trips/screens/trip-detail/hooks/immersive/use-trip-detail-immersive-section-props";
import { useTripInfoActions } from "@/domains/trips/screens/trip-detail/hooks/info/use-trip-info-actions";
import { useTripItinerary } from "@/domains/trips/screens/trip-detail/hooks/itinerary/use-trip-itinerary";
import { useTripLedger } from "@/domains/trips/screens/trip-detail/hooks/ledger/use-trip-ledger";
import { useTripDetailOverviewController } from "@/domains/trips/screens/trip-detail/hooks/overview/use-trip-detail-overview-controller";
import { type Trip, type TripExpenseEntry, updateTrip } from "@/features/trips";
import { OVERVIEW_PAGE_ID } from "./constants";
import { resolveTripDetailOverviewLayout } from "./detail-layout-preset";
import type { DayDetailSheetReturnSnapshot } from "./immersive/types";
import { createStyles } from "./trip-detail.styles";
import { resolveTripDetailDayLayoutPreset } from "./trip-detail-day-layout-preset";
import { createDiagnosticLogger } from "@/features/diagnostics";
const tripDetailScreenLogger = createDiagnosticLogger("trip-detail-screen");
export type TripDetailScreenProps = {
  tripId?: string;
  requestedAction?: string;
  requestedDayId?: string;
};

export function TripDetailScreen({
  tripId,
  requestedAction,
  requestedDayId,
}: TripDetailScreenProps) {
  const theme = useAppTheme();
  const resolvedTheme = useTheme();
  const { resolvedTripDetailLayoutPreset } = useTripDetailLayoutPreset();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const detailOverviewLayout = useMemo(
    () => resolveTripDetailOverviewLayout(resolvedTripDetailLayoutPreset),
    [resolvedTripDetailLayoutPreset],
  );
  const detailDayLayout = useMemo(
    () =>
      resolveTripDetailDayLayoutPreset(resolvedTheme.detail.dayLayoutPreset),
    [resolvedTheme.detail.dayLayoutPreset],
  );
  const insets = useSafeAreaInsets();
  const dayDetailSheetScrollRef = useRef<ImmersiveDayTimelineListRef | null>(
    null,
  );
  const isSavingTripRef = useRef(false);
  const pendingDayDetailReturnSnapshotRef = useRef<
    DayDetailSheetReturnSnapshot | undefined
  >(undefined);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selectedPageId, setSelectedPageId] = useState(OVERVIEW_PAGE_ID);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const immersive = useTripDetailImmersiveController({
    dayDetailSheetScrollRef,
    error,
    isLoading,
    pendingDayDetailReturnSnapshotRef,
    persistTripUpdate,
    safeAreaBottom: insets.bottom,
    safeAreaTop: insets.top,
    selectedPageId,
    setActionError,
    setSelectedPageId,
    trip,
  });
  const {
    dayNavigation,
    isDraggingSelectedDayItem,
    isImmersiveDayView,
    isOverviewSelected,
    navigation,
    routeActions,
    routeSegments,
    selectedDay,
  } = immersive;
  const { setSelectedItemId: setSelectedMapPreviewItemId } =
    immersive.mapPreview;
  const {
    dayTabsScrollRef,
    handleDayTabLayout,
    handleDayTabPress,
    longPressHandledDayIdRef,
    pendingDaySheetScrollRef,
    returnToOverview,
    scrollDaySheetToDay,
    scrollDayTabsToEnd,
    selectedPageIdRef,
    setDayTabsContentWidth,
    setDayTabsViewportWidth,
  } = dayNavigation;
  const { goBackToList, openEditTrip, openTripAgent, openPlaceDetail } =
    navigation;
  const { isDayRouteLoading } = routeSegments;
  useTripDetailEntryActions({
    pendingDayDetailReturnSnapshotRef,
    pendingDaySheetScrollRef,
    requestedDayId,
    setError,
    setLoading,
    setSelectedMapPreviewItemId,
    setSelectedPageId,
    setTrip,
    tripId,
  });

  useTripDetailBackgroundRefresh({
    isSavingTripRef,
    setTrip,
    tripId,
  });
  async function persistTripUpdate(
    nextTrip: Trip,
    fallbackTrip: Trip,
    errorMessage = "更新地点失败，请稍后再试",
  ) {
    isSavingTripRef.current = true;
    setTrip(nextTrip);
    setActionError("");

    try {
      const savedTrips = await updateTrip(nextTrip, {
        expectedUpdatedAt: fallbackTrip.updatedAt,
      });
      const savedTrip = savedTrips.find(
        (candidate) => candidate.id === nextTrip.id,
      );
      if (savedTrip) setTrip(savedTrip);
      return true;
    } catch (updateError) {
      tripDetailScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to update trip.", updateError] },
        "Legacy warning captured",
      );
      setTrip(fallbackTrip);
      setActionError(errorMessage);
      return false;
    } finally {
      isSavingTripRef.current = false;
    }
  }

  const tripInfo = useTripInfoActions({
    persistTripUpdate,
    setActionError,
    trip,
  });
  const { openMemoInput, openTripNotebook } = tripInfo;

  const checklist = useTripChecklist({
    persistTripUpdate,
    setActionError,
    trip,
  });
  const itinerary = useTripItinerary({
    longPressHandledDayIdRef,
    pendingDaySheetScrollRef,
    persistTripUpdate,
    scrollDaySheetToDay,
    scrollDayTabsToEnd,
    selectedPageId,
    selectedPageIdRef,
    setActionError,
    setSelectedPageId,
    trip,
  });
  const { addDayPlan, openDayActions, openDayItemEditor } = itinerary;
  const ledger = useTripLedger({
    persistTripUpdate,
    requestedAction,
    selectedDay,
    setActionError,
    trip,
  });
  const openExpenseEntry = (entry: TripExpenseEntry) => {
    if (entry.source === "expense" && entry.id.startsWith("expense:")) {
      ledger.openExpenseActions(entry.id.slice("expense:".length));
      return;
    }

    if (entry.source === "dayItem" && entry.dayId && entry.itemId) {
      openDayItemEditor(entry.dayId, entry.itemId);
    }
  };

  const overview = useTripDetailOverviewController({
    actionError,
    bottomInset: insets.bottom,
    checklist,
    dayTabs: {
      onAddDay: addDayPlan,
      onContentWidthChange: setDayTabsContentWidth,
      onDayLayout: handleDayTabLayout,
      onDayLongPress: openDayActions,
      onDayPress: handleDayTabPress,
      onOverviewPress: returnToOverview,
      onViewportWidthChange: setDayTabsViewportWidth,
      scrollRef: dayTabsScrollRef,
    },
    error,
    isDayRouteLoading,
    isDraggingSelectedDayItem,
    isLoading,
    isOverviewSelected,
    layout: detailOverviewLayout,
    ledger,
    onAddMemoPress: openMemoInput,
    onBackPress: goBackToList,
    onEditPress: openEditTrip,
    onOpenAgentPress: openTripAgent,
    onOpenTripNotebook: openTripNotebook,
    onOverviewPress: returnToOverview,
    onPlacePress: openPlaceDetail,
    selectedDayId: selectedDay?.id,
    styles,
    theme,
    topInset: insets.top,
    trip,
  });
  const dialogs = useTripDetailDialogController({
    checklist,
    itinerary,
    ledger,
    onExpenseEntryPress: openExpenseEntry,
    routeActions,
    routeSegments,
    styles,
    theme,
    trip,
    tripInfo,
    tripPoiNoteLines: overview.tripPoiNoteLines,
  });
  const immersiveSection = useTripDetailImmersiveSectionProps({
    actionError,
    bottomInset: insets.bottom,
    dayDetailSheetScrollRef,
    immersive,
    itinerary,
    ledger,
    layoutPreset: detailDayLayout,
    setSelectedPageId,
    styles,
    theme,
    trip,
  });
  useAndroidNavigationBar({
    mode: isImmersiveDayView ? "immersive" : "hidden",
    style: theme.mode === "dark" ? "light" : "dark",
  });

  return (
    <View style={styles.safeArea}>
      {isImmersiveDayView && immersiveSection.immersiveSectionProps ? (
        <TripDetailImmersiveSection
          {...immersiveSection.immersiveSectionProps}
        />
      ) : (
        <TripDetailScrollSection {...overview.scrollSectionProps} />
      )}

      {/* ============================================================
          模态弹窗区 - Modals & Sheets
          包含：地点搜索、路线操作、地图选择、天操作、天-地点操作、
          确认删除、时间选择、清单添加、备忘添加、预算编辑、记账表单
          ============================================================ */}

      <TripDetailDialogHost {...dialogs.dialogHostProps} />
    </View>
  );
}
