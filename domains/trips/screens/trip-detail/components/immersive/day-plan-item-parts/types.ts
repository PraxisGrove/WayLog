import type { GestureResponderEvent } from "react-native";
import type { TripDayItem, TripPlace } from "@/features/trips";

export type TimelineItemStatus = "completed" | "current" | "upcoming";

export type DayPlanItemProps = {
  accessibilityHint?: string;
  dragEnabled?: boolean;
  dragOffsetY?: number;
  isDragging?: boolean;
  item: TripDayItem;
  onDelete?: () => void;
  onDragEnd?: () => void;
  onDragMove?: (offsetY: number) => void;
  onDragStart?: () => void;
  onEdit?: () => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onLongPress?: () => void;
  onCostPress?: (event: GestureResponderEvent) => void;
  onPress: () => void;
  onTimePress: (event: GestureResponderEvent) => void;
  place?: TripPlace;
  reorderOffsetY?: number;
  swipeActionsEnabled?: boolean;
  timeStatus?: TimelineItemStatus;
};
