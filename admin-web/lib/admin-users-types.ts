export type AdminUserProvider = {
  label: string;
  provider: string;
};

export type AdminUserProfile = {
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string | null;
  displayName: string | null;
  homeCity: string | null;
  updatedAt: string | null;
};

export type AdminUserMetric = {
  description: string;
  key: "agent" | "crashes" | "favorites" | "feedback" | "trips";
  label: string;
  value: number;
};

export type AdminUserSummary = {
  agentCalls3d: number;
  avatarUrl: string | null;
  createdAt: string | null;
  displayName: string | null;
  email: string | null;
  favoritePlaces: number;
  feedbackCount: number;
  id: string;
  lastSignInAt: string | null;
  phone: string | null;
  providers: AdminUserProvider[];
  trips: number;
  updatedAt: string | null;
};

export type AdminUsersData = {
  generatedAt: string;
  page: number;
  pageSize: number;
  query: string;
  total: number;
  users: AdminUserSummary[];
  warnings: string[];
};

export type AdminUserTripItem = {
  deletedAt: string | null;
  destination: string;
  endDate: string | null;
  id: string;
  startDate: string | null;
  status: string;
  title: string;
  updatedAt: string;
  version: number;
};

export type AdminUserFavoriteItem = {
  area: string | null;
  category: string;
  deletedAt: string | null;
  favoritedAt: string | null;
  id: string;
  name: string;
  providerPlaceId: string | null;
  updatedAt: string;
};

export type AdminUserFeedbackItem = {
  appVersion: string | null;
  contactMethod: string | null;
  contactValue: string | null;
  createdAt: string;
  description: string;
  id: string;
  platform: string | null;
};

export type AdminUserCrashItem = {
  createdAt: string;
  environment: string | null;
  id: string;
  level: string | null;
  release: string | null;
  sentryUrl: string | null;
  title: string;
};

export type AdminUserDetail = {
  agentCalls: {
    lastCalledAt: string | null;
    total3d: number;
  };
  crashes: AdminUserCrashItem[];
  email: string | null;
  favoritePlaces: AdminUserFavoriteItem[];
  feedback: AdminUserFeedbackItem[];
  id: string;
  identities: AdminUserProvider[];
  lastSignInAt: string | null;
  metrics: AdminUserMetric[];
  phone: string | null;
  profile: AdminUserProfile | null;
  trips: AdminUserTripItem[];
  warnings: string[];
};
