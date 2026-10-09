import { classicThemeDefinition } from "./themes/classic";
import { defaultThemeDefinition } from "./themes/default";
import type { ThemeDefinition, ThemeId } from "./types";

export const DEFAULT_THEME_ID: ThemeId = "default";

export const THEME_DEFINITIONS: ThemeDefinition[] = [
  defaultThemeDefinition,
  classicThemeDefinition,
];

export function getThemeDefinition(themeId: string): ThemeDefinition {
  return (
    THEME_DEFINITIONS.find((definition) => definition.id === themeId) ??
    defaultThemeDefinition
  );
}

export function isThemeId(themeId: string | null): themeId is ThemeId {
  return THEME_DEFINITIONS.some((definition) => definition.id === themeId);
}
