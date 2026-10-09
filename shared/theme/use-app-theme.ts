import { createContext, useContext } from "react";
import {
  type AppIconPatternId,
  DEFAULT_APP_ICON_PATTERN,
} from "@/features/appearance/app-icon";
import { resolveTheme } from "./resolve-theme";
import { resolveSkinSlots } from "./skin-slot-registry";
import type {
  ResolvedSkinSlots,
  SkinSlotAdapterId,
  SkinSlotId,
  SkinSlotOverrides,
} from "./skin-slot-types";
import {
  type AppTheme,
  lightTheme,
  type ResolvedThemeMode,
  type ThemePreference,
} from "./theme";
import { DEFAULT_THEME_COLOR_ID } from "./theme-colors";
import { DEFAULT_THEME_ID } from "./theme-registry";
import type {
  HomeLayoutPresetId,
  HomeLayoutPresetPreference,
  ResolvedTheme,
  ShellTabBarPresetId,
  ShellTabBarPresetPreference,
  ThemeId,
  TripDetailLayoutPresetId,
  TripDetailLayoutPresetPreference,
} from "./types";

type AppThemeContextValue = {
  appIconPattern: AppIconPatternId;
  homeLayoutPresetPreference: HomeLayoutPresetPreference;
  isLoaded: boolean;
  resolvedHomeLayoutPreset: HomeLayoutPresetId;
  resolvedSkinSlots: ResolvedSkinSlots;
  resolvedThemeMode: ResolvedThemeMode;
  resolvedTheme: ResolvedTheme;
  resolvedShellTabBarPreset: ShellTabBarPresetId;
  resolvedTripDetailLayoutPreset: TripDetailLayoutPresetId;
  resetSkinSlotOverride: (slotId: SkinSlotId) => void;
  setAppIconPattern: (pattern: AppIconPatternId) => Promise<boolean>;
  setHomeLayoutPresetPreference: (
    preference: HomeLayoutPresetPreference,
  ) => void;
  setShellTabBarPresetPreference: (
    preference: ShellTabBarPresetPreference,
  ) => void;
  setSkinSlotOverride: (
    slotId: SkinSlotId,
    adapterId: SkinSlotAdapterId,
  ) => void;
  setThemeColor: (colorId: string) => Promise<boolean>;
  setThemeId: (themeId: ThemeId) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setTripDetailLayoutPresetPreference: (
    preference: TripDetailLayoutPresetPreference,
  ) => void;
  shellTabBarPresetPreference: ShellTabBarPresetPreference;
  theme: AppTheme;
  themeColorId: string;
  themeId: ThemeId;
  themePreference: ThemePreference;
  slotOverrides: SkinSlotOverrides;
  tripDetailLayoutPresetPreference: TripDetailLayoutPresetPreference;
};

const defaultResolvedTheme = resolveTheme({
  classicPaletteId: DEFAULT_THEME_COLOR_ID,
  colorScheme: "light",
  themeId: DEFAULT_THEME_ID,
});
const defaultResolvedSkinSlots = resolveSkinSlots(defaultResolvedTheme, {});

export const AppThemeContext = createContext<AppThemeContextValue>({
  appIconPattern: DEFAULT_APP_ICON_PATTERN,
  homeLayoutPresetPreference: "themeDefault",
  isLoaded: false,
  resolvedHomeLayoutPreset: defaultResolvedTheme.defaultHomeLayoutPreset,
  resolvedSkinSlots: defaultResolvedSkinSlots,
  resolvedThemeMode: "light",
  resolvedTheme: defaultResolvedTheme,
  resolvedShellTabBarPreset: defaultResolvedTheme.shell.tabBarPreset,
  resolvedTripDetailLayoutPreset: defaultResolvedTheme.detail.layoutPreset,
  resetSkinSlotOverride: () => undefined,
  setAppIconPattern: async () => false,
  setHomeLayoutPresetPreference: () => undefined,
  setShellTabBarPresetPreference: () => undefined,
  setSkinSlotOverride: () => undefined,
  setThemeColor: async () => false,
  setThemeId: () => undefined,
  setThemePreference: () => undefined,
  setTripDetailLayoutPresetPreference: () => undefined,
  shellTabBarPresetPreference: "themeDefault",
  theme: lightTheme,
  themeColorId: DEFAULT_THEME_COLOR_ID,
  themeId: DEFAULT_THEME_ID,
  themePreference: "system",
  slotOverrides: {},
  tripDetailLayoutPresetPreference: "themeDefault",
});

export function useAppTheme() {
  return useContext(AppThemeContext).theme;
}

export function useResolvedTheme() {
  return useContext(AppThemeContext).resolvedTheme;
}

export function useTheme() {
  return useContext(AppThemeContext).resolvedTheme;
}

export function useThemePreference() {
  const { isLoaded, resolvedThemeMode, setThemePreference, themePreference } =
    useContext(AppThemeContext);

  return {
    isLoaded,
    resolvedThemeMode,
    setThemePreference,
    themePreference,
  };
}

export function useThemeColor() {
  const { themeColorId, setThemeColor } = useContext(AppThemeContext);

  return {
    themeColorId,
    setThemeColor,
  };
}

export function useThemeId() {
  const { setThemeId, themeId } = useContext(AppThemeContext);

  return {
    setThemeId,
    themeId,
  };
}

export function useShellTabBarPreset() {
  const {
    resolvedShellTabBarPreset,
    setShellTabBarPresetPreference,
    shellTabBarPresetPreference,
  } = useContext(AppThemeContext);

  return {
    resolvedShellTabBarPreset,
    setShellTabBarPresetPreference,
    shellTabBarPresetPreference,
  };
}

export function useHomeLayoutPreset() {
  const {
    homeLayoutPresetPreference,
    resolvedHomeLayoutPreset,
    setHomeLayoutPresetPreference,
  } = useContext(AppThemeContext);

  return {
    homeLayoutPresetPreference,
    resolvedHomeLayoutPreset,
    setHomeLayoutPresetPreference,
  };
}

export function useTripDetailLayoutPreset() {
  const {
    resolvedTripDetailLayoutPreset,
    setTripDetailLayoutPresetPreference,
    tripDetailLayoutPresetPreference,
  } = useContext(AppThemeContext);

  return {
    resolvedTripDetailLayoutPreset,
    setTripDetailLayoutPresetPreference,
    tripDetailLayoutPresetPreference,
  };
}

export function useSkinSlots() {
  const {
    resetSkinSlotOverride,
    resolvedSkinSlots,
    setSkinSlotOverride,
    slotOverrides,
  } = useContext(AppThemeContext);

  return {
    resetSkinSlotOverride,
    resolvedSkinSlots,
    setSkinSlotOverride,
    slotOverrides,
  };
}

export function useSkinSlot(slotId: SkinSlotId) {
  return useContext(AppThemeContext).resolvedSkinSlots[slotId];
}

export function useAppIconPreference() {
  const { appIconPattern, setAppIconPattern } = useContext(AppThemeContext);

  return {
    appIconPattern,
    setAppIconPattern,
  };
}
