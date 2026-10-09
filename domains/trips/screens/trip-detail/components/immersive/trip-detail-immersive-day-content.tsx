import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { default as RAnimated } from "react-native-reanimated";
import type {
  Trip,
  TripDay,
  TripDayItem,
  TripDayRouteSegment,
  TripPlace,
  TripRouteMode,
  TripRouteSegmentResult,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { BackButton } from "@/shared/ui/back-button";
import {
  DAY_MAP_PREVIEW_CARD_GAP,
  DAY_MAP_PREVIEW_CARD_HEIGHT,
} from "../../immersive/constants";
import type { DayDetailSheetSnapKey } from "../../immersive/types";
import type { createStyles } from "../../trip-detail.styles";
import type { TripDetailDayLayoutPreset } from "../../trip-detail-day-layout-preset";
import { DayRouteMap } from "../route-map/day-route-map";
import {
  DayMapPreviewPanel,
  type DayMapPreviewPanelProps,
} from "./day-map-preview-panel";
import {
  ImmersiveDayTimeline,
  type ImmersiveDayTimelineListRef,
  type ImmersiveDayTimelineProps,
} from "./immersive-day-timeline";

type GestureDetectorGesture = ComponentProps<typeof GestureDetector>["gesture"];
type AnimatedViewStyle = ComponentProps<typeof RAnimated.View>["style"];
type MapPreviewPanelProps = Omit<
  DayMapPreviewPanelProps,
  "cardGap" | "cardHeight"
>;

type RouteMapProps = {
  activeStopId?: string;
  activeVisibleMapInset: number;
  immersiveMapControlsTop: number;
  onStopPress: (item: TripDayItem, place?: TripPlace) => void;
  routeSegmentModes: Record<string, TripRouteMode>;
  routeSegmentResults: Record<string, TripRouteSegmentResult>;
  selectedDay: TripDay;
  selectedDayItems: TripDayItem[];
  selectedDaySegments: TripDayRouteSegment[];
};

type SheetLayoutProps = {
  bottomInset: number;
  dayDetailSheetBodyPan: GestureDetectorGesture;
  dayDetailSheetGrabberPan: GestureDetectorGesture;
  dayDetailSheetSnapKey: DayDetailSheetSnapKey;
  dayDetailVisibleSurfaceHeight: number;
  isDraggingSelectedDayItem: boolean;
  isMapPrioritySheet: boolean;
  onLayoutHeightChange: (height: number) => void;
  onMapPreviewCarouselWidthChange: (width: number) => void;
  sheetOverlayAnimatedStyle: AnimatedViewStyle;
  sheetStageAnimatedStyle: AnimatedViewStyle;
};

export type TripDetailImmersiveDayContentProps = {
  actionError?: string;
  dayMapPreviewHeaderContent: ReactNode;
  dayTabsContent: ReactNode;
  isDayRouteLoading: boolean;
  layoutPreset: TripDetailDayLayoutPreset;
  layout: SheetLayoutProps;
  mapPreviewPanelProps: MapPreviewPanelProps;
  onBackPress: () => void;
  onOverviewPress: () => void;
  onTopBarLayout: (event: LayoutChangeEvent) => void;
  routeMap: RouteMapProps;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  timelineProps: ImmersiveDayTimelineProps;
  timelineRef: RefObject<ImmersiveDayTimelineListRef | null>;
  topBarTop: number;
  trip: Trip;
};

export function TripDetailImmersiveDayContent({
  actionError,
  dayMapPreviewHeaderContent,
  dayTabsContent,
  isDayRouteLoading,
  layoutPreset,
  layout,
  mapPreviewPanelProps,
  onBackPress,
  onOverviewPress,
  onTopBarLayout,
  routeMap,
  styles,
  theme,
  timelineProps,
  timelineRef,
  topBarTop,
  trip,
}: TripDetailImmersiveDayContentProps) {
  const shouldShowMapPreviewPanel =
    layoutPreset.sheetContentMode === "auto"
      ? layout.isMapPrioritySheet
      : layoutPreset.sheetContentMode === "mapPreview";
  const shouldUseMapPrioritySpacing =
    layout.isMapPrioritySheet && shouldShowMapPreviewPanel;

  return (
    <View
      onLayout={(event) =>
        layout.onLayoutHeightChange(event.nativeEvent.layout.height)
      }
      style={styles.immersiveScreen}
    >
      <View pointerEvents="box-none" style={styles.immersiveMapLayer}>
        <View style={styles.immersiveMapTouchLayer}>
          <DayRouteMap
            activeStopId={routeMap.activeStopId}
            day={routeMap.selectedDay}
            fitBottomInset={routeMap.activeVisibleMapInset}
            immersive
            immersiveControlsTop={routeMap.immersiveMapControlsTop}
            isLoading={isDayRouteLoading}
            items={routeMap.selectedDayItems}
            onStopPress={routeMap.onStopPress}
            results={routeMap.routeSegmentResults}
            selectedModes={routeMap.routeSegmentModes}
            segments={routeMap.selectedDaySegments}
            style={styles.immersiveMap}
            trip={trip}
          />
        </View>

        <View
          onLayout={onTopBarLayout}
          pointerEvents="box-none"
          style={[styles.immersiveTopBar, { top: topBarTop }]}
        >
          <View style={styles.immersiveTopBarLeft}>
            <BackButton
              accessibilityLabel="返回行程列表"
              onPress={onBackPress}
            />
            {isDayRouteLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : null}
          </View>
          <Pressable
            accessibilityHint="切换到行程总览页"
            accessibilityLabel="回到行程总览"
            accessibilityRole="button"
            onPress={onOverviewPress}
            style={({ pressed }) => [
              styles.immersiveOverviewReturnButton,
              pressed && [
                styles.overviewReturnButtonPressed,
                { backgroundColor: theme.colors.primarySoft },
              ],
            ]}
          >
            <Text style={styles.overviewReturnText}>回到总览</Text>
          </Pressable>
        </View>

        {actionError ? (
          <View style={styles.immersiveInlineError}>
            <Text style={styles.inlineErrorText}>{actionError}</Text>
          </View>
        ) : null}
      </View>

      <RAnimated.View
        collapsable={false}
        pointerEvents="auto"
        style={[styles.dayDetailSheetStage, layout.sheetStageAnimatedStyle]}
      >
        <RAnimated.View
          style={[
            styles.dayDetailSheetOverlay,
            layout.sheetOverlayAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={layout.dayDetailSheetGrabberPan}>
            <View style={styles.dayDetailHandleZone}>
              <View style={styles.dayFloatingGrabber} />
            </View>
          </GestureDetector>
          <GestureDetector gesture={layout.dayDetailSheetBodyPan}>
            <View
              onLayout={(event) =>
                layout.onMapPreviewCarouselWidthChange(
                  Math.max(0, event.nativeEvent.layout.width - 32),
                )
              }
              style={[
                styles.immersiveSheetSurface,
                {
                  height: layout.dayDetailVisibleSurfaceHeight,
                  maxHeight: layout.dayDetailVisibleSurfaceHeight,
                },
                {
                  paddingBottom: shouldUseMapPrioritySpacing
                    ? 0
                    : Math.max(12, layout.bottomInset + 6),
                },
              ]}
            >
              <View style={styles.immersiveSheetHeaderBlock}>
                {shouldShowMapPreviewPanel ? dayMapPreviewHeaderContent : null}
                {dayTabsContent}
              </View>

              {shouldShowMapPreviewPanel ? (
                <DayMapPreviewPanel
                  {...mapPreviewPanelProps}
                  cardGap={DAY_MAP_PREVIEW_CARD_GAP}
                  cardHeight={DAY_MAP_PREVIEW_CARD_HEIGHT}
                />
              ) : (
                <ImmersiveDayTimeline ref={timelineRef} {...timelineProps} />
              )}
            </View>
          </GestureDetector>
        </RAnimated.View>
      </RAnimated.View>
    </View>
  );
}
