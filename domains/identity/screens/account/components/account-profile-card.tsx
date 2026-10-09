import { Image, Text, View } from "react-native";
import { getProfileInitials } from "@/features/auth";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { accountScreenStyles as styles } from "../account-screen.styles";
import type { useAccountController } from "../hooks/use-account-controller";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountProfileCard({
  authUser,
  avatarImageTransform,
  avatarImageUri,
  primaryIdentityMeta,
}: {
  authUser: NonNullable<AccountController["authUser"]>;
  avatarImageTransform: AccountController["avatarImageTransform"];
  avatarImageUri: AccountController["avatarImageUri"];
  primaryIdentityMeta: AccountController["primaryIdentityMeta"];
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.profileHeader}>
      <View style={styles.profileAvatarWrap}>
        <View
          style={[
            styles.profileAvatar,
            {
              backgroundColor: theme.colors.primarySoft,
              borderColor: theme.colors.surface,
              shadowColor: theme.colors.text,
            },
          ]}
        >
          {avatarImageUri ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: avatarImageUri }}
              style={[styles.profileAvatarImage, avatarImageTransform]}
            />
          ) : (
            <Text
              style={[
                styles.profileAvatarText,
                { color: theme.colors.primary },
              ]}
            >
              {getProfileInitials(authUser.user.displayName)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.profileNameRow}>
        <Text style={[styles.profileName, { color: theme.colors.text }]}>
          {authUser.user.displayName}
        </Text>
      </View>
      <Text style={[styles.profileSubtitle, { color: theme.colors.textMuted }]}>
        {primaryIdentityMeta
          ? `${primaryIdentityMeta.title} ${primaryIdentityMeta.description}`
          : "本机游客模式"}
      </Text>
    </View>
  );
}
