import { resolveDefaultDesignTokens } from "./default-design-tokens";
import { resolveDesignTokens } from "./design-tokens";
import {
  DEFAULT_CLASSIC_PALETTE_ID,
  getClassicPaletteById,
} from "./palettes/classic-palettes";
import { createClassicRecipes } from "./recipes/classic-recipes";
import { createDefaultRecipes } from "./recipes/default-recipes";
import { getThemeDefinition } from "./theme-registry";
import type { ResolvedTheme, ResolveThemeOptions } from "./types";

export function resolveTheme({
  classicPaletteId,
  colorScheme,
  themeId,
}: ResolveThemeOptions): ResolvedTheme {
  const definition = getThemeDefinition(themeId);
  const palette = getClassicPaletteById(
    classicPaletteId ??
      definition.defaultClassicPaletteId ??
      DEFAULT_CLASSIC_PALETTE_ID,
  );
  const tokens = resolveDesignTokens({
    colorScheme,
    palette,
  });

  if (definition.id === "default") {
    const defaultTokens = resolveDefaultDesignTokens({ colorScheme });

    return {
      ...definition,
      classicPalette: palette,
      recipes: createDefaultRecipes(defaultTokens),
      tokens: defaultTokens,
    };
  }

  return {
    ...definition,
    classicPalette: palette,
    recipes: createClassicRecipes(tokens),
    tokens,
  };
}
