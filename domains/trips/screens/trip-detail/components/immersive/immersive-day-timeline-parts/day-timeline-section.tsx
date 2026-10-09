import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memo, useCallback, useMemo, useState } from "react";
import { type LayoutChangeEvent, Pressable, Text, View } from "react-native";
import {
  formatExpenseAmount,
  getPlaceForTripDayItem,
  getSortedTripDayItems,
  getTripDayExpenseTotal,
  isRouteModePending,
  resolveTripDayTitle,
} from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { getWeatherIconName } from "../../weather/trip-weather";
import { DayPlanItem } from "../day-plan-item";
import { RouteSegmentConnector } from "./route-segment-connector";
import { createImmersiveDayTimelineStyles } from "./styles";
import { formatTimelineDayDate, getTimeStatusMap } from "./timeline-day";
import type { DayTimelineSectionProps } from "./types";
export const DayTimelineSection = memo(function DayTimelineSection({
  allDaySegments,
  collapsedDayIds,
  day,
  draggedDayItem,
  getDayItemReorderOffset,
  isActive,
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
  trip,
  tripWeather,
}: DayTimelineSectionProps) {
  const theme = useAppTheme();
  const styles = useMemo(
    () => createImmersiveDayTimelineStyles(theme),
    [theme],
  );
  const [timelineHeight, setTimelineHeight] = useState({
    containerHeight: 0,
    lastItemHeight: 0,
  });
  const dayItems = useMemo(() => getSortedTripDayItems(day.items), [day.items]);
  const timeStatusMap = useMemo(
    () => getTimeStatusMap(trip, day, dayItems),
    [day, dayItems, trip],
  );
  const daySegments = allDaySegments[day.id];
  const isCollapsed = Boolean(collapsedDayIds[day.id]);
  const dayTitle = resolveTripDayTitle(day);
  const dayDate = formatTimelineDayDate(trip, day);
  const dayCost = getTripDayExpenseTotal(trip, day);
  const dayWeather = tripWeather?.days.find(
    (forecast) => forecast.dayId === day.id,
  );
  const verticalLineHeight = Math.max(
    0,
    timelineHeight.containerHeight - timelineHeight.lastItemHeight,
  );

  const handleTimelineLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;

    setTimelineHeight((current) =>
      current.containerHeight === height
        ? current
        : { ...current, containerHeight: height },
    );
  }, []);

  const handleLastItemLayout = useCallback((height: number) => {
    setTimelineHeight((current) =>
      current.lastItemHeight === height
        ? current
        : { ...current, lastItemHeight: height },
    );
  }, []);

  return (
    <View
      onLayout={(event) => onSectionLayout(day.id, event)}
      style={[
        styles.dayTimelineSection,
        isActive && styles.dayTimelineSectionActive,
        isCollapsed && styles.dayTimelineSectionCollapsed,
      ]}
    >
      <View style={styles.dayTimelineHeaderButton}>
        <View style={styles.dayTimelineHeaderCopy}>
          <View style={styles.dayTimelineTitleRow}>
            <Pressable
              accessibilityLabel={`${isCollapsed ? "展开" : "收起"}${dayTitle}`}
              accessibilityRole="button"
              onPress={() => onToggleDaySection(day.id)}
              style={({ pressed }) => [
                styles.dayTimelineTitleButton,
                pressed && styles.dayTimelineHeaderButtonPressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.dayTimelineTitle}>
                {dayTitle}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`编辑${dayTitle}标题`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onDayTitleEdit(day.id);
              }}
              style={({ pressed }) => [
                styles.dayTitleEditButton,
                pressed && styles.dayTitleEditButtonPressed,
              ]}
            >
              <MaterialIcons
                name="edit"
                size={17}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel={`${isCollapsed ? "展开" : "收起"}${dayTitle}`}
            accessibilityRole="button"
            onPress={() => onToggleDaySection(day.id)}
            style={({ pressed }) => [
              styles.dayTimelineMetaButton,
              pressed && styles.dayTimelineHeaderButtonPressed,
            ]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={styles.dayTimelineMetaLine}
            >
              <Text style={styles.dayTimelineEyebrow}>
                {[dayDate, `${day.items.length}个地点`]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={styles.dayTimelineEyebrow}> · </Text>
              <Text
                style={styles.dayTimelineCostText}
              >{`花费 ${formatExpenseAmount(dayCost, trip.currency)}`}</Text>
              {dayWeather ? (
                <Text style={styles.dayTimelineWeatherText}>
                  {" · "}
                  <MaterialIcons
                    name={getWeatherIconName(dayWeather.condition)}
                    size={14}
                    color={theme.colors.link}
                  />
                  {` ${dayWeather.temperatureLow}-${dayWeather.temperatureHigh}°C · 降雨${dayWeather.precipitationChance}%`}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel={`${isCollapsed ? "展开" : "收起"}${dayTitle}`}
          accessibilityRole="button"
          onPress={() => onToggleDaySection(day.id)}
          style={[
            styles.dayCollapseButton,
            isActive && styles.dayCollapseButtonActive,
          ]}
        >
          <MaterialIcons
            name={isCollapsed ? "keyboard-arrow-down" : "keyboard-arrow-up"}
            size={26}
            color={isActive ? theme.colors.primary : theme.colors.textSubtle}
          />
        </Pressable>
      </View>

      {!isCollapsed ? (
        <>
          {dayItems.length > 0 ? (
            <View
              style={styles.timelineContainer}
              onLayout={handleTimelineLayout}
            >
              {verticalLineHeight > 0 ? (
                <View
                  style={[
                    styles.timelineVerticalLine,
                    { height: verticalLineHeight },
                  ]}
                />
              ) : null}
              {dayItems.map((item, index) => {
                const place = getPlaceForTripDayItem(trip, item);
                const nextItem = dayItems[index + 1];
                const routeSegment = nextItem
                  ? daySegments?.find(
                      (segment) =>
                        segment.fromItem.id === item.id &&
                        segment.toItem.id === nextItem.id,
                    )
                  : undefined;
                const isDraggingDayItem =
                  draggedDayItem?.dayId === day.id &&
                  draggedDayItem.itemId === item.id;
                const reorderOffsetY = isActive
                  ? getDayItemReorderOffset(item.id, index)
                  : 0;
                const timeStatus = timeStatusMap.get(item.id);

                return (
                  <View key={item.id}>
                    <View
                      onLayout={(event) => {
                        onDayItemLayout(item.id, event);
                        if (index === dayItems.length - 1) {
                          handleLastItemLayout(event.nativeEvent.layout.height);
                        }
                      }}
                      style={styles.dayItemDragSlot}
                    >
                      <DayPlanItem
                        accessibilityHint="点按查看详情，左滑可编辑或删除地点"
                        dragEnabled={false}
                        dragOffsetY={
                          isDraggingDayItem ? draggedDayItem.offsetY : 0
                        }
                        isDragging={isDraggingDayItem}
                        item={item}
                        onCostPress={() => onExpensePress(day, item, place)}
                        onDelete={() => onDayItemDelete(day.id, item.id)}
                        onDragEnd={onDayItemDragEnd}
                        onDragMove={(offsetY) =>
                          onDayItemDragMove(day.id, item.id, offsetY)
                        }
                        onDragStart={() =>
                          onDayItemDragStart(day.id, item.id, index)
                        }
                        onEdit={() => onDayItemEdit(day.id, item.id)}
                        onInteractionStart={() =>
                          onDayItemInteractionStart(day.id)
                        }
                        onPress={() => onDayItemPress(item, place, day.id)}
                        onTimePress={() =>
                          onDayItemTimePress(day.id, item.id, item.time)
                        }
                        place={place}
                        reorderOffsetY={reorderOffsetY}
                        swipeActionsEnabled
                        timeStatus={timeStatus}
                      />
                    </View>
                    {routeSegment ? (
                      <RouteSegmentConnector
                        isPending={isRouteModePending(
                          routeModePendingCounts,
                          routeModePendingIntents,
                          routeSegment.id,
                          routeSegmentModes[routeSegment.id],
                        )}
                        onPress={() =>
                          onRouteSegmentPress(day.id, routeSegment)
                        }
                        result={routeSegmentResults[routeSegment.id]}
                        selectedMode={routeSegmentModes[routeSegment.id]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyBlock}>
              <MaterialIcons
                name="event-note"
                size={28}
                color={theme.colors.textSubtle}
              />
              <Text style={styles.itemTitle}>这一天还没有安排行程地点</Text>
              <Text style={styles.mutedText}>
                先在下面这个浮层里继续补充时间、地点、备注和费用。
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => onAddPlace(day.id)}
            style={({ pressed }) => [
              styles.addPlaceButton,
              pressed && [
                styles.addPlaceButtonPressed,
                { backgroundColor: theme.colors.primarySoft },
              ],
            ]}
          >
            <MaterialIcons
              name="add-location-alt"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.addPlaceText}>添加地点</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
});
