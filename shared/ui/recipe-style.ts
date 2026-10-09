import type { TextStyle, ViewStyle } from "react-native";

import type { ComponentVariantRecipe } from "@/shared/theme/types";

export function getRecipeViewStyle(recipe: ComponentVariantRecipe): ViewStyle {
  return {
    ...(recipe.shadow ?? {}),
    backgroundColor: recipe.backgroundColor,
    borderColor: recipe.borderColor,
    borderRadius: recipe.radius,
    borderWidth: recipe.borderWidth,
    minHeight: recipe.minHeight,
  };
}

export function getRecipeTextStyle(
  recipe: ComponentVariantRecipe,
  fallbackColor: string,
): TextStyle {
  return {
    color: recipe.color ?? fallbackColor,
  };
}

export function getRecipeInputStyle(recipe: ComponentVariantRecipe): TextStyle {
  return {
    backgroundColor: recipe.backgroundColor,
    borderColor: recipe.borderColor,
    borderRadius: recipe.radius,
    borderWidth: recipe.borderWidth,
    minHeight: recipe.minHeight,
  };
}
