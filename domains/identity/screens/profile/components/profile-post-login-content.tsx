import type { ProfileGlassSurfaceTone } from "@/domains/identity/components/profile-glass-card";
import type { CurrentAuthUser } from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";
import { ProfileHeader } from "./profile-header";
import {
  ProfileQuickActionCard,
  type ProfileQuickActionRoute,
} from "./profile-quick-action-card";
import {
  type ProfileTripStatItem,
  ProfileTripStats,
} from "./profile-trip-stats";

export type ProfilePostLoginContentProps = {
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
  isCompactQuickActionBar: boolean;
  onEditProfile: () => void;
  onNavigateQuickAction: (route: ProfileQuickActionRoute) => void;
  onOpenMenu: () => void;
  profileGlassTone: ProfileGlassSurfaceTone;
  profileSkinAdapterId: string;
  quickActionBarHeight: number;
  stats: ProfileTripStatItem[];
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
};

export function ProfilePostLoginContent({
  authUser,
  avatarImageTransform,
  avatarImageUri,
  hasUploadedAvatar,
  isCompactQuickActionBar,
  onEditProfile,
  onNavigateQuickAction,
  onOpenMenu,
  profileGlassTone,
  profileSkinAdapterId: _profileSkinAdapterId,
  quickActionBarHeight,
  stats,
  styles,
  theme,
}: ProfilePostLoginContentProps) {
  return (
    <>
      <ProfileHeader
        authUser={authUser}
        avatarImageTransform={avatarImageTransform}
        avatarImageUri={avatarImageUri}
        hasUploadedAvatar={hasUploadedAvatar}
        onEditProfile={onEditProfile}
        onOpenMenu={onOpenMenu}
        styles={styles}
        theme={theme}
      />
      <ProfileTripStats items={stats} styles={styles} theme={theme} />
      <ProfileQuickActionCard
        isCompact={isCompactQuickActionBar}
        onNavigate={onNavigateQuickAction}
        quickActionBarHeight={quickActionBarHeight}
        styles={styles}
        theme={theme}
        tone={profileGlassTone}
      />
    </>
  );
}
