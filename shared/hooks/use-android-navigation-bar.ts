import * as NavigationBar from "expo-navigation-bar";
import { useEffect, useRef } from "react";
import { Appearance, Platform } from "react-native";
import {
  type AndroidNavigationBarRequestedStyle,
  resolveAndroidNavigationBarButtonStyle,
} from "@/shared/theme/android-navigation-bar-style";
import { createDiagnosticLogger } from "@/features/diagnostics";
const navigationBarLogger = createDiagnosticLogger("android-navigation-bar");
type AndroidNavigationBarMode = "hidden" | "visible" | "immersive";
type AndroidNavigationBarStyle = AndroidNavigationBarRequestedStyle;

type UseAndroidNavigationBarOptions = {
  mode?: AndroidNavigationBarMode;
  style?: AndroidNavigationBarStyle;
};

type AndroidNavigationBarEntry = {
  mode: AndroidNavigationBarMode;
  style: AndroidNavigationBarStyle;
};

const entries: AndroidNavigationBarEntry[] = [];

function getResolvedEntry(): AndroidNavigationBarEntry {
  const immersiveEntries = entries.filter(
    (entry) => entry.mode === "immersive",
  );
  const activeEntries =
    immersiveEntries.length > 0 ? immersiveEntries : entries;

  return (
    activeEntries[activeEntries.length - 1] ?? {
      mode: "hidden",
      style: "auto",
    }
  );
}

function syncAndroidNavigationBar() {
  if (Platform.OS !== "android") {
    return;
  }

  const nextEntry = getResolvedEntry();
  const shouldHide = nextEntry.mode !== "visible";
  const buttonStyle = resolveAndroidNavigationBarButtonStyle(
    nextEntry.style,
    Appearance.getColorScheme(),
  );

  void Promise.resolve()
    .then(() => NavigationBar.setButtonStyleAsync(buttonStyle))
    .catch((error) => {
      navigationBarLogger.warn(
        "style.update.failed",
        { buttonStyle, error },
        "Failed to update Android navigation bar style",
      );
    });
  void NavigationBar.setVisibilityAsync(
    shouldHide ? "hidden" : "visible",
  ).catch((error) => {
    navigationBarLogger.warn(
      "visibility.update.failed",
      { error, shouldHide },
      "Failed to update Android navigation bar visibility",
    );
  });
}

export function useAndroidNavigationBar({
  mode = "hidden",
  style = "auto",
}: UseAndroidNavigationBarOptions = {}) {
  const entryRef = useRef<AndroidNavigationBarEntry>({
    mode,
    style,
  });

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const entry = entryRef.current;

    entries.push(entry);
    syncAndroidNavigationBar();

    return () => {
      const index = entries.indexOf(entry);

      if (index >= 0) {
        entries.splice(index, 1);
      }

      syncAndroidNavigationBar();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    entryRef.current.mode = mode;
    entryRef.current.style = style;
    syncAndroidNavigationBar();
  }, [mode, style]);
}
