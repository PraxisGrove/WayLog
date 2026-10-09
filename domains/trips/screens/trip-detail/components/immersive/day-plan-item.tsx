import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import { Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { formatExpenseAmount } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { DayPlanItemMainContent } from "./day-plan-item-parts/item-main-content";
import { DayPlanSwipeActions } from "./day-plan-item-parts/swipe-actions";
import { createDayPlanItemStyles } from "./day-plan-item-parts/styles";
import { DayPlanTimelineMarker } from "./day-plan-item-parts/timeline-marker";
import type {
  DayPlanItemProps,
  TimelineItemStatus,
} from "./day-plan-item-parts/types";

const DRAG_LONG_PRESS_MS = 1100;
const DRAG_PRESS_SUPPRESS_MS = 700;
const SWIPE_OPEN_OFFSET_X = 42;
const SWIPE_CLOSE_OFFSET_X = 96;
const SWIPE_VERTICAL_FAIL_OFFSET_Y = 8;
const SWIPE_OPEN_THRESHOLD = 50;

export type { TimelineItemStatus };

export function DayPlanItem({
  accessibilityHint,
  dragEnabled = true,
  dragOffsetY = 0,
  isDragging = false,
  item,
  onDelete,
  onDragEnd,
  onDragMove,
  onDragStart,
  onEdit,
  onInteractionEnd,
  onInteractionStart,
  onLongPress,
  onCostPress,
  onPress,
  onTimePress,
  place,
  reorderOffsetY = 0,
  swipeActionsEnabled = true,
  timeStatus,
}: DayPlanItemProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createDayPlanItemStyles(theme), [theme]);
  const [isReasonExpanded, setReasonExpanded] = useState(false);
  const swipeableRef = useRef<Swipeable | null>(null);
  const dragTranslateY = useRef(new Animated.Value(dragOffsetY)).current;
  const liftProgress = useRef(new Animated.Value(isDragging ? 1 : 0)).current;
  const reorderTranslateY = useRef(new Animated.Value(reorderOffsetY)).current;
  const isDragActiveRef = useRef(false);
  const dragStartPageYRef = useRef(0);
  const lastTouchPageYRef = useRef(0);
  const shouldIgnoreNextPressRef = useRef(false);
  const suppressPressUntilRef = useRef(0);
  const metaParts = [
    item.placeName && item.placeName !== item.title
      ? item.placeName
      : undefined,
    place?.area && place.area !== item.note ? place.area : undefined,
  ].filter(Boolean);
  const metaText = metaParts.join(" · ");
  const addressText =
    place?.address &&
    place.address !== item.title &&
    place.address !== item.placeName
      ? place.address
      : undefined;
  const locationText = [addressText, metaText].filter(Boolean).join(" · ");
  const noteText =
    item.note && item.note !== metaText && item.note !== locationText
      ? item.note
      : undefined;
  const recommendationReason = item.recommendationReason?.trim();
  const hasRecordedCost =
    typeof item.cost === "number" &&
    (item.cost > 0 || Boolean(item.costRecordedAt));
  const costLabel = hasRecordedCost
    ? item.cost === 0
      ? "免费"
      : `花费 ${formatExpenseAmount(item.cost)}`
    : "待记录";
  const hasSwipeActions = swipeActionsEnabled && Boolean(onEdit || onDelete);

  useEffect(() => {
    Animated.spring(dragTranslateY, {
      damping: isDragging ? 36 : 26,
      mass: 0.8,
      stiffness: isDragging ? 520 : 360,
      toValue: isDragging ? dragOffsetY : 0,
      useNativeDriver: true,
    }).start();
  }, [dragOffsetY, dragTranslateY, isDragging]);

  useEffect(() => {
    Animated.spring(reorderTranslateY, {
      damping: 30,
      mass: 0.85,
      stiffness: 360,
      toValue: reorderOffsetY,
      useNativeDriver: true,
    }).start();
  }, [reorderOffsetY, reorderTranslateY]);

  useEffect(() => {
    Animated.timing(liftProgress, {
      duration: isDragging ? 110 : 140,
      toValue: isDragging ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [isDragging, liftProgress]);

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const endDrag = useCallback(() => {
    if (!isDragActiveRef.current) {
      return;
    }

    isDragActiveRef.current = false;
    suppressPressUntilRef.current = Date.now() + DRAG_PRESS_SUPPRESS_MS;
    onDragEnd?.();
    setTimeout(() => {
      shouldIgnoreNextPressRef.current = false;
    }, DRAG_PRESS_SUPPRESS_MS);
  }, [onDragEnd]);

  const handleTouchEnd = useCallback(() => {
    endDrag();
    onInteractionEnd?.();
  }, [endDrag, onInteractionEnd]);

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const pageY = event.nativeEvent.pageY ?? 0;
      dragStartPageYRef.current = pageY;
      lastTouchPageYRef.current = pageY;
      onInteractionStart?.();
    },
    [onInteractionStart],
  );

  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const pageY = event.nativeEvent.pageY ?? lastTouchPageYRef.current;
      lastTouchPageYRef.current = pageY;

      if (!isDragActiveRef.current) {
        return;
      }

      onDragMove?.(pageY - dragStartPageYRef.current);
    },
    [onDragMove],
  );

  const startDrag = useCallback(() => {
    if (!onDragStart) {
      onLongPress?.();
      return;
    }

    if (isDragActiveRef.current) {
      return;
    }

    closeSwipeable();
    dragStartPageYRef.current =
      lastTouchPageYRef.current || dragStartPageYRef.current;
    isDragActiveRef.current = true;
    shouldIgnoreNextPressRef.current = true;
    suppressPressUntilRef.current = Date.now() + DRAG_PRESS_SUPPRESS_MS;
    onDragStart();
  }, [onDragStart, onLongPress, closeSwipeable]);

  const renderSwipeActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <DayPlanSwipeActions
      closeSwipeable={closeSwipeable}
      item={item}
      onDelete={onDelete}
      onEdit={onEdit}
      progress={progress}
      styles={styles}
    />
  );

  const rowAnimatedStyle = {
    transform: [
      {
        translateY: Animated.add(dragTranslateY, reorderTranslateY),
      },
      {
        scale: liftProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.015],
        }),
      },
    ],
  };

  const rowTouchHandlers = dragEnabled
    ? {
        onTouchCancel: handleTouchEnd,
        onTouchEnd: handleTouchEnd,
        onTouchMove: handleTouchMove,
        onTouchStart: handleTouchStart,
      }
    : undefined;
  const handleMainPress = () => {
    if (
      shouldIgnoreNextPressRef.current ||
      Date.now() < suppressPressUntilRef.current
    ) {
      shouldIgnoreNextPressRef.current = false;
      return;
    }

    onPress();
  };
  const row = (
    <Animated.View
      {...rowTouchHandlers}
      style={[styles.row, rowAnimatedStyle, isDragging && styles.draggingRow]}
    >
      <DayPlanTimelineMarker
        item={item}
        onTimePress={onTimePress}
        styles={styles}
        timeStatus={timeStatus}
      />
      <DayPlanItemMainContent
        accessibilityHint={accessibilityHint}
        costLabel={costLabel}
        dragEnabled={dragEnabled}
        dragLongPressMs={DRAG_LONG_PRESS_MS}
        handleMainPress={handleMainPress}
        handleTouchEnd={handleTouchEnd}
        hasRecordedCost={hasRecordedCost}
        isReasonExpanded={isReasonExpanded}
        item={item}
        locationText={locationText}
        noteText={noteText}
        onCostPress={onCostPress}
        onTimePress={onTimePress}
        place={place}
        recommendationReason={recommendationReason}
        setReasonExpanded={setReasonExpanded}
        startDrag={startDrag}
        styles={styles}
      />
    </Animated.View>
  );

  if (!hasSwipeActions) {
    return row;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      dragOffsetFromLeftEdge={SWIPE_CLOSE_OFFSET_X}
      dragOffsetFromRightEdge={SWIPE_OPEN_OFFSET_X}
      enabled={!isDragging}
      failOffsetY={[
        -SWIPE_VERTICAL_FAIL_OFFSET_Y,
        SWIPE_VERTICAL_FAIL_OFFSET_Y,
      ]}
      friction={1.18}
      onSwipeableClose={onInteractionEnd}
      onSwipeableOpenStartDrag={onInteractionStart}
      onSwipeableWillClose={onInteractionEnd}
      onSwipeableWillOpen={onInteractionStart}
      overshootFriction={12}
      overshootRight={false}
      renderRightActions={renderSwipeActions}
      rightThreshold={SWIPE_OPEN_THRESHOLD}
    >
      {row}
    </Swipeable>
  );
}
