import type { ReactNode } from "react";
import {
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
import { getRecipeViewStyle } from "@/shared/ui/recipe-style";

export type AppListRowVariant = keyof ComponentRecipes["listRow"];

type AppListRowProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  description?: string;
  disabled?: boolean;
  leading?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
  variant?: AppListRowVariant;
};

export function AppListRow({
  accessibilityHint,
  accessibilityLabel,
  description,
  disabled = false,
  leading,
  onPress,
  style,
  subtitleStyle,
  title,
  titleStyle,
  trailing,
  variant = onPress ? "navigation" : "default",
}: AppListRowProps) {
  const theme = useTheme();
  const recipe = theme.recipes.listRow[variant];
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            { color: theme.tokens.colors.text },
            titleStyle,
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            numberOfLines={2}
            style={[
              styles.description,
              { color: theme.tokens.colors.textMuted },
              subtitleStyle,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled }}
        style={[
          styles.row,
          getRecipeViewStyle(recipe),
          disabled ? styles.disabled : null,
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        getRecipeViewStyle(recipe),
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  description: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.52,
  },
  leading: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.78,
  },
  row: {
    minWidth: 0,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  trailing: {
    flexShrink: 0,
  },
});
