import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import { getRecipeViewStyle } from "@/shared/ui/recipe-style";

export type AppCardVariant = keyof ComponentRecipes["card"];

type AppCardProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: AppCardVariant;
};

export function AppCard({
  children,
  style,
  variant = "default",
}: AppCardProps) {
  const theme = useTheme();
  const recipe = theme.recipes.card[variant];

  return (
    <View style={[styles.card, getRecipeViewStyle(recipe), style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0,
    overflow: "hidden",
  },
});
