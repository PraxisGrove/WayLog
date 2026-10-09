import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileTravelBackground } from "@/shared/account/profile-travel-background";
import { ENABLE_PROFILE_TRAVEL_BACKGROUND } from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ScreenHeader } from "@/shared/ui/screen-header";

import { accountScreenStyles as styles } from "./account-screen.styles";
import { AccountAuthMethods } from "./components/account-auth-methods";
import { AccountDangerZone } from "./components/account-danger-zone";
import { AccountDialogHost } from "./components/account-dialog-host";
import { AccountEmptyState } from "./components/account-empty-state";
import { AccountLoadingState } from "./components/account-loading-state";
import { AccountPasswordSection } from "./components/account-password-section";
import { AccountProfileCard } from "./components/account-profile-card";
import { AccountStatusBanner } from "./components/account-status-banner";
import { useAccountController } from "./hooks/use-account-controller";

export function AccountScreen() {
  const theme = useAppTheme();
  const controller = useAccountController();

  if (controller.isLoading) {
    return (
      <AccountLoadingState
        profileBackgroundTone={controller.profileBackgroundTone}
      />
    );
  }

  if (!controller.authUser) {
    return (
      <AccountEmptyState
        onBack={controller.handleBack}
        onLoginPress={controller.handleBack}
        profileBackgroundTone={controller.profileBackgroundTone}
      />
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: ENABLE_PROFILE_TRAVEL_BACKGROUND
            ? controller.profileBackgroundTone.baseColor
            : theme.colors.background,
        },
      ]}
    >
      {ENABLE_PROFILE_TRAVEL_BACKGROUND ? (
        <ProfileTravelBackground tone={controller.profileBackgroundTone} />
      ) : null}
      <KeyboardAvoidingView style={styles.keyboardRoot}>
        <ScreenHeader
          onBack={controller.handleBack}
          style={styles.standaloneHeader}
          title="账号与安全"
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AccountProfileCard
            authUser={controller.authUser}
            avatarImageTransform={controller.avatarImageTransform}
            avatarImageUri={controller.avatarImageUri}
            primaryIdentityMeta={controller.primaryIdentityMeta}
          />

          <AccountStatusBanner
            message={controller.statusMessage}
            profileGlassTone={controller.profileGlassTone}
            toneColors={controller.toneColors}
          />

          <View style={styles.settingSectionStack}>
            <AccountAuthMethods
              bindingRows={controller.bindingRows}
              onBindingPress={controller.handleBindingPress}
              profileGlassTone={controller.profileGlassTone}
            />

            <AccountPasswordSection
              isBusy={controller.isBusy}
              isPasswordEditorVisible={controller.isPasswordEditorVisible}
              onCancelPasswordEdit={controller.handleCancelPasswordEdit}
              onPasswordPress={controller.handlePasswordPress}
              onSavePassword={controller.handleSavePassword}
              passwordConfirmValue={controller.passwordConfirmValue}
              passwordState={controller.passwordState}
              passwordValue={controller.passwordValue}
              profileGlassTone={controller.profileGlassTone}
              setPasswordConfirmValue={controller.setPasswordConfirmValue}
              setPasswordValue={controller.setPasswordValue}
            />

            <AccountDangerZone
              onDeleteAccountPress={controller.handleDeleteAccountPress}
              onSignOutPress={controller.openSignOutConfirm}
              profileGlassTone={controller.profileGlassTone}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AccountDialogHost controller={controller} />
    </SafeAreaView>
  );
}
