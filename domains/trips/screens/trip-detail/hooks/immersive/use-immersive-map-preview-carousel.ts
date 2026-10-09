import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";

import type { TripDay, TripDayItem } from "@/features/trips";

import { DAY_MAP_PREVIEW_CARD_GAP } from "../../immersive/constants";

type UseMapPreviewCarouselParams = {
  isMapPrioritySheet: boolean;
  selectedDay?: TripDay;
  selectedDayItems: TripDayItem[];
  windowWidth: number;
};

export function useImmersiveMapPreviewCarousel({
  isMapPrioritySheet,
  selectedDay,
  selectedDayItems,
  windowWidth,
}: UseMapPreviewCarouselParams) {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollDrivenSelectionRef = useRef(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [carouselWidth, setCarouselWidth] = useState(0);

  const activeIndex = useMemo(() => {
    if (selectedDayItems.length === 0) {
      return -1;
    }

    const selectedIndex = selectedDayItems.findIndex(
      (item) => item.id === selectedItemId,
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [selectedDayItems, selectedItemId]);

  const activeItem =
    activeIndex >= 0 ? selectedDayItems[activeIndex] : undefined;
  const inferredCarouselWidth = Math.max(0, windowWidth - 32);
  const resolvedCarouselWidth =
    carouselWidth > 0 ? carouselWidth : inferredCarouselWidth;
  const cardWidth = Math.max(0, resolvedCarouselWidth - 32);
  const isCarouselReady = cardWidth > 0;

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      if (index < 0 || cardWidth <= 0) {
        return;
      }

      scrollRef.current?.scrollTo({
        x: index * (cardWidth + DAY_MAP_PREVIEW_CARD_GAP),
        animated,
      });
    },
    [cardWidth],
  );

  const focusItem = useCallback(
    (itemId: string, animated = true) => {
      const nextIndex = selectedDayItems.findIndex(
        (item) => item.id === itemId,
      );

      if (nextIndex < 0) {
        return;
      }

      setSelectedItemId(itemId);
      scrollToIndex(nextIndex, animated);
    },
    [scrollToIndex, selectedDayItems],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardWidth <= 0 || selectedDayItems.length === 0) {
        return;
      }

      const interval = cardWidth + DAY_MAP_PREVIEW_CARD_GAP;
      const nextIndex = Math.max(
        0,
        Math.min(
          selectedDayItems.length - 1,
          Math.round(event.nativeEvent.contentOffset.x / interval),
        ),
      );
      const nextItem = selectedDayItems[nextIndex];

      if (nextItem && nextItem.id !== selectedItemId) {
        scrollDrivenSelectionRef.current = true;
        setSelectedItemId(nextItem.id);
      }
    },
    [cardWidth, selectedDayItems, selectedItemId],
  );

  useEffect(() => {
    if (!selectedDay || selectedDayItems.length === 0) {
      setSelectedItemId(undefined);
      return;
    }

    if (
      !selectedItemId ||
      !selectedDayItems.some((item) => item.id === selectedItemId)
    ) {
      setSelectedItemId(selectedDayItems[0]?.id);
    }
  }, [selectedDay, selectedDayItems, selectedItemId]);

  useEffect(() => {
    if (!isMapPrioritySheet || activeIndex < 0) {
      return;
    }

    if (scrollDrivenSelectionRef.current) {
      scrollDrivenSelectionRef.current = false;
      return;
    }

    scrollToIndex(activeIndex, false);
  }, [activeIndex, isMapPrioritySheet, scrollToIndex]);

  return {
    activeIndex,
    activeItem,
    cardWidth,
    focusItem,
    handleScrollEnd,
    isCarouselReady,
    scrollRef,
    selectedItemId,
    setCarouselWidth,
    setSelectedItemId,
  };
}
