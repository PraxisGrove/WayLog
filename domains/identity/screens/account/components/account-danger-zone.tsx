import { useAppTheme } from "@/shared/theme/use-app-theme";

import {
  AccountSettingRow,
  AccountSettingSection,
} from "./account-setting-section";
import type { useAccountController } from "../hooks/use-account-controller";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountDangerZone({
  onDeleteAccountPress,
  onSignOutPress,
  profileGlassTone,
}: {
  onDeleteAccountPress: () => void;
  onSignOutPress: () => void;
  profileGlassTone: AccountController["profileGlassTone"];
}) {
  const theme = useAppTheme();

  return (
    <AccountSettingSection title="账号操作" tone={profileGlassTone}>
      <AccountSettingRow
        accentColor={theme.colors.danger}
        description="退出当前设备上的登录状态"
        icon="logout"
        onPress={onSignOutPress}
        title="退出登录"
        tone={profileGlassTone}
      />
      <AccountSettingRow
        accentColor={theme.colors.danger}
        description="永久删除云端账号与登录身份"
        icon="person-off"
        isLast
        onPress={onDeleteAccountPress}
        title="注销账号"
        tone={profileGlassTone}
      />
    </AccountSettingSection>
  );
}
