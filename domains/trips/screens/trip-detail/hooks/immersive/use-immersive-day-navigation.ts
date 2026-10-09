import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";

import type { Trip } from "@/features/trips";
import type { ImmersiveDayTimelineListRef } from "../../components/immersive/immersive-day-timeline";
import { OVERVIEW_PAGE_ID } from "../../constants";
import {
  isScrollAtContentEnd,
  resolveActiveVisibleDayId,
  resolveScrollAnchorActiveDayId,
  resolveScrollEndActiveDayId,
} from "../../immersive/day-active-section";
import type { DaySectionLayout, DayTabLayout } from "../../immersive/types";

type UseTripDayNavigationParams = {
  dayDetailSheetScrollRef: RefObject<ImmersiveDayTimelineListRef | null>;
  dayDetailVisibleSurfaceHeight: number;
  isOverviewSelected: boolean;
  selectedPageId: string;
  setSelectedPageId: (
    updater: string | ((currentPageId: string) => string),
  ) => void;
  trip: Trip | null;
};

export function useImmersiveDayNavigation({
  dayDetailSheetScrollRef,
  dayDetailVisibleSurfaceHeight,
  isOverviewSelected,
  selectedPageId,
  setSelectedPageId,
  trip,
}: UseTripDayNavigationParams) {
  const dayTabsScrollRef = useRef<ScrollView | null>(null);
  const daySectionLayoutsRef = useRef<Record<string, DaySectionLayout>>({});
  const pendingDaySheetScrollRef = useRef<string | undefined>(undefined);
  const dayDetailSheetScrollMetricsRef = useRef({
    contentHeight: 0,
    scrollY: 0,
    viewportHeight: 0,
  });
  const visibleDayIdsRef = useRef<string[]>([]);
  const selectedPageIdRef = useRef(OVERVIEW_PAGE_ID);
  const longPressHandledDayIdRef = useRef("");
  const suppressScrollDayDetectionUntilRef = useRef(0);
  const scrollingToDayIdRef = useRef<string | null>(null);

  const [dayTabsViewportWidth, setDayTabsViewportWidth] = useState(0);
  const [dayTabsContentWidth, setDayTabsContentWidth] = useState(0);
  const [dayTabLayouts, setDayTabLayouts] = useState<
    Record<string, DayTabLayout>
  >({});
  const [collapsedDayIds, setCollapsedDayIds] = useState<
    Record<string, boolean>
  >({});

  const maxDayTabsScrollX = Math.max(
    0,
    dayTabsContentWidth - dayTabsViewportWidth,
  );

  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  const handleDayTabLayout = (tabId: string, event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;

    setDayTabLayouts((currentLayouts) => {
      const currentLayout = currentLayouts[tabId];

      if (
        currentLayout &&
        Math.abs(currentLayout.x - x) < 0.5 &&
        Math.abs(currentLayout.width - width) < 0.5
      ) {
        return currentLayouts;
      }

      return {
        ...currentLayouts,
        [tabId]: { width, x },
      };
    });
  };

  const scrollDaySheetToDay = useCallback(
    (dayId: string, animated = true) => {
      const dayIndex = trip?.days.findIndex((day) => day.id === dayId) ?? -1;

      if (dayIndex < 0 || !dayDetailSheetScrollRef.current) {
        pendingDaySheetScrollRef.current = dayId;
        return;
      }

      suppressScrollDayDetectionUntilRef.current = Date.now() + 800;
      pendingDaySheetScrollRef.current = undefined;
      dayDetailSheetScrollRef.current.scrollToIndex({
        index: dayIndex,
        animated,
      });
    },
    [dayDetailSheetScrollRef, trip],
  );

  const retryPendingDaySheetScroll = useCallback(
    (animated = false) => {
      const pendingDayId = pendingDaySheetScrollRef.current;

      if (!pendingDayId) {
        return;
      }

      setTimeout(() => scrollDaySheetToDay(pendingDayId, animated), 0);
    },
    [scrollDaySheetToDay],
  );

  const handleDaySectionLayout = (dayId: string, event: LayoutChangeEvent) => {
    const { height, y } = event.nativeEvent.layout;
    daySectionLayoutsRef.current[dayId] = { height, y };

    if (pendingDaySheetScrollRef.current === dayId) {
      retryPendingDaySheetScroll();
    }
  };

  const handleDayDetailSheetScrollLayout = (event: LayoutChangeEvent) => {
    dayDetailSheetScrollMetricsRef.current.viewportHeight =
      event.nativeEvent.layout.height;
    retryPendingDaySheetScroll();
  };

  const handleDayDetailSheetContentSizeChange = (
    _width: number,
    height: number,
  ) => {
    dayDetailSheetScrollMetricsRef.current.contentHeight = height;
    retryPendingDaySheetScroll();
  };

  const handleDayDetailSheetScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (
        isOverviewSelected ||
        Date.now() < suppressScrollDayDetectionUntilRef.current
      ) {
        return;
      }

      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      dayDetailSheetScrollMetricsRef.current.viewportHeight =
        layoutMeasurement.height;
      dayDetailSheetScrollMetricsRef.current.scrollY = contentOffset.y;

      const dayIds = trip?.days.map((day) => day.id) ?? [];
      const scrollEndDayId = resolveScrollEndActiveDayId({
        ...dayDetailSheetScrollMetricsRef.current,
        dayIds,
      });
      const anchorDayId = resolveScrollAnchorActiveDayId({
        ...dayDetailSheetScrollMetricsRef.current,
        dayIds,
        sectionLayouts: daySectionLayoutsRef.current,
      });
      const visibleDayId = resolveActiveVisibleDayId({
        isAtScrollEnd: false,
        viewableDayIds: visibleDayIdsRef.current,
      });
      const nextDayId = scrollEndDayId ?? anchorDayId ?? visibleDayId;

      if (!nextDayId || selectedPageIdRef.current === nextDayId) {
        return;
      }

      if (
        scrollingToDayIdRef.current &&
        nextDayId !== scrollingToDayIdRef.current
      ) {
        return;
      }

      if (nextDayId === scrollingToDayIdRef.current) {
        scrollingToDayIdRef.current = null;
      }

      selectedPageIdRef.current = nextDayId;
      setSelectedPageId(nextDayId);
    },
    [isOverviewSelected, setSelectedPageId, trip],
  );

  const handleDayTimelineVisibleDayChange = useCallback(
    (dayIds: string[]) => {
      visibleDayIdsRef.current = dayIds;

      if (
        isOverviewSelected ||
        Date.now() < suppressScrollDayDetectionUntilRef.current
      ) {
        return;
      }

      const dayId = resolveActiveVisibleDayId({
        isAtScrollEnd: isScrollAtContentEnd(
          dayDetailSheetScrollMetricsRef.current,
        ),
        viewableDayIds: dayIds,
      });

      if (!dayId || selectedPageIdRef.current === dayId) {
        return;
      }

      const scrollActiveDayId =
        resolveScrollEndActiveDayId({
          ...dayDetailSheetScrollMetricsRef.current,
          dayIds: trip?.days.map((day) => day.id) ?? [],
        }) ??
        resolveScrollAnchorActiveDayId({
          ...dayDetailSheetScrollMetricsRef.current,
          dayIds: trip?.days.map((day) => day.id) ?? [],
          sectionLayouts: daySectionLayoutsRef.current,
        });

      if (scrollActiveDayId && scrollActiveDayId !== dayId) {
        return;
      }

      if (
        scrollingToDayIdRef.current &&
        dayId !== scrollingToDayIdRef.current
      ) {
        return;
      }

      if (dayId === scrollingToDayIdRef.current) {
        scrollingToDayIdRef.current = null;
      }

      selectedPageIdRef.current = dayId;
      setSelectedPageId(dayId);
    },
    [isOverviewSelected, setSelectedPageId, trip],
  );

  const centerSelectedDayTab = useCallback(
    (animated = true) => {
      const selectedTabLayout = dayTabLayouts[selectedPageId];

      if (
        !selectedTabLayout ||
        dayTabsViewportWidth <= 0 ||
        dayTabsContentWidth <= 0
      ) {
        return;
      }

      const nextScrollX = Math.min(
        maxDayTabsScrollX,
        Math.max(
          0,
          selectedTabLayout.x +
            selectedTabLayout.width / 2 -
            dayTabsViewportWidth / 2,
        ),
      );

      dayTabsScrollRef.current?.scrollTo({ x: nextScrollX, animated });
    },
    [
      dayTabLayouts,
      dayTabsContentWidth,
      dayTabsViewportWidth,
      maxDayTabsScrollX,
      selectedPageId,
    ],
  );

  useEffect(() => {
    centerSelectedDayTab();
  }, [centerSelectedDayTab]);

  useEffect(() => {
    if (dayDetailVisibleSurfaceHeight <= 0) {
      return;
    }

    dayDetailSheetScrollMetricsRef.current.viewportHeight =
      dayDetailVisibleSurfaceHeight;
    retryPendingDaySheetScroll();
  }, [dayDetailVisibleSurfaceHeight, retryPendingDaySheetScroll]);

  const handleDayTabPress = (dayId: string) => {
    if (longPressHandledDayIdRef.current === dayId) {
      longPressHandledDayIdRef.current = "";
      return;
    }

    pendingDaySheetScrollRef.current = dayId;
    selectedPageIdRef.current = dayId;
    setSelectedPageId(dayId);
    scrollingToDayIdRef.current = dayId;
    setCollapsedDayIds((currentIds) => ({
      ...currentIds,
      [dayId]: false,
    }));
    scrollDaySheetToDay(dayId);

    setTimeout(() => {
      if (scrollingToDayIdRef.current === dayId) {
        scrollingToDayIdRef.current = null;
      }
    }, 1000);
  };

  const returnToOverview = () => {
    selectedPageIdRef.current = OVERVIEW_PAGE_ID;
    setSelectedPageId(OVERVIEW_PAGE_ID);
  };

  const toggleDaySection = (dayId: string) => {
    selectedPageIdRef.current = dayId;
    setSelectedPageId(dayId);
    setCollapsedDayIds((currentIds) => ({
      ...currentIds,
      [dayId]: !currentIds[dayId],
    }));
  };

  const scrollDayTabsToEnd = () => {
    dayTabsScrollRef.current?.scrollToEnd({ animated: true });
  };

  return {
    collapsedDayIds,
    dayTabsScrollRef,
    handleDayDetailSheetContentSizeChange,
    handleDayDetailSheetScroll,
    handleDayDetailSheetScrollLayout,
    handleDaySectionLayout,
    handleDayTabLayout,
    handleDayTabPress,
    handleDayTimelineVisibleDayChange,
    longPressHandledDayIdRef,
    pendingDaySheetScrollRef,
    retryPendingDaySheetScroll,
    returnToOverview,
    scrollDaySheetToDay,
    scrollDayTabsToEnd,
    selectedPageIdRef,
    setDayTabsContentWidth,
    setDayTabsViewportWidth,
    toggleDaySection,
  };
}
