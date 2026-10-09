import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text } from "react-native";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";

type BottomActionButtonProps = {
  accessibilityExpanded?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  isActive?: boolean;
  label: string;
  onPress?: () => void;
  styles: ReturnType<typeof createPlaceDetailStyles>;
};
export function BottomActionButton({
  accessibilityExpanded,
  icon,
  isActive,
  label,
  onPress,
  styles,
}: BottomActionButtonProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={
        accessibilityExpanded === undefined
          ? undefined
          : { expanded: accessibilityExpanded }
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.bottomActionButton,
        isActive && styles.bottomActionButtonActive,
        pressed && styles.bottomActionButtonPressed,
      ]}
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={isActive ? theme.colors.primary : theme.colors.text}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.bottomActionText,
          isActive && styles.bottomActionTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
