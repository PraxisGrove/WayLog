import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import { getRecipeViewStyle } from "@/shared/ui/recipe-style";

export type AppSurfaceVariant = keyof ComponentRecipes["surface"];

type AppSurfaceProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: AppSurfaceVariant;
};

export function AppSurface({
  children,
  style,
  variant = "default",
}: AppSurfaceProps) {
  const theme = useTheme();
  const recipe = theme.recipes.surface[variant];

  return (
    <View style={[styles.surface, getRecipeViewStyle(recipe), style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    minWidth: 0,
  },
});
