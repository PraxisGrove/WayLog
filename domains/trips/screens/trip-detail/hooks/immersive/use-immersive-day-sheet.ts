import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { triggerHaptic } from "@/shared/ui/haptic-feedback";

import {
  DAY_DETAIL_HANDLE_ZONE_HEIGHT,
  DAY_DETAIL_SHEET_COLLAPSED_MAX_RATIO,
  DAY_DETAIL_SHEET_COLLAPSED_MIN_HEIGHT,
  DAY_DETAIL_SHEET_COLLAPSED_RATIO,
  DAY_DETAIL_SHEET_DEFAULT_RATIO,
  DAY_DETAIL_SHEET_EXPANDED_TOP_OFFSET,
  DAY_MAP_PREVIEW_COLLAPSED_STATIC_HEIGHT,
  ESTIMATED_COLLAPSED_SHEET_HEIGHT,
  ESTIMATED_DEFAULT_SHEET_HEIGHT,
  ESTIMATED_EXPANDED_SHEET_HEIGHT,
  getDayMapPreviewBottomSpace,
  IMMERSIVE_MAP_CONTROL_TOP_GAP,
  IMMERSIVE_TOP_BAR_ESTIMATED_HEIGHT,
  IMMERSIVE_TOP_BAR_TOP_GAP,
  MAP_COLLAPSED_EXTRA_BOTTOM_INSET,
  MAP_STABLE_SHEET_BOTTOM_INSET,
} from "../../immersive/constants";
import type {
  DayDetailSheetContentMode,
  DayDetailSheetReturnSnapshot,
  DayDetailSheetSnapKey,
} from "../../immersive/types";

type DayDetailSnapHeights = Record<DayDetailSheetSnapKey, number>;

function getRubberBandDistance(overshoot: number, dimension: number) {
  "worklet";
  const constant = 0.55;
  return (
    (overshoot * dimension * constant) / (dimension + constant * overshoot)
  );
}

type UseDayDetailSheetParams = {
  isDraggingSelectedDayItem: boolean;
  isOverviewSelected: boolean;
  pendingReturnSnapshotRef: MutableRefObject<
    DayDetailSheetReturnSnapshot | undefined
  >;
  safeAreaBottom: number;
  safeAreaTop: number;
};

export function useImmersiveDaySheet({
  isDraggingSelectedDayItem,
  isOverviewSelected,
  pendingReturnSnapshotRef,
  safeAreaBottom,
  safeAreaTop,
}: UseDayDetailSheetParams) {
  const [immersiveLayoutHeight, setImmersiveLayoutHeight] = useState(0);
  const [immersiveTopBarHeight, setImmersiveTopBarHeight] = useState(
    IMMERSIVE_TOP_BAR_ESTIMATED_HEIGHT,
  );
  const [dayDetailSheetSnapKey, setDayDetailSheetSnapKey] =
    useState<DayDetailSheetSnapKey>("default");
  const [mapFitSnapKey, setMapFitSnapKey] =
    useState<DayDetailSheetSnapKey>("default");
  const [dayDetailSheetContentMode, setDayDetailSheetContentMode] =
    useState<DayDetailSheetContentMode>("timeline");
  const pendingContentModeRef = useRef<DayDetailSheetContentMode | undefined>(
    undefined,
  );

  const overlayHeightSV = useSharedValue(ESTIMATED_DEFAULT_SHEET_HEIGHT);
  const dragStartSV = useSharedValue(ESTIMATED_DEFAULT_SHEET_HEIGHT);
  const snapExpandedSV = useSharedValue(ESTIMATED_EXPANDED_SHEET_HEIGHT);
  const snapDefaultSV = useSharedValue(ESTIMATED_DEFAULT_SHEET_HEIGHT);
  const snapCollapsedSV = useSharedValue(ESTIMATED_COLLAPSED_SHEET_HEIGHT);
  const sheetPanActivatedSV = useSharedValue(false);

  const dayMapPreviewBottomSpace = useMemo(
    () => getDayMapPreviewBottomSpace(immersiveLayoutHeight, safeAreaBottom),
    [immersiveLayoutHeight, safeAreaBottom],
  );

  const dayDetailSnapHeights = useMemo<DayDetailSnapHeights>(() => {
    if (immersiveLayoutHeight <= 0) {
      return {
        collapsed: ESTIMATED_COLLAPSED_SHEET_HEIGHT,
        default: ESTIMATED_DEFAULT_SHEET_HEIGHT,
        expanded: ESTIMATED_EXPANDED_SHEET_HEIGHT,
      };
    }

    const ratioCollapsedHeight = Math.min(
      immersiveLayoutHeight * DAY_DETAIL_SHEET_COLLAPSED_MAX_RATIO,
      Math.max(
        DAY_DETAIL_SHEET_COLLAPSED_MIN_HEIGHT,
        immersiveLayoutHeight * DAY_DETAIL_SHEET_COLLAPSED_RATIO,
      ),
    );
    const collapsedHeight = Math.max(
      ratioCollapsedHeight,
      DAY_MAP_PREVIEW_COLLAPSED_STATIC_HEIGHT + dayMapPreviewBottomSpace,
    );
    const defaultHeight = Math.min(
      immersiveLayoutHeight * 0.68,
      Math.max(
        collapsedHeight + 140,
        immersiveLayoutHeight * DAY_DETAIL_SHEET_DEFAULT_RATIO,
      ),
    );
    const expandedHeight = Math.min(
      immersiveLayoutHeight,
      Math.max(
        defaultHeight + 120,
        immersiveLayoutHeight - DAY_DETAIL_SHEET_EXPANDED_TOP_OFFSET,
      ),
    );

    return {
      collapsed: collapsedHeight,
      default: defaultHeight,
      expanded: expandedHeight,
    };
  }, [dayMapPreviewBottomSpace, immersiveLayoutHeight]);

  const dayDetailVisibleSheetHeight =
    dayDetailSnapHeights[dayDetailSheetSnapKey] ?? dayDetailSnapHeights.default;
  const dayDetailVisibleSurfaceHeight = Math.max(
    0,
    dayDetailVisibleSheetHeight - DAY_DETAIL_HANDLE_ZONE_HEIGHT,
  );

  useEffect(() => {
    snapCollapsedSV.value = dayDetailSnapHeights.collapsed;
    snapDefaultSV.value = dayDetailSnapHeights.default;
    snapExpandedSV.value = dayDetailSnapHeights.expanded;
  }, [dayDetailSnapHeights, snapCollapsedSV, snapDefaultSV, snapExpandedSV]);

  const defaultVisibleMapInset = useMemo(() => {
    if (dayDetailSnapHeights.default <= 0) {
      return 220;
    }

    return Math.max(
      140,
      dayDetailSnapHeights.default +
        MAP_STABLE_SHEET_BOTTOM_INSET +
        safeAreaBottom,
    );
  }, [dayDetailSnapHeights.default, safeAreaBottom]);
  const collapsedVisibleMapInset = useMemo(() => {
    if (dayDetailSnapHeights.collapsed <= 0) {
      return defaultVisibleMapInset;
    }

    return Math.max(
      120,
      dayDetailSnapHeights.collapsed +
        MAP_COLLAPSED_EXTRA_BOTTOM_INSET +
        safeAreaBottom,
    );
  }, [dayDetailSnapHeights.collapsed, defaultVisibleMapInset, safeAreaBottom]);
  const activeVisibleMapInset =
    mapFitSnapKey === "collapsed"
      ? collapsedVisibleMapInset
      : defaultVisibleMapInset;
  const immersiveTopBarTop = safeAreaTop + IMMERSIVE_TOP_BAR_TOP_GAP;
  const immersiveMapControlsTop =
    immersiveTopBarTop +
    Math.max(immersiveTopBarHeight, IMMERSIVE_TOP_BAR_ESTIMATED_HEIGHT) +
    IMMERSIVE_MAP_CONTROL_TOP_GAP;
  const isMapPrioritySheet = dayDetailSheetContentMode === "mapPreview";

  const onSnapStarted = useCallback((nextSnapKey: DayDetailSheetSnapKey) => {
    const nextContentMode =
      nextSnapKey === "collapsed" ? "mapPreview" : "timeline";
    setDayDetailSheetSnapKey(nextSnapKey);
    if (nextSnapKey === "collapsed") {
      pendingContentModeRef.current = undefined;
      setDayDetailSheetContentMode("mapPreview");
      return;
    }

    pendingContentModeRef.current = nextContentMode;
  }, []);

  const onSnapSettled = useCallback(
    (settledSnapKey?: DayDetailSheetSnapKey) => {
      const nextContentMode = pendingContentModeRef.current;
      pendingContentModeRef.current = undefined;
      if (nextContentMode) {
        setDayDetailSheetContentMode(nextContentMode);
      }
      if (settledSnapKey) {
        setMapFitSnapKey(settledSnapKey);
      }
      triggerHaptic("light");
    },
    [],
  );

  const animateDayDetailSheetTo = useCallback(
    (
      _nextOffset: number,
      nextSnapKey?: DayDetailSheetSnapKey,
      initialVelocity = 0,
    ) => {
      const targetHeight = nextSnapKey
        ? dayDetailSnapHeights[nextSnapKey]
        : dayDetailSnapHeights[dayDetailSheetSnapKey];

      if (nextSnapKey) {
        onSnapStarted(nextSnapKey);
      }

      const onFinished = (finished?: boolean) => {
        "worklet";
        if (finished) {
          runOnJS(onSnapSettled)(nextSnapKey);
        }
      };

      overlayHeightSV.value = withSpring(
        targetHeight,
        {
          damping: 32,
          mass: 0.78,
          stiffness: 360,
          velocity: initialVelocity,
          overshootClamping: true,
        },
        onFinished,
      );
    },
    [
      dayDetailSnapHeights,
      dayDetailSheetSnapKey,
      onSnapStarted,
      onSnapSettled,
      overlayHeightSV,
    ],
  );

  const isBodyPanEnabled =
    !isDraggingSelectedDayItem && dayDetailSheetSnapKey === "collapsed";
  const isGrabberPanEnabled = !isDraggingSelectedDayItem;

  const createSheetPanGesture = useCallback(
    (enabled: boolean) =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY([-6, 6])
        .failOffsetX([-24, 24])
        .onStart(() => {
          "worklet";
          sheetPanActivatedSV.value = true;
        })
        .onBegin(() => {
          "worklet";
          sheetPanActivatedSV.value = false;
          dragStartSV.value = overlayHeightSV.value;
        })
        .onUpdate((event) => {
          "worklet";
          const rawHeight = dragStartSV.value - event.translationY;
          const snapRange = snapExpandedSV.value - snapCollapsedSV.value;
          let nextHeight = rawHeight;
          if (rawHeight < snapCollapsedSV.value) {
            nextHeight =
              snapCollapsedSV.value -
              getRubberBandDistance(
                snapCollapsedSV.value - rawHeight,
                snapRange,
              );
          } else if (rawHeight > snapExpandedSV.value) {
            nextHeight =
              snapExpandedSV.value +
              getRubberBandDistance(
                rawHeight - snapExpandedSV.value,
                snapRange,
              );
          }
          overlayHeightSV.value = nextHeight;
        })
        .onEnd((event) => {
          "worklet";
          sheetPanActivatedSV.value = false;
          const releaseHeight = Math.max(
            snapCollapsedSV.value,
            Math.min(
              snapExpandedSV.value,
              dragStartSV.value - event.translationY,
            ),
          );
          const snapTargets: { height: number; key: DayDetailSheetSnapKey }[] =
            [
              { height: snapCollapsedSV.value, key: "collapsed" },
              { height: snapDefaultSV.value, key: "default" },
              { height: snapExpandedSV.value, key: "expanded" },
            ];

          let startIndex = 0;
          for (let index = 1; index < snapTargets.length; index += 1) {
            if (
              Math.abs(snapTargets[index].height - dragStartSV.value) <
              Math.abs(snapTargets[startIndex].height - dragStartSV.value)
            ) {
              startIndex = index;
            }
          }

          const heightDelta = releaseHeight - dragStartSV.value;
          const canExpand = startIndex < snapTargets.length - 1;
          const canCollapse = startIndex > 0;
          const nextExpandedDistance = canExpand
            ? snapTargets[startIndex + 1].height -
              snapTargets[startIndex].height
            : 0;
          const nextCollapsedDistance = canCollapse
            ? snapTargets[startIndex].height -
              snapTargets[startIndex - 1].height
            : 0;
          const expandThreshold = Math.max(48, nextExpandedDistance * 0.32);
          const collapseThreshold = Math.max(48, nextCollapsedDistance * 0.32);
          const isFlingingUp = event.velocityY < -900;
          const isFlingingDown = event.velocityY > 900;

          let targetIndex = startIndex;
          if (canExpand && (isFlingingUp || heightDelta > expandThreshold)) {
            targetIndex = startIndex + 1;
          } else if (
            canCollapse &&
            (isFlingingDown || -heightDelta > collapseThreshold)
          ) {
            targetIndex = startIndex - 1;
          }

          const target = snapTargets[targetIndex];
          runOnJS(animateDayDetailSheetTo)(
            target.height,
            target.key,
            -event.velocityY,
          );
        })
        .onFinalize((_event, success) => {
          "worklet";
          const wasActivated = sheetPanActivatedSV.value;
          sheetPanActivatedSV.value = false;
          if (wasActivated && !success) {
            const snapTargets: {
              height: number;
              key: DayDetailSheetSnapKey;
            }[] = [
              { height: snapCollapsedSV.value, key: "collapsed" },
              { height: snapDefaultSV.value, key: "default" },
              { height: snapExpandedSV.value, key: "expanded" },
            ];
            let target = snapTargets[0];
            for (const candidate of snapTargets) {
              if (
                Math.abs(candidate.height - overlayHeightSV.value) <
                Math.abs(target.height - overlayHeightSV.value)
              ) {
                target = candidate;
              }
            }
            runOnJS(animateDayDetailSheetTo)(target.height, target.key);
          }
        }),
    [
      animateDayDetailSheetTo,
      dragStartSV,
      overlayHeightSV,
      sheetPanActivatedSV,
      snapCollapsedSV,
      snapDefaultSV,
      snapExpandedSV,
    ],
  );

  const dayDetailSheetBodyPan = useMemo(
    () => createSheetPanGesture(isBodyPanEnabled),
    [createSheetPanGesture, isBodyPanEnabled],
  );
  const dayDetailSheetGrabberPan = useMemo(
    () => createSheetPanGesture(isGrabberPanEnabled),
    [createSheetPanGesture, isGrabberPanEnabled],
  );

  const sheetStageAnimatedStyle = useAnimatedStyle(() => ({
    height: snapExpandedSV.value,
    transform: [{ translateY: snapExpandedSV.value - overlayHeightSV.value }],
  }));

  const sheetOverlayAnimatedStyle = useAnimatedStyle(() => ({
    height: snapExpandedSV.value,
  }));

  useEffect(() => {
    if (isOverviewSelected) {
      overlayHeightSV.value = dayDetailSnapHeights.collapsed;
      setDayDetailSheetSnapKey("collapsed");
      setMapFitSnapKey("collapsed");
      pendingContentModeRef.current = undefined;
      setDayDetailSheetContentMode("mapPreview");
      return;
    }

    if (immersiveLayoutHeight <= 0) {
      return;
    }

    const returnSnapshot = pendingReturnSnapshotRef.current;
    const savedSnapKey = returnSnapshot?.snapKey ?? "default";
    const targetHeight = dayDetailSnapHeights[savedSnapKey];
    overlayHeightSV.value = targetHeight;
    setDayDetailSheetSnapKey(savedSnapKey);
    setMapFitSnapKey(savedSnapKey);
    pendingContentModeRef.current = undefined;
    setDayDetailSheetContentMode(
      savedSnapKey === "collapsed" ? "mapPreview" : "timeline",
    );
    pendingReturnSnapshotRef.current = undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dayDetailSnapHeights.collapsed,
    dayDetailSnapHeights.default,
    dayDetailSnapHeights.expanded,
    immersiveLayoutHeight,
    isOverviewSelected,
    overlayHeightSV,
    pendingReturnSnapshotRef,
    dayDetailSnapHeights,
  ]);

  return {
    activeVisibleMapInset,
    animateDayDetailSheetTo,
    dayDetailSheetBodyPan,
    dayDetailSheetGrabberPan,
    dayDetailSheetSnapKey,
    dayDetailSnapHeights,
    dayDetailVisibleSurfaceHeight,
    dayMapPreviewBottomSpace,
    immersiveMapControlsTop,
    immersiveTopBarTop,
    isMapPrioritySheet,
    setImmersiveLayoutHeight,
    setImmersiveTopBarHeight,
    sheetOverlayAnimatedStyle,
    sheetStageAnimatedStyle,
  };
}
