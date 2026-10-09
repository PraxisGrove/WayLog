import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import type {
  Trip,
  TripDay,
  TripDayItem,
  TripDayRouteSegment,
  TripPlace,
  TripRouteMode,
  TripRouteSegmentResult,
} from "@/features/trips";
import type { TripWeatherOverview } from "@/features/weather";

export type ImmersiveDayTimelineListRef = {
  scrollTo: (options: { animated?: boolean; y: number }) => void;
  scrollToIndex: (options: { animated?: boolean; index: number }) => void;
};

export type DraggedDayItemState = {
  dayId: string;
  itemId: string;
  offsetY: number;
};

export type ImmersiveDayTimelineProps = {
  allDaySegments: Record<string, TripDayRouteSegment[]>;
  collapsedDayIds: Record<string, boolean>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  draggedDayItem?: DraggedDayItemState;
  footerHeight: number;
  getDayItemReorderOffset: (itemId: string, itemIndex: number) => number;
  keyboardShouldPersistTaps?: "always" | "handled" | "never";
  onAddPlace: (dayId: string) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onDayItemDelete: (dayId: string, itemId: string) => void;
  onDayTitleEdit: (dayId: string) => void;
  onDayItemDragEnd: () => void;
  onDayItemDragMove: (dayId: string, itemId: string, offsetY: number) => void;
  onDayItemDragStart: (
    dayId: string,
    itemId: string,
    itemIndex: number,
  ) => void;
  onDayItemEdit: (dayId: string, itemId: string) => void;
  onDayItemInteractionStart: (dayId: string) => void;
  onDayItemLayout: (itemId: string, event: LayoutChangeEvent) => void;
  onDayItemPress: (
    item: TripDayItem,
    place: TripPlace | undefined,
    dayId: string,
  ) => void;
  onDayItemTimePress: (
    dayId: string,
    itemId: string,
    currentTime?: string,
  ) => void;
  onExpensePress: (day: TripDay, item: TripDayItem, place?: TripPlace) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onRouteSegmentPress: (dayId: string, segment: TripDayRouteSegment) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSectionLayout: (dayId: string, event: LayoutChangeEvent) => void;
  onToggleDaySection: (dayId: string) => void;
  onVisibleDayChange: (dayIds: string[]) => void;
  routeModePendingCounts: Record<string, number>;
  routeModePendingIntents: Record<string, boolean>;
  routeSegmentModes: Record<string, TripRouteMode | undefined>;
  routeSegmentResults: Record<string, TripRouteSegmentResult>;
  scrollEnabled: boolean;
  selectedDayId: string;
  style?: StyleProp<ViewStyle>;
  trip: Trip;
  tripWeather?: TripWeatherOverview;
};

export type DayTimelineSectionProps = {
  allDaySegments: Record<string, TripDayRouteSegment[]>;
  collapsedDayIds: Record<string, boolean>;
  day: TripDay;
  draggedDayItem?: DraggedDayItemState;
  getDayItemReorderOffset: (itemId: string, itemIndex: number) => number;
  isActive: boolean;
  onAddPlace: (dayId: string) => void;
  onDayItemDelete: (dayId: string, itemId: string) => void;
  onDayTitleEdit: (dayId: string) => void;
  onDayItemDragEnd: () => void;
  onDayItemDragMove: (dayId: string, itemId: string, offsetY: number) => void;
  onDayItemDragStart: (
    dayId: string,
    itemId: string,
    itemIndex: number,
  ) => void;
  onDayItemEdit: (dayId: string, itemId: string) => void;
  onDayItemInteractionStart: (dayId: string) => void;
  onDayItemLayout: (itemId: string, event: LayoutChangeEvent) => void;
  onDayItemPress: (
    item: TripDayItem,
    place: TripPlace | undefined,
    dayId: string,
  ) => void;
  onDayItemTimePress: (
    dayId: string,
    itemId: string,
    currentTime?: string,
  ) => void;
  onExpensePress: (day: TripDay, item: TripDayItem, place?: TripPlace) => void;
  onRouteSegmentPress: (dayId: string, segment: TripDayRouteSegment) => void;
  onSectionLayout: (dayId: string, event: LayoutChangeEvent) => void;
  onToggleDaySection: (dayId: string) => void;
  routeModePendingCounts: Record<string, number>;
  routeModePendingIntents: Record<string, boolean>;
  routeSegmentModes: Record<string, TripRouteMode | undefined>;
  routeSegmentResults: Record<string, TripRouteSegmentResult>;
  trip: Trip;
  tripWeather?: TripWeatherOverview;
};
