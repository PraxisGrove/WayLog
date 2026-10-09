import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileTravelBackground } from "@/shared/account/profile-travel-background";
import { ENABLE_PROFILE_TRAVEL_BACKGROUND } from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { EmptyState } from "@/shared/ui/empty-state";
import { ScreenHeader } from "@/shared/ui/screen-header";

import { accountScreenStyles as styles } from "../account-screen.styles";
import type { useAccountController } from "../hooks/use-account-controller";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountEmptyState({
  onBack,
  onLoginPress,
  profileBackgroundTone,
}: {
  onBack: () => void;
  onLoginPress: () => void;
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
      <ScreenHeader
        onBack={onBack}
        style={styles.standaloneHeader}
        title="账号与安全"
      />
      <View style={styles.emptyStateWrap}>
        <EmptyState
          actionLabel="去登录"
          description="先登录，才能管理登录方式和密码"
          icon="lock-outline"
          onActionPress={onLoginPress}
          title="暂无可管理的账号"
        />
      </View>
    </SafeAreaView>
  );
}
