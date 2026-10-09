import type { RefObject } from "react";

import type { ImmersiveDayTimelineListRef } from "../../components/immersive/immersive-day-timeline";
import type { TripDetailImmersiveSectionProps } from "../../components/immersive/trip-detail-immersive-section";
import type { TripDetailDayLayoutPreset } from "../../trip-detail-day-layout-preset";
import type { useTripItinerary } from "../itinerary/use-trip-itinerary";
import type { useTripLedger } from "../ledger/use-trip-ledger";
import type { useTripDetailImmersiveController } from "./use-trip-detail-immersive-controller";

type TripDetailImmersiveController = ReturnType<
  typeof useTripDetailImmersiveController
>;
type TripItineraryController = ReturnType<typeof useTripItinerary>;
type TripLedgerController = ReturnType<typeof useTripLedger>;

type UseTripDetailImmersiveSectionPropsParams = Pick<
  TripDetailImmersiveSectionProps,
  "actionError" | "styles" | "theme"
> & {
  bottomInset: number;
  dayDetailSheetScrollRef: RefObject<ImmersiveDayTimelineListRef | null>;
  immersive: TripDetailImmersiveController;
  itinerary: TripItineraryController;
  layoutPreset: TripDetailDayLayoutPreset;
  ledger: TripLedgerController;
  setSelectedPageId: TripDetailImmersiveSectionProps["timeline"]["setSelectedPageId"];
  trip: TripDetailImmersiveSectionProps["trip"] | null;
};

export function useTripDetailImmersiveSectionProps({
  actionError,
  bottomInset,
  dayDetailSheetScrollRef,
  immersive,
  itinerary,
  layoutPreset,
  ledger,
  setSelectedPageId,
  styles,
  theme,
  trip,
}: UseTripDetailImmersiveSectionPropsParams) {
  const {
    allDaySegments,
    dayNavigation,
    dragReorder,
    handleImmersiveTopBarLayout,
    handleRouteMapStopPress,
    isDraggingSelectedDayItem,
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
  } = immersive;

  const sectionProps: TripDetailImmersiveSectionProps | undefined =
    trip && selectedDay
      ? {
          actionError,
          chrome: {
            onBackPress: navigation.goBackToList,
            onOverviewPress: dayNavigation.returnToOverview,
            onTopBarLayout: handleImmersiveTopBarLayout,
          },
          day: {
            selectedDay,
            selectedDayItems,
            selectedDaySegments,
          },
          dayTabs: {
            isOverviewSelected,
            onAddDay: itinerary.addDayPlan,
            onContentWidthChange: dayNavigation.setDayTabsContentWidth,
            onDayLayout: dayNavigation.handleDayTabLayout,
            onDayLongPress: itinerary.openDayActions,
            onDayPress: dayNavigation.handleDayTabPress,
            onOverviewPress: dayNavigation.returnToOverview,
            onViewportWidthChange: dayNavigation.setDayTabsViewportWidth,
            scrollRef: dayNavigation.dayTabsScrollRef,
            selectedDayId: selectedDay.id,
          },
          isDayRouteLoading: routeSegments.isDayRouteLoading,
          layoutPreset,
          mapPreview: {
            activeIndex: mapPreview.activeIndex,
            activeItem: mapPreview.activeItem,
            cardWidth: mapPreview.cardWidth,
            isCarouselReady: mapPreview.isCarouselReady,
            onExpandPress: () =>
              sheet.animateDayDetailSheetTo(
                sheet.dayDetailSnapHeights.default,
                "default",
              ),
            onScrollEnd: mapPreview.handleScrollEnd,
            paddingBottom: sheet.dayMapPreviewBottomSpace,
            scrollRef: mapPreview.scrollRef,
          },
          route: {
            activeVisibleMapInset: sheet.activeVisibleMapInset,
            mapControlsTop: sheet.immersiveMapControlsTop,
            onSegmentPress: routeActions.openRouteSegmentActions,
            onStopPress: handleRouteMapStopPress,
            routeModePendingCounts: routeSegments.routeModePendingCounts,
            routeModePendingIntents: routeSegments.routeModePendingIntents,
            routeSegmentModes: routeSegments.routeSegmentModes,
            routeSegmentResults: routeSegments.routeSegmentResults,
          },
          sheet: {
            bottomInset,
            dayDetailSheetBodyPan: sheet.dayDetailSheetBodyPan,
            dayDetailSheetGrabberPan: sheet.dayDetailSheetGrabberPan,
            dayDetailSheetSnapKey: sheet.dayDetailSheetSnapKey,
            dayDetailVisibleSurfaceHeight: sheet.dayDetailVisibleSurfaceHeight,
            isDraggingSelectedDayItem,
            isMapPrioritySheet: sheet.isMapPrioritySheet,
            onLayoutHeightChange: sheet.setImmersiveLayoutHeight,
            onMapPreviewCarouselWidthChange: mapPreview.setCarouselWidth,
            sheetOverlayAnimatedStyle: sheet.sheetOverlayAnimatedStyle,
            sheetStageAnimatedStyle: sheet.sheetStageAnimatedStyle,
            topBarTop: sheet.immersiveTopBarTop,
          },
          styles,
          theme,
          timeline: {
            allDaySegments,
            collapsedDayIds: dayNavigation.collapsedDayIds,
            draggedDayItem: dragReorder.draggedDayItem,
            getDayItemReorderOffset: dragReorder.getDayItemReorderOffset,
            onAddPlace: itinerary.setActivePlaceSearchDayId,
            onContentSizeChange:
              dayNavigation.handleDayDetailSheetContentSizeChange,
            onDayItemDelete: itinerary.confirmDayItemDelete,
            onDayTitleEdit: itinerary.openDayTitleEditor,
            onDayItemDragEnd: dragReorder.endDayItemDrag,
            onDayItemDragMove: dragReorder.updateDayItemDrag,
            onDayItemDragStart: dragReorder.startDayItemDrag,
            onDayItemEdit: itinerary.openDayItemEditor,
            onDayItemLayout: dragReorder.handleDayItemLayout,
            onDayItemPress: navigation.handleDayItemPress,
            onDayItemTimePress: itinerary.openDayItemTimeEditor,
            onExpensePress: ledger.openExpenseInputForDayItem,
            onLayout: dayNavigation.handleDayDetailSheetScrollLayout,
            onScroll: dayNavigation.handleDayDetailSheetScroll,
            onSectionLayout: dayNavigation.handleDaySectionLayout,
            onToggleDaySection: dayNavigation.toggleDaySection,
            onVisibleDayChange: dayNavigation.handleDayTimelineVisibleDayChange,
            scrollRef: dayDetailSheetScrollRef,
            selectedPageIdRef: dayNavigation.selectedPageIdRef,
            setSelectedPageId,
            tripWeather,
          },
          trip,
        }
      : undefined;

  return {
    immersiveSectionProps: sectionProps,
  };
}
