import type { ThemeId } from "./types";
import { DEFAULT_THEME_ID, isThemeId } from "./theme-registry";

export function resolveStoredThemeId(storedThemeId: string | null): ThemeId {
  return isThemeId(storedThemeId) ? storedThemeId : DEFAULT_THEME_ID;
}

export function resolveSelectedThemeId(nextThemeId: ThemeId): ThemeId {
  return nextThemeId;
}
