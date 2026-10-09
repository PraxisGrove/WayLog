import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, useColorScheme } from "react-native";
import {
  type AppIconPatternId,
  DEFAULT_APP_ICON_PATTERN,
  normalizeAppIconPatternId,
} from "@/features/appearance/app-icon";
import {
  applyAppIcon,
  isAppIconSwitchingSupported,
} from "@/features/appearance/app-icon-native";
import { isColorSchemePreference, resolveColorScheme } from "./color-scheme";
import { resolveTheme } from "./resolve-theme";
import {
  canOverrideSkinSlot,
  getSkinSlotAdapter,
  parseSkinSlotOverrides,
  resolveSkinSlots,
} from "./skin-slot-registry";
import type {
  SkinSlotAdapterId,
  SkinSlotId,
  SkinSlotOverrides,
} from "./skin-slot-types";
import type { ResolvedThemeMode, ThemePreference } from "./theme";
import { DEFAULT_THEME_COLOR_ID } from "./theme-colors";
import { DEFAULT_THEME_ID, getThemeDefinition } from "./theme-registry";
import {
  resolveSelectedThemeId,
  resolveStoredThemeId,
} from "./theme-selection";
import type {
  HomeLayoutPresetPreference,
  ShellTabBarPresetPreference,
  ThemeId,
  TripDetailLayoutPresetPreference,
} from "./types";
import { AppThemeContext } from "./use-app-theme";
import { createDiagnosticLogger } from "@/features/diagnostics";
const appThemeProviderLogger = createDiagnosticLogger("app-theme-provider");
const THEME_PREFERENCE_STORAGE_KEY = "waylog.themePreference.v1";

const THEME_COLOR_STORAGE_KEY = "waylog.themeColor.v1";

const THEME_ID_STORAGE_KEY = "waylog.themeId.v1";

const SHELL_TAB_BAR_PRESET_STORAGE_KEY = "waylog.shellTabBarPreset.v1";

const HOME_LAYOUT_PRESET_STORAGE_KEY = "waylog.homeLayoutPreset.v1";

const TRIP_DETAIL_LAYOUT_PRESET_STORAGE_KEY =
  "waylog.tripDetailLayoutPreset.v1";

const APP_ICON_PATTERN_STORAGE_KEY = "waylog.appIconPattern.v1";

const SKIN_SLOT_OVERRIDES_STORAGE_KEY = "waylog.skinSlotOverrides.v1";

const IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED = true;

function isShellTabBarPresetPreference(
  value: string | null,
): value is ShellTabBarPresetPreference {
  return (
    value === "themeDefault" || value === "centerAdd" || value === "rightFab"
  );
}

function isHomeLayoutPresetPreference(
  value: string | null,
): value is HomeLayoutPresetPreference {
  return (
    value === "themeDefault" ||
    value === "simpleList" ||
    value === "todayFirst" ||
    value === "dashboard"
  );
}

function isTripDetailLayoutPresetPreference(
  value: string | null,
): value is TripDetailLayoutPresetPreference {
  return (
    value === "themeDefault" ||
    value === "standard" ||
    value === "itineraryFirst" ||
    value === "journalFirst"
  );
}

async function syncAppIcon(themeColorId: string, pattern: AppIconPatternId) {
  try {
    return await applyAppIcon(themeColorId, pattern);
  } catch (error) {
    appThemeProviderLogger.warn(
      "legacy.warn",
      { args: ["Failed to update app icon.", error] },
      "Legacy warning captured",
    );
    return false;
  }
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [isLoaded, setLoaded] = useState(false);
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [shellTabBarPresetPreference, setShellTabBarPresetPreferenceState] =
    useState<ShellTabBarPresetPreference>("themeDefault");
  const [homeLayoutPresetPreference, setHomeLayoutPresetPreferenceState] =
    useState<HomeLayoutPresetPreference>("themeDefault");
  const [
    tripDetailLayoutPresetPreference,
    setTripDetailLayoutPresetPreferenceState,
  ] = useState<TripDetailLayoutPresetPreference>("themeDefault");
  const [themeColorId, setThemeColorIdState] = useState<string>(
    DEFAULT_THEME_COLOR_ID,
  );
  const [appIconPattern, setAppIconPatternState] = useState<AppIconPatternId>(
    DEFAULT_APP_ICON_PATTERN,
  );
  const [slotOverrides, setSlotOverridesState] = useState<SkinSlotOverrides>(
    {},
  );
  const latestIconPreferenceRef = useRef({
    pattern: DEFAULT_APP_ICON_PATTERN,
    themeColorId: DEFAULT_THEME_COLOR_ID,
  });
  const hasPendingAppIconChangeRef = useRef(false);

  const resolvedThemeMode: ResolvedThemeMode = resolveColorScheme(
    themePreference,
    systemColorScheme,
  );
  const resolvedTheme = useMemo(
    () =>
      resolveTheme({
        classicPaletteId: themeColorId,
        colorScheme: resolvedThemeMode,
        themeId,
      }),
    [resolvedThemeMode, themeColorId, themeId],
  );
  const theme = resolvedTheme.tokens;
  const resolvedShellTabBarPreset =
    shellTabBarPresetPreference === "themeDefault"
      ? resolvedTheme.shell.tabBarPreset
      : shellTabBarPresetPreference;
  const resolvedHomeLayoutPreset =
    homeLayoutPresetPreference === "themeDefault"
      ? resolvedTheme.defaultHomeLayoutPreset
      : homeLayoutPresetPreference;
  const resolvedTripDetailLayoutPreset =
    tripDetailLayoutPresetPreference === "themeDefault"
      ? resolvedTheme.detail.layoutPreset
      : tripDetailLayoutPresetPreference;
  const resolvedSkinSlots = useMemo(
    () => resolveSkinSlots(resolvedTheme, slotOverrides),
    [resolvedTheme, slotOverrides],
  );

  useEffect(() => {
    let isActive = true;

    const loadPreferences = async () => {
      try {
        const [
          storedPreference,
          storedColorId,
          storedThemeId,
          storedShellTabBarPreset,
          storedHomeLayoutPreset,
          storedTripDetailLayoutPreset,
          storedIconPattern,
          storedSlotOverrides,
        ] = await Promise.all([
          AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
          AsyncStorage.getItem(THEME_COLOR_STORAGE_KEY),
          AsyncStorage.getItem(THEME_ID_STORAGE_KEY),
          AsyncStorage.getItem(SHELL_TAB_BAR_PRESET_STORAGE_KEY),
          AsyncStorage.getItem(HOME_LAYOUT_PRESET_STORAGE_KEY),
          AsyncStorage.getItem(TRIP_DETAIL_LAYOUT_PRESET_STORAGE_KEY),
          AsyncStorage.getItem(APP_ICON_PATTERN_STORAGE_KEY),
          AsyncStorage.getItem(SKIN_SLOT_OVERRIDES_STORAGE_KEY),
        ]);

        const nextThemeColorId = storedColorId || DEFAULT_THEME_COLOR_ID;
        const nextThemeId = resolveStoredThemeId(storedThemeId);
        const nextThemeDefinition = getThemeDefinition(nextThemeId);
        const nextSlotOverrides = IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED
          ? {}
          : parseSkinSlotOverrides(storedSlotOverrides, nextThemeDefinition);
        const nextIconPattern =
          normalizeAppIconPatternId(storedIconPattern) ??
          DEFAULT_APP_ICON_PATTERN;

        if (isActive) {
          if (isColorSchemePreference(storedPreference)) {
            setThemePreferenceState(storedPreference);
          }
          if (
            !IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED &&
            isShellTabBarPresetPreference(storedShellTabBarPreset)
          ) {
            setShellTabBarPresetPreferenceState(storedShellTabBarPreset);
          }
          if (
            !IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED &&
            isHomeLayoutPresetPreference(storedHomeLayoutPreset)
          ) {
            setHomeLayoutPresetPreferenceState(storedHomeLayoutPreset);
          }
          if (
            !IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED &&
            isTripDetailLayoutPresetPreference(storedTripDetailLayoutPreset)
          ) {
            setTripDetailLayoutPresetPreferenceState(
              storedTripDetailLayoutPreset,
            );
          }
          setThemeIdState(nextThemeId);
          setThemeColorIdState(nextThemeColorId);
          setAppIconPatternState(nextIconPattern);
          setSlotOverridesState(nextSlotOverrides);
          latestIconPreferenceRef.current = {
            pattern: nextIconPattern,
            themeColorId: nextThemeColorId,
          };
          hasPendingAppIconChangeRef.current = Boolean(
            storedColorId || storedIconPattern,
          );
        }
      } catch (error) {
        appThemeProviderLogger.warn(
          "legacy.warn",
          { args: ["Failed to load theme preferences.", error] },
          "Legacy warning captured",
        );
      } finally {
        if (isActive) {
          setLoaded(true);
        }
      }
    };

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(
      (error) => {
        appThemeProviderLogger.warn(
          "legacy.warn",
          { args: ["Failed to update system UI background color.", error] },
          "Legacy warning captured",
        );
      },
    );
  }, [theme.colors.background]);

  const applyPendingAppIconChange = useCallback(() => {
    if (!hasPendingAppIconChangeRef.current) {
      return;
    }

    hasPendingAppIconChangeRef.current = false;
    const nextIconPreference = latestIconPreferenceRef.current;
    void syncAppIcon(
      nextIconPreference.themeColorId,
      nextIconPreference.pattern,
    );
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        applyPendingAppIconChange();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [applyPendingAppIconChange]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);

    AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference).catch(
      (error) => {
        appThemeProviderLogger.warn(
          "legacy.warn",
          { args: ["Failed to save theme preference.", error] },
          "Legacy warning captured",
        );
      },
    );
  }, []);

  const setThemeId = useCallback((nextThemeId: ThemeId) => {
    const resolvedThemeId = resolveSelectedThemeId(nextThemeId);

    setThemeIdState(resolvedThemeId);

    AsyncStorage.setItem(THEME_ID_STORAGE_KEY, resolvedThemeId).catch(
      (error) => {
        appThemeProviderLogger.warn(
          "legacy.warn",
          { args: ["Failed to save theme id.", error] },
          "Legacy warning captured",
        );
      },
    );
  }, []);

  const setShellTabBarPresetPreference = useCallback(
    (preference: ShellTabBarPresetPreference) => {
      if (IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED) {
        setShellTabBarPresetPreferenceState("themeDefault");
        return;
      }

      setShellTabBarPresetPreferenceState(preference);

      AsyncStorage.setItem(SHELL_TAB_BAR_PRESET_STORAGE_KEY, preference).catch(
        (error) => {
          appThemeProviderLogger.warn(
            "legacy.warn",
            {
              args: ["Failed to save shell tab bar preset preference.", error],
            },
            "Legacy warning captured",
          );
        },
      );
    },
    [],
  );

  const setHomeLayoutPresetPreference = useCallback(
    (preference: HomeLayoutPresetPreference) => {
      if (IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED) {
        setHomeLayoutPresetPreferenceState("themeDefault");
        return;
      }

      setHomeLayoutPresetPreferenceState(preference);

      AsyncStorage.setItem(HOME_LAYOUT_PRESET_STORAGE_KEY, preference).catch(
        (error) => {
          appThemeProviderLogger.warn(
            "legacy.warn",
            { args: ["Failed to save home layout preset preference.", error] },
            "Legacy warning captured",
          );
        },
      );
    },
    [],
  );

  const setTripDetailLayoutPresetPreference = useCallback(
    (preference: TripDetailLayoutPresetPreference) => {
      if (IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED) {
        setTripDetailLayoutPresetPreferenceState("themeDefault");
        return;
      }

      setTripDetailLayoutPresetPreferenceState(preference);

      AsyncStorage.setItem(
        TRIP_DETAIL_LAYOUT_PRESET_STORAGE_KEY,
        preference,
      ).catch((error) => {
        appThemeProviderLogger.warn(
          "legacy.warn",
          {
            args: [
              "Failed to save trip detail layout preset preference.",
              error,
            ],
          },
          "Legacy warning captured",
        );
      });
    },
    [],
  );

  const setThemeColor = useCallback(
    async (colorId: string) => {
      setThemeColorIdState(colorId);
      latestIconPreferenceRef.current = {
        pattern: appIconPattern,
        themeColorId: colorId,
      };
      hasPendingAppIconChangeRef.current = true;

      AsyncStorage.setItem(THEME_COLOR_STORAGE_KEY, colorId).catch((error) => {
        appThemeProviderLogger.warn(
          "legacy.warn",
          { args: ["Failed to save theme color.", error] },
          "Legacy warning captured",
        );
      });
      return isAppIconSwitchingSupported();
    },
    [appIconPattern],
  );

  const setAppIconPattern = useCallback(
    async (pattern: AppIconPatternId) => {
      setAppIconPatternState(pattern);
      latestIconPreferenceRef.current = {
        pattern,
        themeColorId,
      };
      hasPendingAppIconChangeRef.current = true;

      AsyncStorage.setItem(APP_ICON_PATTERN_STORAGE_KEY, pattern).catch(
        (error) => {
          appThemeProviderLogger.warn(
            "legacy.warn",
            { args: ["Failed to save app icon pattern.", error] },
            "Legacy warning captured",
          );
        },
      );
      return isAppIconSwitchingSupported();
    },
    [themeColorId],
  );

  const persistSlotOverrides = useCallback(
    (nextSlotOverrides: SkinSlotOverrides) => {
      AsyncStorage.setItem(
        SKIN_SLOT_OVERRIDES_STORAGE_KEY,
        JSON.stringify(nextSlotOverrides),
      ).catch((error) => {
        appThemeProviderLogger.warn(
          "legacy.warn",
          { args: ["Failed to save skin slot overrides.", error] },
          "Legacy warning captured",
        );
      });
    },
    [],
  );

  const setSkinSlotOverride = useCallback(
    (slotId: SkinSlotId, adapterId: SkinSlotAdapterId) => {
      if (IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED) {
        return;
      }

      if (
        !canOverrideSkinSlot(resolvedTheme, slotId) ||
        !getSkinSlotAdapter(slotId, adapterId)
      ) {
        return;
      }

      setSlotOverridesState((current) => {
        const nextSlotOverrides = {
          ...current,
          [slotId]: adapterId,
        };

        persistSlotOverrides(nextSlotOverrides);

        return nextSlotOverrides;
      });
    },
    [persistSlotOverrides, resolvedTheme],
  );

  const resetSkinSlotOverride = useCallback(
    (slotId: SkinSlotId) => {
      if (IS_DEFAULT_PROTOTYPE_CUSTOMIZATION_LOCKED) {
        return;
      }

      setSlotOverridesState((current) => {
        if (!current[slotId]) {
          return current;
        }

        const nextSlotOverrides = {
          ...current,
        };

        delete nextSlotOverrides[slotId];
        persistSlotOverrides(nextSlotOverrides);

        return nextSlotOverrides;
      });
    },
    [persistSlotOverrides],
  );

  const value = useMemo(
    () => ({
      appIconPattern,
      homeLayoutPresetPreference,
      isLoaded,
      resolvedHomeLayoutPreset,
      resolvedThemeMode,
      resolvedTheme,
      resolvedSkinSlots,
      resolvedShellTabBarPreset,
      resolvedTripDetailLayoutPreset,
      resetSkinSlotOverride,
      setAppIconPattern,
      setHomeLayoutPresetPreference,
      setShellTabBarPresetPreference,
      setSkinSlotOverride,
      setTripDetailLayoutPresetPreference,
      setThemeId,
      setThemePreference,
      setThemeColor,
      shellTabBarPresetPreference,
      theme,
      themeColorId,
      themeId,
      themePreference,
      slotOverrides,
      tripDetailLayoutPresetPreference,
    }),
    [
      appIconPattern,
      homeLayoutPresetPreference,
      isLoaded,
      resolvedHomeLayoutPreset,
      resolvedThemeMode,
      resolvedTheme,
      resolvedSkinSlots,
      resolvedShellTabBarPreset,
      resolvedTripDetailLayoutPreset,
      resetSkinSlotOverride,
      setAppIconPattern,
      setHomeLayoutPresetPreference,
      setShellTabBarPresetPreference,
      setSkinSlotOverride,
      setTripDetailLayoutPresetPreference,
      setThemeId,
      setThemeColor,
      setThemePreference,
      shellTabBarPresetPreference,
      theme,
      themeColorId,
      themeId,
      themePreference,
      slotOverrides,
      tripDetailLayoutPresetPreference,
    ],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}
