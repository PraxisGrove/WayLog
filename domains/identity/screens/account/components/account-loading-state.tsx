import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileTravelBackground } from "@/shared/account/profile-travel-background";
import { ENABLE_PROFILE_TRAVEL_BACKGROUND } from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { accountScreenStyles as styles } from "../account-screen.styles";
import type { useAccountController } from "../hooks/use-account-controller";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountLoadingState({
  profileBackgroundTone,
}: {
  profileBackgroundTone: AccountController["profileBackgroundTone"];
}) {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: ENABLE_PROFILE_TRAVEL_BACKGROUND
            ? profileBackgroundTone.baseColor
            : theme.colors.background,
        },
      ]}
    >
      {ENABLE_PROFILE_TRAVEL_BACKGROUND ? (
        <ProfileTravelBackground tone={profileBackgroundTone} />
      ) : null}
      <View style={styles.loadingState}>
        <ActivityIndicator color={theme.colors.primary} size="small" />
      </View>
    </SafeAreaView>
  );
}
