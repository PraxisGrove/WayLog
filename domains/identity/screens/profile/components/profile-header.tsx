import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, Pressable, Text, View } from "react-native";

import { type CurrentAuthUser, getProfileInitials } from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";

export type ProfileHeaderProps = {
  authUser: CurrentAuthUser;
  avatarImageTransform: {
    transform: (
      | { scale: number }
      | { translateX: number }
      | { translateY: number }
    )[];
  };
  avatarImageUri: string;
  hasUploadedAvatar: boolean;
  onEditProfile: () => void;
  onOpenMenu: () => void;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
};

export function ProfileHeader({
  authUser,
  avatarImageTransform,
  avatarImageUri,
  hasUploadedAvatar,
  onEditProfile,
  onOpenMenu,
  styles,
  theme,
}: ProfileHeaderProps) {
  return (
    <View style={styles.profileHeader}>
      <ProfileSettingsMenuTrigger
        onPress={onOpenMenu}
        styles={styles}
        theme={theme}
      />
      <View style={styles.profileAvatarWrap}>
        <View
          style={[
            styles.profileAvatar,
            {
              backgroundColor: theme.colors.primarySoft,
              borderColor: theme.colors.surface,
            },
          ]}
        >
          {hasUploadedAvatar ? (
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
        <Pressable
          accessibilityLabel="编辑资料"
          accessibilityRole="button"
          onPress={onEditProfile}
          style={({ pressed }) => [
            styles.avatarEditButton,
            { backgroundColor: theme.colors.surface },
            pressed && { backgroundColor: theme.colors.surfacePressed },
          ]}
        >
          <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
        </Pressable>
      </View>

      <View style={styles.profileNameRow}>
        <Text style={styles.profileName}>{authUser.user.displayName}</Text>
      </View>

      <Text style={styles.profileSubtitle}>
        {authUser.user.bio?.trim() ||
          "把旅行计划、收藏地点和预算记录放在一个地方"}
      </Text>
    </View>
  );
}

export function ProfileSettingsMenuTrigger({
  onPress,
  styles,
  theme,
}: {
  onPress: () => void;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
}) {
  return (
    <Pressable
      accessibilityLabel="打开个人主页菜单"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileMenuButton,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        pressed && { backgroundColor: theme.colors.surfacePressed },
      ]}
    >
      <MaterialIcons name="menu" size={21} color={theme.colors.text} />
    </Pressable>
  );
}
