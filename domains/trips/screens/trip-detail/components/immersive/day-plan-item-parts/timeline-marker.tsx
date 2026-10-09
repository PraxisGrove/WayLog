import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import type { TripDayItem } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { DayPlanItemStyles } from "./styles";
import type { TimelineItemStatus } from "./types";

export function DayPlanTimelineMarker({
  item,
  onTimePress,
  styles,
  timeStatus,
}: {
  item: TripDayItem;
  onTimePress: (event: GestureResponderEvent) => void;
  styles: DayPlanItemStyles;
  timeStatus?: TimelineItemStatus;
}) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={
        item.time ? `时间 ${item.time}，点击修改` : "点击设置时间"
      }
      accessibilityRole="button"
      hitSlop={8}
      onPress={onTimePress ? (e) => onTimePress(e) : undefined}
      style={styles.timelineCol}
    >
      {item.time && timeStatus === "completed" ? (
        <View style={styles.timelineDotCompleted}>
          <MaterialIcons name="check" size={8} color={theme.colors.onPrimary} />
        </View>
      ) : item.time && timeStatus === "current" ? (
        <View style={styles.timelineDotCurrentContainer}>
          <View style={styles.timelineDotCurrent} />
        </View>
      ) : (
        <View style={styles.timelineDot} />
      )}
    </Pressable>
  );
}
