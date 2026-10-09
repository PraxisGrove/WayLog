import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { getTripStatusColors, type TripStatus } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type StatusBadgeProps = {
  label?: string;
  status: TripStatus;
  style?: StyleProp<ViewStyle>;
};

export function StatusBadge({ label, status, style }: StatusBadgeProps) {
  const theme = useAppTheme();
  const colors = getTripStatusColors(status, theme.colors.status);

  return (
    <View
      accessibilityLabel={`当前状态：${label ?? status}`}
      style={[
        styles.badge,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.md - 2,
          paddingVertical: theme.spacing.xs + 1,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.color }]}>
        {label ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 64,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});
