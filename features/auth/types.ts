export type AuthProvider = "guest" | "email" | "phone" | "wechat" | "apple";

export type UserProfile = {
  id: string;
  displayName: string;
  avatarOffsetX?: number;
  avatarOffsetY?: number;
  avatarScale?: number;
  avatarUrl?: string;
  bio?: string;
  homeCity?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthIdentity = {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerUid: string;
  label: string;
  hasPassword?: boolean;
  createdAt: string;
  lastLoginAt: string;
};

export type AuthSession = {
  accessToken?: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  passwordSetupDismissedAt?: string;
  passwordSetupRecommended?: boolean;
  refreshToken?: string;
};

export type AuthState = {
  users: UserProfile[];
  identities: AuthIdentity[];
  session: AuthSession | null;
};

export type CurrentAuthUser = {
  user: UserProfile;
  identities: AuthIdentity[];
  session: AuthSession;
};

export type UpdateUserProfileInput = {
  avatarOffsetX?: number;
  avatarOffsetY?: number;
  avatarScale?: number;
  avatarUrl?: string;
  bio?: string;
  displayName?: string;
  homeCity?: string;
};

export type BindWechatResult =
  | {
      success: true;
      provider_uid: string;
      already_bound?: boolean;
    }
  | {
      conflict: true;
      conflict_user_id: string;
      provider_uid: string;
      display_name: string;
      avatar_url?: string;
    };
