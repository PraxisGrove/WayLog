import {
  AccountSettingRow,
  AccountSettingSection,
} from "./account-setting-section";
import type { useAccountController } from "../hooks/use-account-controller";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountAuthMethods({
  bindingRows,
  onBindingPress,
  profileGlassTone,
}: {
  bindingRows: AccountController["bindingRows"];
  onBindingPress: AccountController["handleBindingPress"];
  profileGlassTone: AccountController["profileGlassTone"];
}) {
  return (
    <AccountSettingSection title="其他登录方式" tone={profileGlassTone}>
      {bindingRows.map((row, index) => (
        <AccountSettingRow
          description={row.description}
          icon={row.icon}
          isLast={index === bindingRows.length - 1}
          key={row.provider}
          onPress={() => onBindingPress(row)}
          status={row.statusLabel}
          title={row.title}
          tone={profileGlassTone}
        />
      ))}
    </AccountSettingSection>
  );
}
