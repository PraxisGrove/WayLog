import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  type FlatList as RNFlatList,
  View,
  type ViewToken,
} from "react-native";
import { FlatList as GestureFlatList } from "react-native-gesture-handler";
import type { TripDay } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { DayTimelineSection } from "./immersive-day-timeline-parts/day-timeline-section";
import { createImmersiveDayTimelineStyles } from "./immersive-day-timeline-parts/styles";
import type {
  ImmersiveDayTimelineListRef,
  ImmersiveDayTimelineProps,
} from "./immersive-day-timeline-parts/types";

export type {
  ImmersiveDayTimelineListRef,
  ImmersiveDayTimelineProps,
} from "./immersive-day-timeline-parts/types";
export const ImmersiveDayTimeline = forwardRef<
  ImmersiveDayTimelineListRef,
  ImmersiveDayTimelineProps
>(function ImmersiveDayTimeline(
  {
    allDaySegments,
    collapsedDayIds,
    contentContainerStyle,
    draggedDayItem,
    footerHeight,
    getDayItemReorderOffset,
    keyboardShouldPersistTaps = "handled",
    onAddPlace,
    onContentSizeChange,
    onDayItemDelete,
    onDayTitleEdit,
    onDayItemDragEnd,
    onDayItemDragMove,
    onDayItemDragStart,
    onDayItemEdit,
    onDayItemInteractionStart,
    onDayItemLayout,
    onDayItemPress,
    onDayItemTimePress,
    onExpensePress,
    onLayout,
    onRouteSegmentPress,
    onScroll,
    onSectionLayout,
    onToggleDaySection,
    onVisibleDayChange,
    routeModePendingCounts,
    routeModePendingIntents,
    routeSegmentModes,
    routeSegmentResults,
    scrollEnabled,
    selectedDayId,
    style,
    trip,
    tripWeather,
  },
  ref,
) {
  const theme = useAppTheme();
  const styles = useMemo(
    () => createImmersiveDayTimelineStyles(theme),
    [theme],
  );
  const listRef = useRef<RNFlatList<TripDay> | null>(null);
  const onVisibleDayChangeRef = useRef(onVisibleDayChange);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 18,
    minimumViewTime: 80,
  }).current;
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<TripDay>[] }) => {
      const visibleDayIds = viewableItems
        .filter((token) => token.isViewable && token.item)
        .map((token) => token.item.id);

      if (visibleDayIds.length > 0) {
        onVisibleDayChangeRef.current(visibleDayIds);
      }
    },
  ).current;

  useEffect(() => {
    onVisibleDayChangeRef.current = onVisibleDayChange;
  }, [onVisibleDayChange]);

  useImperativeHandle(
    ref,
    () => ({
      scrollTo: ({ animated = true, y }) => {
        listRef.current?.scrollToOffset({ animated, offset: y });
      },
      scrollToIndex: ({ animated = true, index }) => {
        listRef.current?.scrollToIndex({ animated, index, viewPosition: 0 });
      },
    }),
    [],
  );

  const renderDay = useCallback(
    ({ item: day }: { item: TripDay }) => (
      <DayTimelineSection
        allDaySegments={allDaySegments}
        collapsedDayIds={collapsedDayIds}
        day={day}
        draggedDayItem={draggedDayItem}
        getDayItemReorderOffset={getDayItemReorderOffset}
        isActive={selectedDayId === day.id}
        onAddPlace={onAddPlace}
        onDayItemDelete={onDayItemDelete}
        onDayTitleEdit={onDayTitleEdit}
        onDayItemDragEnd={onDayItemDragEnd}
        onDayItemDragMove={onDayItemDragMove}
        onDayItemDragStart={onDayItemDragStart}
        onDayItemEdit={onDayItemEdit}
        onDayItemInteractionStart={onDayItemInteractionStart}
        onDayItemLayout={onDayItemLayout}
        onDayItemPress={onDayItemPress}
        onDayItemTimePress={onDayItemTimePress}
        onExpensePress={onExpensePress}
        onRouteSegmentPress={onRouteSegmentPress}
        onSectionLayout={onSectionLayout}
        onToggleDaySection={onToggleDaySection}
        routeModePendingCounts={routeModePendingCounts}
        routeModePendingIntents={routeModePendingIntents}
        routeSegmentModes={routeSegmentModes}
        routeSegmentResults={routeSegmentResults}
        trip={trip}
        tripWeather={tripWeather}
      />
    ),
    [
      allDaySegments,
      collapsedDayIds,
      draggedDayItem,
      getDayItemReorderOffset,
      onAddPlace,
      onDayItemDelete,
      onDayTitleEdit,
      onDayItemDragEnd,
      onDayItemDragMove,
      onDayItemDragStart,
      onDayItemEdit,
      onDayItemInteractionStart,
      onDayItemLayout,
      onDayItemPress,
      onDayItemTimePress,
      onExpensePress,
      onRouteSegmentPress,
      onSectionLayout,
      onToggleDaySection,
      routeModePendingCounts,
      routeModePendingIntents,
      routeSegmentModes,
      routeSegmentResults,
      selectedDayId,
      trip,
      tripWeather,
    ],
  );

  return (
    <GestureFlatList
      contentContainerStyle={[
        styles.dayDetailSheetContent,
        contentContainerStyle,
      ]}
      data={trip.days}
      directionalLockEnabled
      initialNumToRender={3}
      ItemSeparatorComponent={DayTimelineSeparator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyExtractor={keyExtractor}
      ListFooterComponent={<View style={{ height: footerHeight }} />}
      maxToRenderPerBatch={3}
      nestedScrollEnabled
      onContentSizeChange={onContentSizeChange}
      onLayout={onLayout}
      renderItem={renderDay}
      onScroll={onScroll}
      onScrollToIndexFailed={(info) => {
        const offset = Math.max(0, info.averageItemLength * info.index);
        listRef.current?.scrollToOffset({ animated: true, offset });
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            animated: true,
            index: info.index,
            viewPosition: 0,
          });
        }, 80);
      }}
      onViewableItemsChanged={handleViewableItemsChanged}
      ref={(node) => {
        listRef.current = node as unknown as RNFlatList<TripDay> | null;
      }}
      removeClippedSubviews={false}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={[styles.dayDetailSheetScroll, style]}
      updateCellsBatchingPeriod={32}
      viewabilityConfig={viewabilityConfig}
      windowSize={5}
    />
  );
});
function keyExtractor(day: TripDay) {
  return day.id;
}

function DayTimelineSeparator() {
  return <View style={{ height: 12 }} />;
}
