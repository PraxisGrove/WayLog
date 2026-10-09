import { useFocusEffect } from "@react-navigation/native";
import { type Href, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type CurrentAuthUser,
  dismissPasswordSetupPrompt,
  getCurrentAuthUser,
  hasGuestIdentityRecord,
  isManagedProfileAvatarUrl,
  isUploadableProfileAvatarSource,
  normalizeProfileAvatarImageUri,
  type ProfileLoginStatusTone,
  profileLoginInputWebFocusStyle,
  removeProfileAvatar,
  setCurrentUserPassword,
  shouldPromptGuestDataMigration,
  updateCurrentUserProfile,
  uploadProfileAvatar,
} from "@/features/auth";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  clearLocalFavoritePlaceData,
  clearLocalTripChecklistTemplatePreference,
  clearLocalTripData,
  clearLocalTripExpensePreference,
  clearLocalTripRoutePreference,
  hasLocalGuestFavoritePlaceData,
  hasLocalGuestTripChecklistTemplatePreferenceData,
  hasLocalGuestTripData,
  hasLocalGuestTripExpensePreferenceData,
  hasLocalGuestTripRoutePreferenceData,
  syncFavoritePlacesWithCloud,
  syncTripChecklistTemplatePreferenceWithCloud,
  syncTripExpensePreferenceWithCloud,
  syncTripRoutePreferenceWithCloud,
  syncTripsWithCloud,
} from "@/features/trips";
import { ProfileTravelBackground } from "@/shared/account/profile-travel-background";
import {
  ENABLE_PROFILE_TRAVEL_BACKGROUND,
  getProfileGlassSurface,
  getProfileTravelPaperBackground,
} from "@/shared/account/profile-visuals";
import {
  useAppTheme,
  useSkinSlot,
  useTheme,
  useThemePreference,
} from "@/shared/theme/use-app-theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { IdentityOtpModal } from "../../components/identity-otp-modal";
import { PasswordSetupPromptModal } from "./components/password-setup-prompt-modal";
import { ProfileAvatarCropModal } from "./components/profile-avatar-crop-modal";
import { ProfileEditorModal } from "./components/profile-editor-modal";
import { ProfileLoginPanel } from "./components/profile-login-panel";
import { ProfileMenuDrawer } from "./components/profile-menu-drawer";
import { ProfilePostLoginContent } from "./components/profile-post-login-content";
import type { ProfileQuickActionRoute } from "./components/profile-quick-action-card";
import { useProfileAuthGate } from "./hooks/use-profile-auth-gate";
import { useProfileAvatarCropController } from "./hooks/use-profile-avatar-crop-controller";
import { useProfileLoginController } from "./hooks/use-profile-login-controller";
import { useProfileSummary } from "./hooks/use-profile-summary";
import { resolveProfileLayoutPreset } from "./profile-layout-preset";
import { createProfileScreenStyles } from "./styles/profile-screen.styles";
import type { PendingGuestMigration } from "./types";

const profileScreenLogger = createDiagnosticLogger("profile-screen");
const appIconSource = require("@/assets/images/waylog-label/waylog-logo-mark-trimmed.png");
const appIconShadesSource = require("@/assets/images/waylog-label/waylog-logo-round-shades.png");
const defaultLoginStatusMessage =
  "输入邮箱或手机号获取验证码，登录成功后自动创建账号。";

export function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const resolvedTheme = useTheme();
  const profileCardSlot = useSkinSlot("profile.profileCard");
  const profileLayout = useMemo(
    () => resolveProfileLayoutPreset(resolvedTheme.profile.layoutPreset),
    [resolvedTheme.profile.layoutPreset],
  );
  const styles = useMemo(() => createProfileScreenStyles(theme), [theme]);
  const { resolvedThemeMode } = useThemePreference();
  const insets = useSafeAreaInsets();

  const [authUser, setAuthUser] = useState<CurrentAuthUser | null>(null);
  const [hasLoadedProfileData, setHasLoadedProfileData] = useState(false);
  const { refreshProfileSummary, refreshProfileSummaryFromLocal, summary } =
    useProfileSummary();
  const { width: windowWidth } = useWindowDimensions();
  const quickActionBarHeight =
    profileLayout.quickActionDensity === "compact"
      ? Math.round(Math.min(92, Math.max(84, windowWidth * 0.2)))
      : Math.round(Math.min(104, Math.max(96, windowWidth * 0.24)));
  const isCompactQuickActionBar = quickActionBarHeight <= 98;

  const [passwordSetupValue, setPasswordSetupValue] = useState("");
  const [passwordSetupConfirm, setPasswordSetupConfirm] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isEditingProfile, setEditingProfile] = useState(false);
  const [isProfileMenuVisible, setProfileMenuVisible] = useState(false);

  const [statusMessage, setStatusMessageState] = useState(
    defaultLoginStatusMessage,
  );
  const [, setStatusMessageTick] = useState(0);
  const [loginStatusTone, setLoginStatusTone] =
    useState<ProfileLoginStatusTone>("info");
  const [isBusy, setIsBusy] = useState(false);
  const setStatusMessage = useCallback((nextStatusMessage: string) => {
    setStatusMessageState(nextStatusMessage);
    setStatusMessageTick((value) => value + 1);
  }, []);
  const [pendingGuestMigration, setPendingGuestMigration] =
    useState<PendingGuestMigration | null>(null);

  const {
    profileSaveHint,
    profileVisibility,
    shouldShowLoginPanel,
    shouldShowPostLoginContent,
    shouldShowPasswordSetupPrompt,
    shouldShowPostLoginBackground,
    signedInUser,
  } = useProfileAuthGate({
    authUser,
    hasLoadedProfileData,
  });
  const profileBackgroundTone = useMemo(
    () => getProfileTravelPaperBackground(theme),
    [theme],
  );
  const profileGlassTone = useMemo(
    () => getProfileGlassSurface(theme),
    [theme],
  );
  const resolvedThemeLabel = `${theme.name} · ${resolvedThemeMode === "dark" ? "深色" : "浅色"}`;
  const {
    avatarCropGesture,
    avatarImageTransform,
    avatarImageUri,
    avatarOffsetX,
    avatarOffsetY,
    avatarScale,
    handleAvatarCropZoomStep,
    handleAvatarCropZoomTrack,
    handleConfirmAvatarCrop,
    handlePickAvatar,
    handleRemoveProfileAvatar,
    handleResetAvatarCrop,
    handleRotateAvatarCrop,
    hasUploadedAvatar,
    isCroppingAvatar,
    pendingAvatarCrop,
    pendingAvatarDisplay,
    pendingAvatarTransform,
    pendingAvatarZoomProgress,
    setAvatarCropZoomTrackWidth,
    setPendingAvatarCrop,
    syncAvatarDraft,
  } = useProfileAvatarCropController({
    authUser,
    setStatusMessage,
  });

  const syncProfileDraft = useCallback(
    (nextAuthUser: CurrentAuthUser | null) => {
      setAuthUser(nextAuthUser);
      setDisplayName(nextAuthUser?.user.displayName ?? "");
      syncAvatarDraft(nextAuthUser);
      setBio(nextAuthUser?.user.bio ?? "");
    },
    [syncAvatarDraft],
  );

  const syncCloudDataForSignedInUser = useCallback(async () => {
    await Promise.all([
      syncTripsWithCloud(),
      syncFavoritePlacesWithCloud(),
      syncTripExpensePreferenceWithCloud(),
      syncTripRoutePreferenceWithCloud(),
      syncTripChecklistTemplatePreferenceWithCloud(),
    ]);
  }, []);

  const shouldPromptForLocalGuestMigration = useCallback(
    async (nextAuthUser: CurrentAuthUser) => {
      if (!nextAuthUser.session.accessToken) {
        return false;
      }

      const [
        hasGuestIdentity,
        hasGuestTrips,
        hasGuestFavorites,
        hasGuestRoutePreference,
        hasGuestExpensePreference,
        hasGuestChecklistTemplates,
      ] = await Promise.all([
        hasGuestIdentityRecord(),
        hasLocalGuestTripData(),
        hasLocalGuestFavoritePlaceData(),
        hasLocalGuestTripRoutePreferenceData(),
        hasLocalGuestTripExpensePreferenceData(),
        hasLocalGuestTripChecklistTemplatePreferenceData(),
      ]);

      if (!hasGuestIdentity) {
        return false;
      }

      return (
        shouldPromptGuestDataMigration(authUser, nextAuthUser) ||
        hasGuestTrips ||
        hasGuestFavorites ||
        hasGuestRoutePreference ||
        hasGuestExpensePreference ||
        hasGuestChecklistTemplates
      );
    },
    [authUser],
  );

  const loadProfileData = useCallback(async () => {
    try {
      const nextAuthUser = await getCurrentAuthUser();
      syncProfileDraft(nextAuthUser);
      await refreshProfileSummary(nextAuthUser);
    } catch (loadError) {
      profileScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to load profile data.", loadError] },
        "Legacy warning captured",
      );
    } finally {
      setHasLoadedProfileData(true);
    }
  }, [refreshProfileSummary, syncProfileDraft]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

  const runAuthAction = async (
    action: () => Promise<CurrentAuthUser | undefined>,
    successMessage: string,
  ) => {
    setIsBusy(true);
    setLoginStatusTone("info");

    try {
      const nextAuthUser = await action();

      if (nextAuthUser) {
        syncProfileDraft(nextAuthUser);
        setEditingProfile(false);
        setPasswordSetupValue("");
        setPasswordSetupConfirm("");

        if (await shouldPromptForLocalGuestMigration(nextAuthUser)) {
          setPendingGuestMigration({ nextAuthUser, successMessage });
          await refreshProfileSummaryFromLocal(nextAuthUser);
          setLoginStatusTone("info");
          setStatusMessage("请选择是否将本机游客数据迁移到当前账号。");
          return;
        }

        await syncCloudDataForSignedInUser();
        await refreshProfileSummary(nextAuthUser);
      } else {
        setPendingGuestMigration(null);
        syncProfileDraft(null);
        await refreshProfileSummary(null);
      }

      setLoginStatusTone("success");
      setStatusMessage(successMessage);
    } catch (error) {
      setLoginStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "操作失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const { isLoginMascotCoveringEyes, loginPanelProps, smsOtpModalProps } =
    useProfileLoginController({
      defaultLoginStatusMessage,
      isBusy,
      loginStatusTone,
      onSmsModalLoginSuccess: async (nextAuthUser) => {
        syncProfileDraft(nextAuthUser);
        await refreshProfileSummary(nextAuthUser);
      },
      runAuthAction,
      setIsBusy,
      setLoginStatusTone,
      setStatusMessage,
      statusMessage,
    });
  const loginMascotSource = isLoginMascotCoveringEyes
    ? appIconShadesSource
    : appIconSource;

  const finalizeGuestMigration = async (
    nextAuthUser: CurrentAuthUser,
    successMessage: string,
  ) => {
    setPendingGuestMigration(null);
    await refreshProfileSummary(nextAuthUser);
    setLoginStatusTone("success");
    setStatusMessage(successMessage);
  };

  const handleConfirmGuestMigration = async () => {
    if (!pendingGuestMigration) {
      return;
    }

    setIsBusy(true);
    setLoginStatusTone("info");

    try {
      await syncCloudDataForSignedInUser();
      await finalizeGuestMigration(
        pendingGuestMigration.nextAuthUser,
        pendingGuestMigration.successMessage,
      );
    } catch (error) {
      setLoginStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "操作失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSkipGuestMigration = async () => {
    if (!pendingGuestMigration) {
      return;
    }

    setIsBusy(true);
    setLoginStatusTone("info");

    try {
      await Promise.all([
        clearLocalTripData(),
        clearLocalFavoritePlaceData(),
        clearLocalTripChecklistTemplatePreference(),
        clearLocalTripExpensePreference(),
        clearLocalTripRoutePreference(),
      ]);
      await syncCloudDataForSignedInUser();
      await finalizeGuestMigration(
        pendingGuestMigration.nextAuthUser,
        "已跳过迁移，本机游客数据不会上传到当前账号。",
      );
    } catch (error) {
      setLoginStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "操作失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveProfile = () => {
    void runAuthAction(async () => {
      if (!authUser) {
        throw new Error("当前账号状态不可用，请重新登录");
      }

      const accessToken = authUser.session.accessToken;
      const previousAvatarUrl = normalizeProfileAvatarImageUri(
        authUser.user.avatarUrl,
      );
      let nextAvatarUrl = avatarImageUri;

      if (accessToken && isUploadableProfileAvatarSource(nextAvatarUrl)) {
        nextAvatarUrl = await uploadProfileAvatar({
          accessToken,
          sourceUri: nextAvatarUrl,
          userId: authUser.user.id,
        });
      }

      const nextAuthUser = await updateCurrentUserProfile({
        avatarUrl: nextAvatarUrl,
        avatarOffsetX,
        avatarOffsetY,
        avatarScale,
        bio,
        displayName,
      });

      if (
        accessToken &&
        !nextAvatarUrl &&
        isManagedProfileAvatarUrl(previousAvatarUrl)
      ) {
        removeProfileAvatar({
          accessToken,
          userId: authUser.user.id,
        }).catch((error) => {
          profileScreenLogger.warn(
            "legacy.warn",
            { args: ["Failed to remove profile avatar from Storage.", error] },
            "Legacy warning captured",
          );
        });
      }

      return nextAuthUser;
    }, "个人信息已保存");
  };

  const handleOpenProfileEditor = () => {
    syncProfileDraft(authUser);
    setLoginStatusTone("info");
    setStatusMessage(defaultLoginStatusMessage);
    setEditingProfile(true);
  };

  const handleCloseProfileEditor = () => {
    if (isBusy) {
      return;
    }

    syncProfileDraft(authUser);
    setEditingProfile(false);
  };

  const handleSetPassword = async () => {
    if (passwordSetupValue !== passwordSetupConfirm) {
      setLoginStatusTone("error");
      setStatusMessage("两次输入的密码不一致");
      return;
    }

    await runAuthAction(
      () => setCurrentUserPassword(passwordSetupValue),
      "密码已设置，下次可以直接用邮箱/手机号和密码登录",
    );
  };

  const handleDismissPasswordSetupPrompt = async () => {
    setIsBusy(true);

    try {
      syncProfileDraft(await dismissPasswordSetupPrompt());
      setPasswordSetupValue("");
      setPasswordSetupConfirm("");
      setLoginStatusTone("info");
      setStatusMessage("你也可以继续使用邮箱验证码登录");
    } catch (error) {
      setLoginStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "操作失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenFeedback = async () => {
    router.push("/feedback");
  };

  const handleProfileMenuNavigate = (
    route:
      | "about"
      | "account"
      | "appearance"
      | "feedback"
      | "preferences"
      | "reminders",
  ) => {
    setProfileMenuVisible(false);

    if (route === "appearance") {
      router.push("/appearance");
      return;
    }

    if (route === "account") {
      router.push("/account");
      return;
    }

    if (route === "preferences") {
      router.push("/preferences");
      return;
    }

    if (route === "about") {
      router.push("/about");
      return;
    }

    if (route === "feedback") {
      void handleOpenFeedback();
    }
  };

  const handleProfileQuickActionNavigate = (route: ProfileQuickActionRoute) => {
    if (route === "favoritePlaces") {
      router.push("/trips/favorite-places");
    }
  };

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor:
            ENABLE_PROFILE_TRAVEL_BACKGROUND && shouldShowPostLoginBackground
              ? profileBackgroundTone.baseColor
              : theme.colors.background,
        },
      ]}
    >
      {ENABLE_PROFILE_TRAVEL_BACKGROUND && shouldShowPostLoginBackground ? (
        <ProfileTravelBackground tone={profileBackgroundTone} />
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: 144 + insets.bottom,
            paddingTop: Math.max(8, insets.top + 8),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {authUser && shouldShowPostLoginContent ? (
          <ProfilePostLoginContent
            authUser={authUser}
            avatarImageTransform={avatarImageTransform}
            avatarImageUri={avatarImageUri}
            hasUploadedAvatar={hasUploadedAvatar}
            isCompactQuickActionBar={isCompactQuickActionBar}
            onEditProfile={handleOpenProfileEditor}
            onNavigateQuickAction={handleProfileQuickActionNavigate}
            onOpenMenu={() => setProfileMenuVisible(true)}
            profileGlassTone={profileGlassTone}
            profileSkinAdapterId={profileCardSlot.adapterId}
            quickActionBarHeight={quickActionBarHeight}
            stats={summary}
            styles={styles}
            theme={theme}
          />
        ) : null}

        {shouldShowLoginPanel ? (
          <ProfileLoginPanel
            {...loginPanelProps}
            mascotSource={loginMascotSource}
            onOpenAgreement={() =>
              router.push("/privacy?doc=agreement" as Href)
            }
            onOpenPrivacy={() => router.push("/privacy?doc=privacy" as Href)}
            profileGlassTone={profileGlassTone}
            resolvedThemeMode={resolvedThemeMode}
            styles={styles}
            theme={theme}
          />
        ) : null}
      </ScrollView>

      <ProfileMenuDrawer
        onClose={() => setProfileMenuVisible(false)}
        onNavigate={handleProfileMenuNavigate}
        resolvedThemeLabel={resolvedThemeLabel}
        signedInUser={signedInUser}
        styles={styles}
        theme={theme}
        visible={Boolean(signedInUser && isProfileMenuVisible)}
      />

      <ProfileEditorModal
        avatarImageTransform={avatarImageTransform}
        avatarImageUri={avatarImageUri}
        bio={bio}
        displayName={displayName}
        hasUploadedAvatar={hasUploadedAvatar}
        hintText={
          statusMessage === defaultLoginStatusMessage
            ? profileSaveHint
            : statusMessage
        }
        isBusy={isBusy}
        onChangeBio={setBio}
        onChangeDisplayName={setDisplayName}
        onClose={handleCloseProfileEditor}
        onPickAvatar={handlePickAvatar}
        onRemoveAvatar={handleRemoveProfileAvatar}
        onSave={handleSaveProfile}
        profileLoginInputWebFocusStyle={profileLoginInputWebFocusStyle}
        styles={styles}
        theme={theme}
        visible={Boolean(
          authUser &&
            isEditingProfile &&
            profileVisibility.showPostLoginModules,
        )}
      />

      <ConfirmDialog
        cancelLabel="不迁移"
        confirmButtonTone="primary"
        confirmLabel="迁移"
        dismissOnBackdropPress={false}
        isProcessing={isBusy}
        message="迁移会把这台设备上的游客行程、收藏和路线偏好上传到当前账号；不迁移会清空这些本机游客数据，避免同步到当前账号。"
        onCancel={() => {
          void handleSkipGuestMigration();
        }}
        onConfirm={() => {
          void handleConfirmGuestMigration();
        }}
        onRequestClose={() => undefined}
        processingLabel="处理中"
        title="迁移本机游客数据？"
        visible={Boolean(pendingGuestMigration)}
      />
      <PasswordSetupPromptModal
        confirmPassword={passwordSetupConfirm}
        defaultStatusMessage={defaultLoginStatusMessage}
        isBusy={isBusy}
        onChangeConfirmPassword={setPasswordSetupConfirm}
        onChangePassword={setPasswordSetupValue}
        onDismiss={handleDismissPasswordSetupPrompt}
        onSubmit={handleSetPassword}
        password={passwordSetupValue}
        pendingGuestMigration={Boolean(pendingGuestMigration)}
        statusMessage={statusMessage}
        statusTone={loginStatusTone}
        styles={styles}
        theme={theme}
        visible={shouldShowPasswordSetupPrompt}
      />

      <ProfileAvatarCropModal
        avatarCropGesture={avatarCropGesture}
        isCroppingAvatar={isCroppingAvatar}
        onCancel={() => setPendingAvatarCrop(null)}
        onConfirm={handleConfirmAvatarCrop}
        onPickAvatar={handlePickAvatar}
        onReset={handleResetAvatarCrop}
        onRotate={handleRotateAvatarCrop}
        onSetZoomTrackWidth={setAvatarCropZoomTrackWidth}
        onZoomStep={handleAvatarCropZoomStep}
        onZoomTrack={handleAvatarCropZoomTrack}
        pendingAvatarCrop={pendingAvatarCrop}
        pendingAvatarDisplay={pendingAvatarDisplay}
        pendingAvatarTransform={pendingAvatarTransform}
        pendingAvatarZoomProgress={pendingAvatarZoomProgress}
        styles={styles}
        theme={theme}
      />

      <IdentityOtpModal
        {...smsOtpModalProps}
        kind="phone"
        subtitle="输入手机号，获取短信验证码登录"
        title="手机号登录"
        verifyLabel="验证并登录"
      />
    </View>
  );
}
