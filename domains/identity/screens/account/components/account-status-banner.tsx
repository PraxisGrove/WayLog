import { Text, View } from "react-native";
import { getProfileGlassCardStyle } from "@/domains/identity/components/profile-glass-card";

import { accountScreenStyles as styles } from "../account-screen.styles";
import type { AccountToneColors } from "../account-screen.types";
import type { useAccountController } from "../hooks/use-account-controller";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountStatusBanner({
  message,
  profileGlassTone,
  toneColors,
}: {
  message: string;
  profileGlassTone: AccountController["profileGlassTone"];
  toneColors: AccountToneColors;
}) {
  if (!message) {
    return null;
  }

  return (
    <View
      style={[
        styles.statusBanner,
        styles.profileGlassCard,
        getProfileGlassCardStyle(profileGlassTone),
        {
          backgroundColor: toneColors.backgroundColor,
          borderColor: toneColors.borderColor,
        },
      ]}
    >
      <Text style={[styles.statusText, { color: toneColors.textColor }]}>
        {message}
      </Text>
    </View>
  );
}
