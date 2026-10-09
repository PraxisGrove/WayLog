import type { ReactNode } from "react";
import {
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
  getRecipeTextStyle,
  getRecipeViewStyle,
} from "@/shared/ui/recipe-style";

export type AppBadgeTone = keyof ComponentRecipes["badge"];

type AppBadgeProps = {
  children?: ReactNode;
  label?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: AppBadgeTone;
};

export function AppBadge({
  children,
  label,
  style,
  textStyle,
  tone = "info",
}: AppBadgeProps) {
  const theme = useTheme();
  const recipe = theme.recipes.badge[tone];

  return (
    <View style={[styles.badge, getRecipeViewStyle(recipe), style]}>
      {label ? (
        <Text
          style={[
            styles.text,
            getRecipeTextStyle(recipe, theme.tokens.colors.text),
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 0,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
});
