import type {
  ColorSchemePreference,
  ResolvedColorScheme,
} from "./color-scheme";
import {
  darkDesignTokens,
  lightDesignTokens,
  type ResolvedDesignTokens,
  resolveDesignTokens,
} from "./design-tokens";
import type { ClassicPalette } from "./palettes/classic-palettes";

export type ThemePreference = ColorSchemePreference;
export type ResolvedThemeMode = ResolvedColorScheme;
export type AppTheme = ResolvedDesignTokens;

export function createAppTheme(
  mode: ResolvedThemeMode,
  colorConfig: ClassicPalette,
) {
  return resolveDesignTokens({
    colorScheme: mode,
    palette: colorConfig,
  });
}

export const lightTheme = lightDesignTokens;
export const darkTheme = darkDesignTokens;
export const minimalTheme = lightTheme;
export const appTheme = lightTheme;

export const Colors = {
  light: {
    text: lightTheme.colors.text,
    background: lightTheme.colors.background,
    tint: lightTheme.colors.primary,
    icon: lightTheme.colors.textMuted,
    tabIconDefault: lightTheme.colors.textMuted,
    tabIconSelected: lightTheme.colors.primary,
    border: lightTheme.colors.border,
    primary: lightTheme.colors.primary,
    surface: lightTheme.colors.surface,
    link: lightTheme.colors.link,
  },
  dark: {
    text: darkTheme.colors.text,
    background: darkTheme.colors.background,
    tint: darkTheme.colors.primary,
    icon: darkTheme.colors.textMuted,
    tabIconDefault: darkTheme.colors.textMuted,
    tabIconSelected: darkTheme.colors.primary,
    border: darkTheme.colors.border,
    primary: darkTheme.colors.primary,
    surface: darkTheme.colors.surface,
    link: darkTheme.colors.link,
  },
};
