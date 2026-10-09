import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import Reanimated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { DayPlanItemStyles } from "./styles";

export function RecommendationReason({
  isExpanded,
  onToggle,
  reason,
  styles,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  reason: string;
  styles: DayPlanItemStyles;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.reasonBox}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [
          styles.reasonToggle,
          pressed && styles.reasonTogglePressed,
        ]}
      >
        <Text style={styles.reasonToggleText}>
          {isExpanded ? "收起推荐理由" : "查看推荐理由"}
        </Text>
        <MaterialIcons
          color={theme.colors.primary}
          name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={16}
        />
      </Pressable>
      {isExpanded ? (
        <Reanimated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutUp.duration(150)}
        >
          <Text style={styles.reasonText}>{reason}</Text>
        </Reanimated.View>
      ) : null}
    </View>
  );
}
