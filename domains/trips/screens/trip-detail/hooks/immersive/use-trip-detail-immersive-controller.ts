import { type MutableRefObject, type RefObject, useMemo } from "react";
import { type LayoutChangeEvent, useWindowDimensions } from "react-native";
import {
  buildTripDayRouteSegments,
  getSelectedDay,
  getSortedTripDayItems,
  type Trip,
  type TripDayItem,
  type TripPlace,
} from "@/features/trips";
import type { ImmersiveDayTimelineListRef } from "../../components/immersive/immersive-day-timeline";

import { OVERVIEW_PAGE_ID } from "../../constants";
import type { DayDetailSheetReturnSnapshot } from "../../immersive/types";
import { useRouteActions } from "../routes/use-route-actions";
import { useTripRouteSegments } from "../routes/use-trip-route-segments";
import { useImmersiveDayItemDragReorder } from "./use-immersive-day-item-drag-reorder";
import { useImmersiveDayNavigation } from "./use-immersive-day-navigation";
import { useImmersiveDaySheet } from "./use-immersive-day-sheet";
import { useImmersiveMapPreviewCarousel } from "./use-immersive-map-preview-carousel";
import { useImmersiveNavigation } from "./use-immersive-navigation";
import { useImmersiveTripWeather } from "./use-immersive-trip-weather";

type PersistTripUpdate = (
  nextTrip: Trip,
  fallbackTrip: Trip,
  errorMessage?: string,
) => Promise<boolean>;

type UseTripDetailImmersiveControllerParams = {
  dayDetailSheetScrollRef: RefObject<ImmersiveDayTimelineListRef | null>;
  error: string;
  isLoading: boolean;
  pendingDayDetailReturnSnapshotRef: MutableRefObject<
    DayDetailSheetReturnSnapshot | undefined
  >;
  persistTripUpdate: PersistTripUpdate;
  safeAreaBottom: number;
  safeAreaTop: number;
  selectedPageId: string;
  setActionError: (message: string) => void;
  setSelectedPageId: (
    updater: string | ((currentPageId: string) => string),
  ) => void;
  trip: Trip | null;
};

export function useTripDetailImmersiveController({
  dayDetailSheetScrollRef,
  error,
  isLoading,
  pendingDayDetailReturnSnapshotRef,
  persistTripUpdate,
  safeAreaBottom,
  safeAreaTop,
  selectedPageId,
  setActionError,
  setSelectedPageId,
  trip,
}: UseTripDetailImmersiveControllerParams) {
  const { width: windowWidth } = useWindowDimensions();
  const isOverviewSelected = selectedPageId === OVERVIEW_PAGE_ID;

  const selectedDay = useMemo(
    () =>
      trip && !isOverviewSelected
        ? getSelectedDay(trip.days, selectedPageId)
        : undefined,
    [isOverviewSelected, selectedPageId, trip],
  );
  const selectedDayItems = useMemo(
    () => (selectedDay ? getSortedTripDayItems(selectedDay.items) : []),
    [selectedDay],
  );
  const selectedDaySegments = useMemo(
    () =>
      trip && selectedDay ? buildTripDayRouteSegments(trip, selectedDay) : [],
    [selectedDay, trip],
  );

  const routeSegments = useTripRouteSegments({
    isOverviewSelected,
    selectedDay,
    selectedDaySegments,
    trip,
  });

  const dragReorder = useImmersiveDayItemDragReorder({
    persistTripUpdate,
    selectedDay,
    selectedDayItems,
    setActionError,
    trip,
  });
  const isDraggingSelectedDayItem = Boolean(dragReorder.draggedDayItem);

  const sheet = useImmersiveDaySheet({
    isDraggingSelectedDayItem,
    isOverviewSelected,
    pendingReturnSnapshotRef: pendingDayDetailReturnSnapshotRef,
    safeAreaBottom,
    safeAreaTop,
  });

  const mapPreview = useImmersiveMapPreviewCarousel({
    isMapPrioritySheet: sheet.isMapPrioritySheet,
    selectedDay,
    selectedDayItems,
    windowWidth,
  });

  const dayNavigation = useImmersiveDayNavigation({
    dayDetailSheetScrollRef,
    dayDetailVisibleSurfaceHeight: sheet.dayDetailVisibleSurfaceHeight,
    isOverviewSelected,
    selectedPageId,
    setSelectedPageId,
    trip,
  });

  const navigation = useImmersiveNavigation({
    dayDetailSheetSnapKey: sheet.dayDetailSheetSnapKey,
    selectedDay,
    selectedMapPreviewItemId: mapPreview.selectedItemId,
    trip,
  });

  const allDaySegments = useMemo(() => {
    if (!trip) return {};
    const result: Record<
      string,
      ReturnType<typeof buildTripDayRouteSegments>
    > = {};
    for (const day of trip.days) {
      result[day.id] = buildTripDayRouteSegments(trip, day);
    }
    return result;
  }, [trip]);

  const routeActions = useRouteActions({
    allDaySegments,
    clearRoutePreferenceError: routeSegments.clearRoutePreferenceError,
    markRouteModePendingIntent: routeSegments.markRouteModePendingIntent,
    persistTripUpdate,
    resetRouteFetchSnapshot: routeSegments.resetRouteFetchSnapshot,
    routeModePendingCounts: routeSegments.routeModePendingCounts,
    routeModePendingIntents: routeSegments.routeModePendingIntents,
    routePreference: routeSegments.routePreference,
    routeSegmentModes: routeSegments.routeSegmentModes,
    routeSegmentResults: routeSegments.routeSegmentResults,
    selectedDayId: selectedDay?.id,
    selectedDaySegments,
    setActionError,
    setRouteSegmentModes: routeSegments.setRouteSegmentModes,
    trip,
  });

  const { tripWeather } = useImmersiveTripWeather({ trip });

  const handleRouteMapStopPress = (item: TripDayItem, _place?: TripPlace) => {
    mapPreview.focusItem(item.id);

    if (!sheet.isMapPrioritySheet) {
      sheet.animateDayDetailSheetTo(
        sheet.dayDetailSnapHeights.collapsed,
        "collapsed",
      );
    }
  };

  const handleImmersiveTopBarLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;

    sheet.setImmersiveTopBarHeight((currentHeight) =>
      Math.abs(currentHeight - height) < 0.5 ? currentHeight : height,
    );
  };

  const isImmersiveDayView = Boolean(
    !isOverviewSelected && trip && selectedDay && !isLoading && !error,
  );

  return {
    allDaySegments,
    dayNavigation,
    dragReorder,
    handleImmersiveTopBarLayout,
    handleRouteMapStopPress,
    isDraggingSelectedDayItem,
    isImmersiveDayView,
    isOverviewSelected,
    mapPreview,
    navigation,
    routeActions,
    routeSegments,
    selectedDay,
    selectedDayItems,
    selectedDaySegments,
    sheet,
    tripWeather,
  };
}
