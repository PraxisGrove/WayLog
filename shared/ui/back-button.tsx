import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

type BackButtonProps = {
  accessibilityLabel?: string;
  iconSize?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({
  accessibilityLabel = "返回",
  iconSize = 24,
  onPress,
  style,
}: BackButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && { opacity: 0.62 },
        style,
      ]}
    >
      <MaterialIcons
        name="chevron-left"
        size={iconSize}
        color={theme.colors.textMuted}
      />
    </Pressable>
  );
}

export const BACK_BUTTON_SIDE_WIDTH = 36;

const styles = StyleSheet.create({
  base: {
    width: BACK_BUTTON_SIDE_WIDTH,
    height: BACK_BUTTON_SIDE_WIDTH,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BACK_BUTTON_SIDE_WIDTH / 2,
  },
});
