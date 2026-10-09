import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileTravelBackground } from "@/shared/account/profile-travel-background";
import {
  ENABLE_PROFILE_TRAVEL_BACKGROUND,
  type getProfileGlassSurface,
  getProfileTravelPaperBackground,
} from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ScreenContent } from "@/shared/ui/screen-content";
import { ScreenHeader } from "@/shared/ui/screen-header";

export type SettingsGlassTone = ReturnType<typeof getProfileGlassSurface>;

export function getSettingsGlassCardStyle(tone: SettingsGlassTone) {
  return {
    backgroundColor:
      Platform.OS === "android"
        ? tone.androidCardBackgroundColor
        : tone.cardBackgroundColor,
    borderColor: tone.cardBorderColor,
  };
}

export function SettingsPageShell({
  children,
  keyboardAvoiding = false,
  onBack,
  title,
}: PropsWithChildren<{
  keyboardAvoiding?: boolean;
  onBack: () => void;
  title: string;
}>) {
  const theme = useAppTheme();
  const backgroundTone = getProfileTravelPaperBackground(theme);
  const pageContent = (
    <>
      <ScreenContent>
        <ScreenHeader onBack={onBack} title={title} />
      </ScreenContent>
      {children}
    </>
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: ENABLE_PROFILE_TRAVEL_BACKGROUND
            ? backgroundTone.baseColor
            : theme.colors.background,
        },
      ]}
    >
      {ENABLE_PROFILE_TRAVEL_BACKGROUND ? (
        <ProfileTravelBackground tone={backgroundTone} />
      ) : null}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.contentRoot}
        >
          {pageContent}
        </KeyboardAvoidingView>
      ) : (
        pageContent
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contentRoot: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
