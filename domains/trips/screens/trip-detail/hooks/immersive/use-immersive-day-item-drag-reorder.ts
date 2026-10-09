import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

import {
  moveDayItemToIndex,
  type Trip,
  type TripDay,
  type TripDayItem,
} from "@/features/trips";

import {
  DAY_ITEM_DRAG_GAP,
  DAY_ITEM_DRAG_SETTLE_MS,
  DAY_ITEM_DRAG_STALE_MS,
} from "../../immersive/constants";
import type { DayItemDragState, DayItemLayout } from "../../immersive/types";

type PersistTripUpdate = (
  nextTrip: Trip,
  fallbackTrip: Trip,
  errorMessage?: string,
) => Promise<boolean>;

type UseDayItemDragReorderParams = {
  persistTripUpdate: PersistTripUpdate;
  selectedDay?: TripDay;
  selectedDayItems: TripDayItem[];
  setActionError: (message: string) => void;
  trip: Trip | null;
};

export function useImmersiveDayItemDragReorder({
  persistTripUpdate,
  selectedDay,
  selectedDayItems,
  setActionError,
  trip,
}: UseDayItemDragReorderParams) {
  const dayItemLayoutsRef = useRef<Record<string, DayItemLayout>>({});
  const draggedDayItemRef = useRef<DayItemDragState | undefined>(undefined);
  const [draggedDayItem, setDraggedDayItem] = useState<
    DayItemDragState | undefined
  >();

  const setCurrentDraggedDayItem = useCallback(
    (nextDrag: DayItemDragState | undefined) => {
      draggedDayItemRef.current = nextDrag;
      setDraggedDayItem(nextDrag);
    },
    [],
  );

  const handleDayItemLayout = (itemId: string, event: LayoutChangeEvent) => {
    const { height, y } = event.nativeEvent.layout;
    dayItemLayoutsRef.current[itemId] = { height, y };
  };

  const startDayItemDrag = (
    dayId: string,
    itemId: string,
    startIndex: number,
  ) => {
    setActionError("");
    setCurrentDraggedDayItem({
      currentIndex: startIndex,
      dayId,
      itemId,
      offsetY: 0,
      startIndex,
      startedAt: Date.now(),
    });
  };

  useEffect(() => {
    if (!draggedDayItem) {
      return undefined;
    }

    const cleanupTimer = setTimeout(() => {
      const currentDrag = draggedDayItemRef.current;

      if (
        currentDrag &&
        Date.now() - currentDrag.startedAt >= DAY_ITEM_DRAG_STALE_MS
      ) {
        setCurrentDraggedDayItem(undefined);
      }
    }, DAY_ITEM_DRAG_STALE_MS);

    return () => clearTimeout(cleanupTimer);
  }, [draggedDayItem, setCurrentDraggedDayItem]);

  useEffect(() => {
    dayItemLayoutsRef.current = {};
    draggedDayItemRef.current = undefined;
    setDraggedDayItem(undefined);
  }, []);

  const getDayItemDragShiftDistance = (
    drag: DayItemDragState,
    itemId: string,
  ) => {
    const draggedLayout = dayItemLayoutsRef.current[drag.itemId];
    const itemLayout = dayItemLayoutsRef.current[itemId];
    return (
      (draggedLayout?.height ?? itemLayout?.height ?? 72) + DAY_ITEM_DRAG_GAP
    );
  };

  const getDayItemReorderOffset = (itemId: string, itemIndex: number) => {
    if (
      !draggedDayItem ||
      selectedDay?.id !== draggedDayItem.dayId ||
      draggedDayItem.itemId === itemId
    ) {
      return 0;
    }

    const shiftDistance = getDayItemDragShiftDistance(draggedDayItem, itemId);

    if (
      draggedDayItem.currentIndex > draggedDayItem.startIndex &&
      itemIndex > draggedDayItem.startIndex &&
      itemIndex <= draggedDayItem.currentIndex
    ) {
      return -shiftDistance;
    }

    if (
      draggedDayItem.currentIndex < draggedDayItem.startIndex &&
      itemIndex >= draggedDayItem.currentIndex &&
      itemIndex < draggedDayItem.startIndex
    ) {
      return shiftDistance;
    }

    return 0;
  };

  const getDayItemSettleOffset = (drag: DayItemDragState) => {
    const draggedLayout = dayItemLayoutsRef.current[drag.itemId];

    if (!draggedLayout || !selectedDay) {
      return drag.offsetY;
    }

    const remainingItems = selectedDayItems.filter(
      (item) => item.id !== drag.itemId,
    );
    const targetBeforeItem = remainingItems[drag.currentIndex];

    if (targetBeforeItem) {
      const targetLayout = dayItemLayoutsRef.current[targetBeforeItem.id];
      return targetLayout ? targetLayout.y - draggedLayout.y : drag.offsetY;
    }

    const previousItem = remainingItems[drag.currentIndex - 1];

    if (!previousItem) {
      return drag.offsetY;
    }

    const previousLayout = dayItemLayoutsRef.current[previousItem.id];
    return previousLayout
      ? previousLayout.y +
          previousLayout.height +
          DAY_ITEM_DRAG_GAP -
          draggedLayout.y
      : drag.offsetY;
  };

  const updateDayItemDrag = (
    dayId: string,
    itemId: string,
    offsetY: number,
  ) => {
    const currentDrag = draggedDayItemRef.current;

    if (
      !selectedDay ||
      !currentDrag ||
      currentDrag.dayId !== dayId ||
      currentDrag.itemId !== itemId
    ) {
      return;
    }

    const draggedLayout = dayItemLayoutsRef.current[itemId];

    if (!draggedLayout) {
      setCurrentDraggedDayItem({ ...currentDrag, offsetY });
      return;
    }

    const remainingItems = selectedDayItems.filter(
      (item) => item.id !== itemId,
    );
    const draggedCenterY = draggedLayout.y + draggedLayout.height / 2 + offsetY;
    let nextIndex = remainingItems.length;

    for (let index = 0; index < remainingItems.length; index += 1) {
      const itemLayout = dayItemLayoutsRef.current[remainingItems[index]?.id];

      if (!itemLayout) {
        continue;
      }

      const itemCenterY = itemLayout.y + itemLayout.height / 2;

      if (draggedCenterY < itemCenterY) {
        nextIndex = index;
        break;
      }
    }

    setCurrentDraggedDayItem({
      ...currentDrag,
      currentIndex: nextIndex,
      offsetY,
    });
  };

  const endDayItemDrag = () => {
    const currentDrag = draggedDayItemRef.current;

    if (
      !trip ||
      !selectedDay ||
      !currentDrag ||
      currentDrag.dayId !== selectedDay.id
    ) {
      setCurrentDraggedDayItem(undefined);
      return;
    }

    const nextItems = moveDayItemToIndex(
      selectedDay.items,
      currentDrag.itemId,
      currentDrag.currentIndex,
    );
    const didChange = nextItems.some(
      (item, index) => item.id !== selectedDay.items[index]?.id,
    );

    if (!didChange) {
      setCurrentDraggedDayItem(undefined);
      return;
    }

    setCurrentDraggedDayItem({
      ...currentDrag,
      offsetY: getDayItemSettleOffset(currentDrag),
    });

    const nextTrip: Trip = {
      ...trip,
      days: trip.days.map((day) =>
        day.id === selectedDay.id
          ? {
              ...day,
              items: nextItems,
            }
          : day,
      ),
      updatedAt: new Date().toISOString(),
    };

    setTimeout(() => {
      setCurrentDraggedDayItem(undefined);
      void persistTripUpdate(nextTrip, trip, "调整地点顺序失败，请稍后再试");
    }, DAY_ITEM_DRAG_SETTLE_MS);
  };

  return {
    draggedDayItem,
    endDayItemDrag,
    getDayItemReorderOffset,
    handleDayItemLayout,
    startDayItemDrag,
    updateDayItemDrag,
  };
}
