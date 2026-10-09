import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Animated, Pressable, Text } from "react-native";
import type { TripDayItem } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";

import type { DayPlanItemStyles } from "./styles";

export function DayPlanSwipeActions({
  closeSwipeable,
  item,
  onDelete,
  onEdit,
  progress,
  styles,
}: {
  closeSwipeable: () => void;
  item: TripDayItem;
  onDelete?: () => void;
  onEdit?: () => void;
  progress: Animated.AnimatedInterpolation<number>;
  styles: DayPlanItemStyles;
}) {
  const theme = useAppTheme();
  const actionAnimatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0, 0.45, 1],
      extrapolate: "clamp",
    }),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
          extrapolate: "clamp",
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
          extrapolate: "clamp",
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.swipeActions, actionAnimatedStyle]}>
      {onEdit ? (
        <Pressable
          accessibilityLabel={`编辑${item.title}`}
          accessibilityRole="button"
          onPress={() => {
            triggerHaptic("light");
            closeSwipeable();
            onEdit();
          }}
          style={({ pressed }) => [
            styles.swipeAction,
            styles.editAction,
            pressed && styles.swipeActionPressed,
          ]}
        >
          <MaterialIcons name="edit" size={19} color={theme.colors.link} />
          <Text style={styles.swipeActionText}>编辑</Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          accessibilityLabel={`删除${item.title}`}
          accessibilityRole="button"
          onPress={() => {
            triggerHaptic("heavy");
            closeSwipeable();
            onDelete();
          }}
          style={({ pressed }) => [
            styles.swipeAction,
            styles.deleteAction,
            pressed && styles.swipeActionPressed,
          ]}
        >
          <MaterialIcons
            name="delete-outline"
            size={19}
            color={theme.colors.danger}
          />
          <Text style={[styles.swipeActionText, styles.deleteActionText]}>
            删除
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
