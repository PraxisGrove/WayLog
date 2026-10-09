import { useMemo } from "react";

import {
  type CurrentAuthUser,
  getProfilePageVisibility,
  shouldShowProfilePasswordSetupPrompt,
} from "@/features/auth";

export function useProfileAuthGate({
  authUser,
  hasLoadedProfileData,
}: {
  authUser: CurrentAuthUser | null;
  hasLoadedProfileData: boolean;
}) {
  const profileVisibility = useMemo(
    () => getProfilePageVisibility(authUser),
    [authUser],
  );
  const shouldShowLoginPanel =
    hasLoadedProfileData && profileVisibility.showLoginPanel;
  const signedInUser = profileVisibility.showPostLoginModules ? authUser : null;
  const shouldShowPostLoginBackground = Boolean(
    authUser && profileVisibility.showPostLoginModules,
  );
  const shouldShowPostLoginContent = Boolean(authUser && !shouldShowLoginPanel);
  const shouldShowPasswordSetupPrompt = Boolean(
    shouldShowProfilePasswordSetupPrompt(authUser) &&
      profileVisibility.showPostLoginModules,
  );
  const profileSaveHint = authUser?.session.accessToken
    ? "保存后会同步到当前登录账号的云端资料。"
    : "当前是游客模式，资料只会保存在这台设备上。";

  return {
    profileSaveHint,
    profileVisibility,
    shouldShowLoginPanel,
    shouldShowPostLoginContent,
    shouldShowPasswordSetupPrompt,
    shouldShowPostLoginBackground,
    signedInUser,
  };
}
