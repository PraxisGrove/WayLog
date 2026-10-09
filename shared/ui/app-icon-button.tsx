import type { ReactNode } from "react";
import {
  type GestureResponderEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import {
  getDisabledStateStyle,
  getPressedStateStyle,
} from "@/shared/ui/interaction-state";
import { getRecipeViewStyle } from "@/shared/ui/recipe-style";

export type AppIconButtonVariant = keyof ComponentRecipes["button"];

type AppIconButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  variant?: AppIconButtonVariant;
};

export function AppIconButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  size = 42,
  style,
  variant = "ghost",
}: AppIconButtonProps) {
  const theme = useTheme();
  const recipe = theme.recipes.button[variant];

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        getRecipeViewStyle(recipe),
        {
          width: size,
          height: size,
          minHeight: size,
          borderRadius: recipe.radius ?? Math.round(size / 2),
        },
        pressed && !disabled ? getPressedStateStyle({ scale: 0.96 }) : null,
        disabled ? getDisabledStateStyle() : null,
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
});
