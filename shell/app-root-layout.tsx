import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { handleAuthInvalidated } from "@/features/auth/session-lifecycle";
import { getCurrentAuthUser } from "@/features/auth/storage";
import { addAuthInvalidatedListener } from "@/features/auth/supabase";
import { initWechat } from "@/features/auth/wechat";
import {
  configureDiagnosticUser,
  createDiagnosticLogger,
  initializePersistentAppLogger,
} from "@/features/diagnostics";
import { useAndroidNavigationBar } from "@/shared/hooks/use-android-navigation-bar";
import { useMultiDeviceSync } from "@/shared/hooks/use-multi-device-sync";
import { AppThemeProvider } from "@/shared/theme/app-theme-provider";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { useAuthSessionGuard } from "@/shell/hooks/use-auth-session-guard";
import { StartupSplashAnimation } from "@/shell/startup-splash-animation";

const appRootLogger = createDiagnosticLogger("app-root");

export function AppRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StartupSplashAnimation>
        <AppThemeProvider>
          <RootNavigation />
        </AppThemeProvider>
      </StartupSplashAnimation>
    </GestureHandlerRootView>
  );
}

function RootNavigation() {
  const theme = useAppTheme();
  const navigationTheme = theme.mode === "dark" ? DarkTheme : DefaultTheme;
  const systemBarStyle = theme.mode === "dark" ? "light" : "dark";

  useAndroidNavigationBar({
    mode: "hidden",
    style: systemBarStyle,
  });

  useMultiDeviceSync();

  useAuthSessionGuard();

  useEffect(() => {
    void initializePersistentAppLogger();
    void getCurrentAuthUser()
      .then(configureDiagnosticUser)
      .catch((error) => {
        appRootLogger.warn(
          "diagnostics.user.configure.failed",
          { error },
          "Failed to attach current user to diagnostics",
        );
      });

    const wechatAppId = process.env.EXPO_PUBLIC_WECHAT_APP_ID;
    if (wechatAppId) {
      initWechat(wechatAppId).catch((err) => {
        appRootLogger.error(
          "wechat.init.failed",
          { error: err },
          "Failed to initialize Wechat during app startup",
        );
      });
    }

    const unsubscribe = addAuthInvalidatedListener(() => {
      void handleAuthInvalidated();
    });

    return unsubscribe;
  }, []);

  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          background: theme.colors.background,
          border: theme.colors.border,
          card: theme.colors.surface,
          notification: theme.colors.primary,
          primary: theme.colors.primary,
          text: theme.colors.text,
        },
      }}
    >
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="account"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="about"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="appearance"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="feedback"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="preferences"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="privacy"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="agent"
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="search"
          options={{ headerShown: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="trips/new"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="trips/import"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="trips/favorite-place"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="trips/favorite-places"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="trips/edit"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="trips/[id]"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="trips/place"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Stack>
      <StatusBar
        backgroundColor="transparent"
        style={systemBarStyle}
        translucent
      />
    </ThemeProvider>
  );
}
