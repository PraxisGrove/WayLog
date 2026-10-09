import { Pressable, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import type { TripDayItem } from "@/features/trips";

import type { DayPlanItemStyles } from "./styles";

export function DayPlanItemTags({
  costLabel,
  hasRecordedCost,
  item,
  onCostPress,
  onTimePress,
  styles,
}: {
  costLabel: string;
  hasRecordedCost: boolean;
  item: TripDayItem;
  onCostPress?: (event: GestureResponderEvent) => void;
  onTimePress: (event: GestureResponderEvent) => void;
  styles: DayPlanItemStyles;
}) {
  return (
    <View style={styles.tagRow}>
      <Pressable
        accessibilityLabel={
          item.time ? `时间 ${item.time}，点击修改` : "点击设置时间"
        }
        accessibilityRole="button"
        hitSlop={4}
        onPress={onTimePress}
        style={({ pressed }) => [
          styles.timeTag,
          item.time ? styles.timeTagActive : styles.timeTagEmpty,
          pressed && styles.timeTagPressed,
        ]}
      >
        <Text
          style={[styles.timeTagText, !item.time && styles.timeTagTextEmpty]}
        >
          {item.time ?? "--:--"}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={
          hasRecordedCost ? `${costLabel}，点击修改花费` : "记录花费"
        }
        accessibilityRole="button"
        hitSlop={4}
        onPress={onCostPress}
        style={({ pressed }) => [
          styles.costTag,
          hasRecordedCost ? styles.costTagActive : styles.costTagEmpty,
          pressed && styles.costTagPressed,
        ]}
      >
        <Text
          style={[
            styles.costTagText,
            !hasRecordedCost && styles.costTagTextEmpty,
          ]}
        >
          {costLabel}
        </Text>
      </Pressable>
    </View>
  );
}
