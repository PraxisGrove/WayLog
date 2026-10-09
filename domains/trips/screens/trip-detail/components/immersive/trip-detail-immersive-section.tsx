import type { ComponentProps, MutableRefObject } from "react";
import type { LayoutChangeEvent } from "react-native";
import {
  formatMapPreviewSegmentText,
  type TripDayRouteSegment,
} from "@/features/trips";
import type { TripDetailDayLayoutPreset } from "../../trip-detail-day-layout-preset";
import { TripDetailDayTabs } from "../day-tabs";

import { DayMapPreviewHeader } from "./day-map-preview-header";
import {
  TripDetailImmersiveDayContent,
  type TripDetailImmersiveDayContentProps,
} from "./trip-detail-immersive-day-content";

type TripDetailDayTabsProps = ComponentProps<typeof TripDetailDayTabs>;

export type TripDetailImmersiveSectionProps = {
  actionError?: string;
  chrome: {
    onBackPress: TripDetailImmersiveDayContentProps["onBackPress"];
    onOverviewPress: TripDetailImmersiveDayContentProps["onOverviewPress"];
    onTopBarLayout: (event: LayoutChangeEvent) => void;
  };
  day: {
    selectedDay: TripDetailImmersiveDayContentProps["routeMap"]["selectedDay"];
    selectedDayItems: TripDetailImmersiveDayContentProps["routeMap"]["selectedDayItems"];
    selectedDaySegments: TripDetailImmersiveDayContentProps["routeMap"]["selectedDaySegments"];
  };
  dayTabs: {
    isOverviewSelected: TripDetailDayTabsProps["isOverviewSelected"];
    onAddDay: TripDetailDayTabsProps["onAddDay"];
    onContentWidthChange: TripDetailDayTabsProps["onContentWidthChange"];
    onDayLayout: TripDetailDayTabsProps["onDayLayout"];
    onDayLongPress: TripDetailDayTabsProps["onDayLongPress"];
    onDayPress: TripDetailDayTabsProps["onDayPress"];
    onOverviewPress: TripDetailDayTabsProps["onOverviewPress"];
    onViewportWidthChange: TripDetailDayTabsProps["onViewportWidthChange"];
    scrollRef: TripDetailDayTabsProps["scrollRef"];
    selectedDayId: TripDetailDayTabsProps["selectedDayId"];
  };
  isDayRouteLoading: boolean;
  layoutPreset: TripDetailDayLayoutPreset;
  mapPreview: {
    activeIndex: number;
    activeItem: TripDetailImmersiveDayContentProps["mapPreviewPanelProps"]["activeItem"];
    cardWidth: number;
    isCarouselReady: boolean;
    onExpandPress: () => void;
    onScrollEnd: TripDetailImmersiveDayContentProps["mapPreviewPanelProps"]["onScrollEnd"];
    paddingBottom: number;
    scrollRef: TripDetailImmersiveDayContentProps["mapPreviewPanelProps"]["scrollRef"];
  };
  route: {
    activeVisibleMapInset: number;
    mapControlsTop: number;
    onSegmentPress: (segment: TripDayRouteSegment, dayId?: string) => void;
    onStopPress: TripDetailImmersiveDayContentProps["routeMap"]["onStopPress"];
    routeModePendingCounts: TripDetailImmersiveDayContentProps["timelineProps"]["routeModePendingCounts"];
    routeModePendingIntents: TripDetailImmersiveDayContentProps["timelineProps"]["routeModePendingIntents"];
    routeSegmentModes: TripDetailImmersiveDayContentProps["routeMap"]["routeSegmentModes"];
    routeSegmentResults: TripDetailImmersiveDayContentProps["routeMap"]["routeSegmentResults"];
  };
  sheet: {
    bottomInset: number;
    dayDetailSheetBodyPan: TripDetailImmersiveDayContentProps["layout"]["dayDetailSheetBodyPan"];
    dayDetailSheetGrabberPan: TripDetailImmersiveDayContentProps["layout"]["dayDetailSheetGrabberPan"];
    dayDetailSheetSnapKey: TripDetailImmersiveDayContentProps["layout"]["dayDetailSheetSnapKey"];
    dayDetailVisibleSurfaceHeight: number;
    isDraggingSelectedDayItem: boolean;
    isMapPrioritySheet: boolean;
    onLayoutHeightChange: TripDetailImmersiveDayContentProps["layout"]["onLayoutHeightChange"];
    onMapPreviewCarouselWidthChange: TripDetailImmersiveDayContentProps["layout"]["onMapPreviewCarouselWidthChange"];
    sheetOverlayAnimatedStyle: TripDetailImmersiveDayContentProps["layout"]["sheetOverlayAnimatedStyle"];
    sheetStageAnimatedStyle: TripDetailImmersiveDayContentProps["layout"]["sheetStageAnimatedStyle"];
    topBarTop: number;
  };
  styles: TripDetailImmersiveDayContentProps["styles"];
  theme: TripDetailImmersiveDayContentProps["theme"];
  timeline: {
    allDaySegments: TripDetailImmersiveDayContentProps["timelineProps"]["allDaySegments"];
    collapsedDayIds: TripDetailImmersiveDayContentProps["timelineProps"]["collapsedDayIds"];
    draggedDayItem: TripDetailImmersiveDayContentProps["timelineProps"]["draggedDayItem"];
    getDayItemReorderOffset: TripDetailImmersiveDayContentProps["timelineProps"]["getDayItemReorderOffset"];
    onAddPlace: TripDetailImmersiveDayContentProps["timelineProps"]["onAddPlace"];
    onContentSizeChange: TripDetailImmersiveDayContentProps["timelineProps"]["onContentSizeChange"];
    onDayItemDelete: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemDelete"];
    onDayTitleEdit: TripDetailImmersiveDayContentProps["timelineProps"]["onDayTitleEdit"];
    onDayItemDragEnd: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemDragEnd"];
    onDayItemDragMove: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemDragMove"];
    onDayItemDragStart: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemDragStart"];
    onDayItemEdit: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemEdit"];
    onDayItemLayout: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemLayout"];
    onDayItemPress: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemPress"];
    onDayItemTimePress: TripDetailImmersiveDayContentProps["timelineProps"]["onDayItemTimePress"];
    onExpensePress: TripDetailImmersiveDayContentProps["timelineProps"]["onExpensePress"];
    onLayout: TripDetailImmersiveDayContentProps["timelineProps"]["onLayout"];
    onScroll: TripDetailImmersiveDayContentProps["timelineProps"]["onScroll"];
    onSectionLayout: TripDetailImmersiveDayContentProps["timelineProps"]["onSectionLayout"];
    onToggleDaySection: TripDetailImmersiveDayContentProps["timelineProps"]["onToggleDaySection"];
    onVisibleDayChange: TripDetailImmersiveDayContentProps["timelineProps"]["onVisibleDayChange"];
    scrollRef: TripDetailImmersiveDayContentProps["timelineRef"];
    selectedPageIdRef: MutableRefObject<string>;
    setSelectedPageId: (dayId: string) => void;
    tripWeather: TripDetailImmersiveDayContentProps["timelineProps"]["tripWeather"];
  };
  trip: TripDetailImmersiveDayContentProps["trip"];
};

export function TripDetailImmersiveSection({
  actionError,
  chrome,
  day,
  dayTabs,
  isDayRouteLoading,
  layoutPreset,
  mapPreview,
  route,
  sheet,
  styles,
  theme,
  timeline,
  trip,
}: TripDetailImmersiveSectionProps) {
  const activeMapPreviewPreviousSegment =
    mapPreview.activeIndex > 0
      ? day.selectedDaySegments[mapPreview.activeIndex - 1]
      : undefined;
  const activeMapPreviewNextSegment =
    mapPreview.activeIndex >= 0
      ? day.selectedDaySegments[mapPreview.activeIndex]
      : undefined;
  const mapPreviewRouteTextOptions = {
    pendingCounts: route.routeModePendingCounts,
    pendingIntents: route.routeModePendingIntents,
    routeSegmentModes: route.routeSegmentModes,
    routeSegmentResults: route.routeSegmentResults,
  };
  const activeMapPreviewPreviousText = formatMapPreviewSegmentText(
    activeMapPreviewPreviousSegment,
    "当天起点",
    mapPreviewRouteTextOptions,
  );
  const activeMapPreviewNextText = formatMapPreviewSegmentText(
    activeMapPreviewNextSegment,
    "当天终点",
    mapPreviewRouteTextOptions,
  );
  const dayTabsContent = (
    <TripDetailDayTabs
      isOverviewSelected={dayTabs.isOverviewSelected}
      onAddDay={dayTabs.onAddDay}
      onContentWidthChange={dayTabs.onContentWidthChange}
      onDayLayout={dayTabs.onDayLayout}
      onDayLongPress={dayTabs.onDayLongPress}
      onDayPress={dayTabs.onDayPress}
      onOverviewPress={dayTabs.onOverviewPress}
      onViewportWidthChange={dayTabs.onViewportWidthChange}
      scrollRef={dayTabs.scrollRef}
      selectedDayId={dayTabs.selectedDayId}
      styles={styles}
      theme={theme}
      trip={trip}
    />
  );

  return (
    <TripDetailImmersiveDayContent
      actionError={actionError}
      dayMapPreviewHeaderContent={
        <DayMapPreviewHeader
          itemCount={day.selectedDayItems.length}
          onExpandPress={mapPreview.onExpandPress}
          selectedDay={day.selectedDay}
        />
      }
      dayTabsContent={dayTabsContent}
      isDayRouteLoading={isDayRouteLoading}
      layoutPreset={layoutPreset}
      layout={{
        bottomInset: sheet.bottomInset,
        dayDetailSheetBodyPan: sheet.dayDetailSheetBodyPan,
        dayDetailSheetGrabberPan: sheet.dayDetailSheetGrabberPan,
        dayDetailSheetSnapKey: sheet.dayDetailSheetSnapKey,
        dayDetailVisibleSurfaceHeight: sheet.dayDetailVisibleSurfaceHeight,
        isDraggingSelectedDayItem: sheet.isDraggingSelectedDayItem,
        isMapPrioritySheet: sheet.isMapPrioritySheet,
        onLayoutHeightChange: sheet.onLayoutHeightChange,
        onMapPreviewCarouselWidthChange: sheet.onMapPreviewCarouselWidthChange,
        sheetOverlayAnimatedStyle: sheet.sheetOverlayAnimatedStyle,
        sheetStageAnimatedStyle: sheet.sheetStageAnimatedStyle,
      }}
      mapPreviewPanelProps={{
        activeItem: mapPreview.activeItem,
        cardWidth: mapPreview.cardWidth,
        isCarouselReady: mapPreview.isCarouselReady,
        items: day.selectedDayItems,
        nextSegment: activeMapPreviewNextSegment,
        nextSegmentText: activeMapPreviewNextText,
        onItemPress: timeline.onDayItemPress,
        onLayoutWidth: sheet.onMapPreviewCarouselWidthChange,
        onRouteSegmentPress: route.onSegmentPress,
        onScrollEnd: mapPreview.onScrollEnd,
        paddingBottom: mapPreview.paddingBottom,
        previousSegment: activeMapPreviewPreviousSegment,
        previousSegmentText: activeMapPreviewPreviousText,
        scrollRef: mapPreview.scrollRef,
        selectedDay: day.selectedDay,
        trip,
      }}
      onBackPress={chrome.onBackPress}
      onOverviewPress={chrome.onOverviewPress}
      onTopBarLayout={chrome.onTopBarLayout}
      routeMap={{
        activeStopId: mapPreview.activeItem?.id,
        activeVisibleMapInset: route.activeVisibleMapInset,
        immersiveMapControlsTop: route.mapControlsTop,
        onStopPress: route.onStopPress,
        routeSegmentModes: route.routeSegmentModes,
        routeSegmentResults: route.routeSegmentResults,
        selectedDay: day.selectedDay,
        selectedDayItems: day.selectedDayItems,
        selectedDaySegments: day.selectedDaySegments,
      }}
      styles={styles}
      theme={theme}
      timelineProps={{
        allDaySegments: timeline.allDaySegments,
        collapsedDayIds: timeline.collapsedDayIds,
        contentContainerStyle: {
          paddingBottom: Math.max(32, sheet.bottomInset + 20),
        },
        draggedDayItem: timeline.draggedDayItem,
        footerHeight: Math.max(40, sheet.bottomInset + 24),
        getDayItemReorderOffset: timeline.getDayItemReorderOffset,
        keyboardShouldPersistTaps: "handled",
        onAddPlace: timeline.onAddPlace,
        onContentSizeChange: timeline.onContentSizeChange,
        onDayItemDelete: timeline.onDayItemDelete,
        onDayTitleEdit: timeline.onDayTitleEdit,
        onDayItemDragEnd: timeline.onDayItemDragEnd,
        onDayItemDragMove: timeline.onDayItemDragMove,
        onDayItemDragStart: timeline.onDayItemDragStart,
        onDayItemEdit: timeline.onDayItemEdit,
        onDayItemInteractionStart: (dayId) => {
          if (timeline.selectedPageIdRef.current !== dayId) {
            timeline.selectedPageIdRef.current = dayId;
            timeline.setSelectedPageId(dayId);
          }
        },
        onDayItemLayout: timeline.onDayItemLayout,
        onDayItemPress: timeline.onDayItemPress,
        onDayItemTimePress: timeline.onDayItemTimePress,
        onExpensePress: timeline.onExpensePress,
        onLayout: timeline.onLayout,
        onRouteSegmentPress: (dayId, segment) =>
          route.onSegmentPress(segment, dayId),
        onScroll: timeline.onScroll,
        onSectionLayout: timeline.onSectionLayout,
        onToggleDaySection: timeline.onToggleDaySection,
        onVisibleDayChange: timeline.onVisibleDayChange,
        routeModePendingCounts: route.routeModePendingCounts,
        routeModePendingIntents: route.routeModePendingIntents,
        routeSegmentModes: route.routeSegmentModes,
        routeSegmentResults: route.routeSegmentResults,
        scrollEnabled:
          !sheet.isDraggingSelectedDayItem &&
          sheet.dayDetailSheetSnapKey !== "collapsed",
        selectedDayId: day.selectedDay.id,
        style: styles.dayDetailSheetScroll,
        trip,
        tripWeather: timeline.tripWeather,
      }}
      timelineRef={timeline.scrollRef}
      topBarTop={sheet.topBarTop}
      trip={trip}
    />
  );
}
