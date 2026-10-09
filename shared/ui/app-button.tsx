import type { ReactNode } from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import {
  getDisabledStateStyle,
  getPressedStateStyle,
} from "@/shared/ui/interaction-state";
import {
  getRecipeTextStyle,
  getRecipeViewStyle,
} from "@/shared/ui/recipe-style";

export type AppButtonVariant = keyof ComponentRecipes["button"];

type AppButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  title?: string;
  variant?: AppButtonVariant;
};

export function AppButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled = false,
  icon,
  loading = false,
  onPress,
  style,
  textStyle,
  title,
  variant = "primary",
}: AppButtonProps) {
  const theme = useTheme();
  const recipe = theme.recipes.button[variant];
  const isDisabled = disabled || loading;
  const contentColor = recipe.color ?? theme.tokens.colors.text;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        getRecipeViewStyle(recipe),
        pressed && !isDisabled ? getPressedStateStyle() : null,
        isDisabled ? getDisabledStateStyle() : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={contentColor} size="small" /> : icon}
      {title ? (
        <Text
          style={[
            styles.label,
            getRecipeTextStyle(recipe, theme.tokens.colors.text),
            textStyle,
          ]}
        >
          {title}
        </Text>
      ) : null}
      {children ? <View style={styles.customContent}>{children}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  customContent: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
});
