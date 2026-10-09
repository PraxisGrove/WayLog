import { createDiagnosticLogger } from "../diagnostics";
import { clearAgentRuntimeForAccount } from "../agent/runtime-lifecycle";
import {
  requestSupabase,
  type SupabaseAuthResponse,
  type SupabaseAuthUser,
} from "./supabase";
import type {
  AuthIdentity,
  AuthProvider,
  AuthSession,
  AuthState,
  BindWechatResult,
  CurrentAuthUser,
  UpdateUserProfileInput,
  UserProfile,
} from "./types";

export const AUTH_STORAGE_KEY = "waylog.auth.v1";
const TRIPS_STORAGE_KEY = "waylog.trips.v1";
const TRIP_SYNC_STORAGE_KEY = "waylog.trip_sync.v1";
const FAVORITE_PLACES_STORAGE_KEY = "waylog.favorite_places.v1";
const FAVORITE_PLACE_SYNC_STORAGE_KEY = "waylog.favorite_place_sync.v1";
const TRIP_ROUTE_PREFERENCE_STORAGE_KEY = "waylog.trip_route_preferences.v1";
const TRIP_EXPENSE_PREFERENCE_STORAGE_KEY =
  "waylog.trip_expense_preferences.v1";
const TRIP_ROUTE_UNIFIED_PREFERENCE_STORAGE_KEY = "waylog.preferences.route.v1";
const TRIP_EXPENSE_UNIFIED_PREFERENCE_STORAGE_KEY =
  "waylog.preferences.expense.v1";
const TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY =
  "waylog.preferences.checklist_templates.v1";
const AGENT_APPLIED_PROPOSALS_STORAGE_KEY = "waylog.agent.applied-proposals.v1";
const AGENT_CONVERSATION_INDEX_STORAGE_KEY =
  "waylog.agent.conversations.index.v1";
const AGENT_CONVERSATION_STORAGE_KEY_PREFIX = "waylog.agent.conversation.v1.";
const authLogger = createDiagnosticLogger("auth");

type SupabaseProfileRow = {
  id?: string;
  avatar_offset_x?: number | string | null;
  avatar_offset_y?: number | string | null;
  avatar_scale?: number | string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
  display_name?: string | null;
  home_city?: string | null;
  updated_at?: string | null;
};

type AuthStorageAdapter = {
  getAllKeys?: () => Promise<readonly string[]>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let authStorage: AuthStorageAdapter | undefined;

export function setAuthStorageAdapter(storage: AuthStorageAdapter): void {
  authStorage = storage;
}

async function getAuthStorage(): Promise<AuthStorageAdapter> {
  if (authStorage) {
    return authStorage;
  }

  const asyncStorage = await import(
    "@react-native-async-storage/async-storage"
  );
  const storage = asyncStorage.default as unknown as AuthStorageAdapter;
  authStorage = storage;

  return storage;
}

const emptyAuthState = (): AuthState => ({
  identities: [],
  session: null,
  users: [],
});

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeAvatarScale(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(2, Math.max(1, Math.round(value * 10) / 10));
}

function normalizeAvatarOffset(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(40, Math.max(-40, Math.round(value)));
}

function normalizeUser(rawUser: unknown): UserProfile | undefined {
  if (typeof rawUser !== "object" || rawUser === null) {
    return undefined;
  }

  const user = rawUser as Record<string, unknown>;
  const id = normalizeString(user.id);

  if (!id) {
    return undefined;
  }

  const now = new Date().toISOString();

  return {
    id,
    displayName: normalizeString(user.displayName) ?? "旅行者",
    avatarOffsetX: normalizeAvatarOffset(user.avatarOffsetX),
    avatarOffsetY: normalizeAvatarOffset(user.avatarOffsetY),
    avatarScale: normalizeAvatarScale(user.avatarScale),
    avatarUrl: normalizeString(user.avatarUrl),
    bio: normalizeString(user.bio),
    homeCity: normalizeString(user.homeCity),
    createdAt: normalizeString(user.createdAt) ?? now,
    updatedAt: normalizeString(user.updatedAt) ?? now,
  };
}

function isAuthProvider(value: unknown): value is AuthProvider {
  return (
    value === "guest" ||
    value === "email" ||
    value === "phone" ||
    value === "wechat" ||
    value === "apple"
  );
}

function normalizeIdentity(rawIdentity: unknown): AuthIdentity | undefined {
  if (typeof rawIdentity !== "object" || rawIdentity === null) {
    return undefined;
  }

  const identity = rawIdentity as Record<string, unknown>;
  const id = normalizeString(identity.id);
  const userId = normalizeString(identity.userId);
  const providerUid = normalizeString(identity.providerUid);

  if (!id || !userId || !providerUid || !isAuthProvider(identity.provider)) {
    return undefined;
  }

  const now = new Date().toISOString();

  return {
    id,
    userId,
    provider: identity.provider,
    providerUid,
    label: normalizeString(identity.label) ?? providerUid,
    hasPassword: identity.hasPassword === true,
    createdAt: normalizeString(identity.createdAt) ?? now,
    lastLoginAt: normalizeString(identity.lastLoginAt) ?? now,
  };
}

function normalizeSession(
  rawSession: unknown,
  users: UserProfile[],
): AuthSession | null {
  if (typeof rawSession !== "object" || rawSession === null) {
    return null;
  }

  const session = rawSession as Record<string, unknown>;
  const userId = normalizeString(session.userId);

  if (!userId || !users.some((user) => user.id === userId)) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    userId,
    accessToken: normalizeString(session.accessToken),
    createdAt: normalizeString(session.createdAt) ?? now,
    lastActiveAt: normalizeString(session.lastActiveAt) ?? now,
    passwordSetupDismissedAt: normalizeString(session.passwordSetupDismissedAt),
    passwordSetupRecommended: session.passwordSetupRecommended === true,
    refreshToken: normalizeString(session.refreshToken),
  };
}

function normalizeAuthState(rawState: unknown): AuthState {
  if (typeof rawState !== "object" || rawState === null) {
    return emptyAuthState();
  }

  const state = rawState as Record<string, unknown>;
  const users = Array.isArray(state.users)
    ? state.users
        .map(normalizeUser)
        .filter((user): user is UserProfile => Boolean(user))
    : [];
  const userIds = new Set(users.map((user) => user.id));
  const identities = Array.isArray(state.identities)
    ? state.identities
        .map(normalizeIdentity)
        .filter((identity): identity is AuthIdentity => {
          return identity !== undefined && userIds.has(identity.userId);
        })
    : [];

  return {
    users,
    identities,
    session: normalizeSession(state.session, users),
  };
}

export async function getAuthState(): Promise<AuthState> {
  const storage = await getAuthStorage();
  const rawAuthState = await storage.getItem(AUTH_STORAGE_KEY);

  if (!rawAuthState) {
    return emptyAuthState();
  }

  try {
    return normalizeAuthState(JSON.parse(rawAuthState));
  } catch (error) {
    authLogger.warn(
      "state.parse.failed",
      { error },
      "Failed to parse auth state from local storage",
    );
    return emptyAuthState();
  }
}

export async function saveAuthState(state: AuthState): Promise<void> {
  const storage = await getAuthStorage();

  await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function createSession(
  userId: string,
  tokens?: {
    accessToken?: string;
    passwordSetupRecommended?: boolean;
    refreshToken?: string;
  },
): AuthSession {
  const now = new Date().toISOString();

  return {
    accessToken: normalizeString(tokens?.accessToken),
    userId,
    createdAt: now,
    lastActiveAt: now,
    passwordSetupRecommended: tokens?.passwordSetupRecommended === true,
    refreshToken: normalizeString(tokens?.refreshToken),
  };
}

function createUser(displayName: string): UserProfile {
  const now = new Date().toISOString();

  return {
    id: createId("user"),
    displayName,
    createdAt: now,
    updatedAt: now,
  };
}

function createIdentity(
  userId: string,
  provider: AuthProvider,
  providerUid: string,
  label: string,
  options?: { hasPassword?: boolean },
): AuthIdentity {
  const now = new Date().toISOString();

  return {
    id: createId("identity"),
    userId,
    provider,
    providerUid,
    label,
    hasPassword: options?.hasPassword === true,
    createdAt: now,
    lastLoginAt: now,
  };
}

function touchIdentity(
  identity: AuthIdentity,
  patch?: Pick<AuthIdentity, "hasPassword">,
): AuthIdentity {
  return {
    ...identity,
    ...patch,
    lastLoginAt: new Date().toISOString(),
  };
}

function maskPhone(phone: string): string {
  return phone
    .replace(/^\+?86(\d{3})\d{4}(\d{4})$/, "$1****$2")
    .replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function normalizeEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return normalizedEmail;
  }

  throw new Error("请输入有效邮箱地址");
}

function normalizeEmailOtpCode(code: string): string {
  const normalizedCode = code.trim();

  if (/^\d{6}$/.test(normalizedCode)) {
    return normalizedCode;
  }

  throw new Error("请输入 6 位邮箱验证码");
}

function normalizePassword(password: string): string {
  const normalizedPassword = password.trim();

  if (normalizedPassword.length >= 8) {
    return normalizedPassword;
  }

  throw new Error("密码至少需要 8 位");
}

function isInvalidOtpError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("token has expired") ||
    message.includes("invalid") ||
    message.includes("otp") ||
    message.includes("验证码")
  );
}

function isInvalidPasswordSignInError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("invalid login") || message.includes("invalid credentials")
  );
}

function isExpiredJwtError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return message.includes("jwt expired");
}

function decodeBase64Url(value: string): string {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    Math.ceil(normalizedValue.length / 4) * 4,
    "=",
  );

  if (typeof atob === "function") {
    return atob(paddedValue);
  }

  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const character of paddedValue) {
    if (character === "=") {
      break;
    }

    const valueIndex = alphabet.indexOf(character);

    if (valueIndex < 0) {
      throw new Error("Invalid base64url value");
    }

    buffer = (buffer << 6) | valueIndex;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function getJwtExpirationMs(token: string | undefined): number | undefined {
  if (!token) {
    return undefined;
  }

  const [, payload] = token.split(".");

  if (!payload) {
    return undefined;
  }

  try {
    const decodedPayload = JSON.parse(decodeBase64Url(payload)) as {
      exp?: unknown;
    };

    return typeof decodedPayload.exp === "number" &&
      Number.isFinite(decodedPayload.exp)
      ? decodedPayload.exp * 1000
      : undefined;
  } catch {
    return undefined;
  }
}

function shouldRefreshSupabaseSession(session: AuthSession): boolean {
  const expirationMs = getJwtExpirationMs(session.accessToken);

  if (expirationMs === undefined) {
    return false;
  }

  return expirationMs <= Date.now() + 60 * 1000;
}

function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  const safeName = name.length <= 1 ? `${name}***` : `${name.slice(0, 1)}***`;

  return `${safeName}@${domain}`;
}

function isInternalAuthEmail(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  return (
    normalizedEmail.endsWith("@accounts.waylog.invalid") ||
    normalizedEmail.endsWith("@phone.local") ||
    normalizedEmail.endsWith("@wechat.local")
  );
}

function normalizeMainlandPhone(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, "");

  if (/^1\d{10}$/.test(normalizedPhone)) {
    return `+86${normalizedPhone}`;
  }

  if (/^861\d{10}$/.test(normalizedPhone)) {
    return `+${normalizedPhone}`;
  }

  throw new Error("请输入 11 位中国大陆手机号");
}

function createUserFromSupabaseEmail(
  user: SupabaseAuthUser,
  email: string,
): UserProfile {
  const now = new Date().toISOString();
  const nameFromEmail = email.split("@")[0] || email;
  const displayName =
    normalizeString(user.user_metadata?.display_name) ??
    `旅行者 ${nameFromEmail}`;
  const createdAt = normalizeString(user.created_at) ?? now;

  return {
    id: normalizeString(user.id) ?? createId("user"),
    displayName,
    createdAt,
    updatedAt: normalizeString(user.updated_at) ?? now,
  };
}

function createUserFromSupabasePhone(
  user: SupabaseAuthUser,
  phone: string,
): UserProfile {
  const now = new Date().toISOString();
  const displayName =
    normalizeString(user.user_metadata?.display_name) ??
    `旅行者 ${phone.slice(-4)}`;
  const createdAt = normalizeString(user.created_at) ?? now;

  return {
    id: normalizeString(user.id) ?? createId("user"),
    displayName,
    createdAt,
    updatedAt: normalizeString(user.updated_at) ?? now,
  };
}

function createUserFromSupabaseWechat(user: SupabaseAuthUser): UserProfile {
  const now = new Date().toISOString();
  const displayName =
    normalizeString(user.user_metadata?.display_name) ??
    normalizeString(user.user_metadata?.name) ??
    "微信旅行者";
  const createdAt = normalizeString(user.created_at) ?? now;

  return {
    id: normalizeString(user.id) ?? createId("user"),
    displayName,
    avatarUrl: normalizeString(user.user_metadata?.avatar_url),
    createdAt,
    updatedAt: normalizeString(user.updated_at) ?? now,
  };
}

function normalizeProfileNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  return undefined;
}

function applySupabaseProfileToUser(
  user: UserProfile,
  profile?: SupabaseProfileRow,
): UserProfile {
  if (!profile) {
    return user;
  }

  return {
    ...user,
    avatarOffsetX:
      normalizeAvatarOffset(normalizeProfileNumber(profile.avatar_offset_x)) ??
      user.avatarOffsetX,
    avatarOffsetY:
      normalizeAvatarOffset(normalizeProfileNumber(profile.avatar_offset_y)) ??
      user.avatarOffsetY,
    avatarScale:
      normalizeAvatarScale(normalizeProfileNumber(profile.avatar_scale)) ??
      user.avatarScale,
    avatarUrl: normalizeString(profile.avatar_url) ?? user.avatarUrl,
    bio: normalizeString(profile.bio) ?? user.bio,
    createdAt: normalizeString(profile.created_at) ?? user.createdAt,
    displayName: normalizeString(profile.display_name) ?? user.displayName,
    homeCity: normalizeString(profile.home_city) ?? user.homeCity,
    updatedAt: normalizeString(profile.updated_at) ?? user.updatedAt,
  };
}

function mergeSupabaseUserIntoExistingUser(
  existingUser: UserProfile,
  user: UserProfile,
): UserProfile {
  return {
    ...existingUser,
    avatarOffsetX: user.avatarOffsetX ?? existingUser.avatarOffsetX,
    avatarOffsetY: user.avatarOffsetY ?? existingUser.avatarOffsetY,
    avatarScale: user.avatarScale ?? existingUser.avatarScale,
    avatarUrl: user.avatarUrl ?? existingUser.avatarUrl,
    bio: user.bio ?? existingUser.bio,
    displayName: normalizeString(user.displayName) ?? existingUser.displayName,
    homeCity: user.homeCity ?? existingUser.homeCity,
    updatedAt: normalizeString(user.updatedAt) ?? new Date().toISOString(),
  };
}

async function fetchSupabaseProfile(
  authResponse: SupabaseAuthResponse,
): Promise<SupabaseProfileRow | undefined> {
  const accessToken = normalizeString(authResponse.access_token);
  const userId =
    normalizeString(authResponse.user?.id) ??
    normalizeString(authResponse.user_hint?.id);

  if (!accessToken || !userId) {
    return undefined;
  }

  try {
    const profiles = await requestSupabase<SupabaseProfileRow[]>({
      accessToken,
      method: "GET",
      path: `profiles?id=eq.${encodeURIComponent(
        userId,
      )}&select=id,display_name,avatar_url,bio,home_city,avatar_scale,avatar_offset_x,avatar_offset_y,created_at,updated_at&limit=1`,
      service: "rest",
    });

    return profiles[0];
  } catch (error) {
    authLogger.warn(
      "profile.fetch.failed",
      { error, userId },
      "Failed to fetch Supabase profile",
    );
    return undefined;
  }
}

function mergeVerifiedEmailAuthState(
  state: AuthState,
  verifiedAuth: SupabaseAuthResponse,
  verifiedUser: SupabaseAuthUser,
  email: string,
  options?: {
    passwordSetupRecommended?: boolean;
    profile?: SupabaseProfileRow;
  },
): AuthState {
  const user = applySupabaseProfileToUser(
    createUserFromSupabaseEmail(verifiedUser, email),
    options?.profile,
  );
  const existingUser = state.users.find((item) => item.id === user.id);
  const existingEmailIdentity = state.identities.find(
    (identity) =>
      identity.provider === "email" && identity.providerUid === email,
  );
  const nextUsers = existingUser
    ? state.users.map((item) =>
        item.id === user.id
          ? mergeSupabaseUserIntoExistingUser(item, user)
          : item,
      )
    : [user, ...state.users];
  const emailIdentity = existingEmailIdentity
    ? touchIdentity(existingEmailIdentity)
    : createIdentity(user.id, "email", email, maskEmail(email));
  const nextIdentities = existingEmailIdentity
    ? state.identities.map((identity) =>
        identity.id === existingEmailIdentity.id ? emailIdentity : identity,
      )
    : [
        emailIdentity,
        ...state.identities.filter(
          (identity) => identity.id !== emailIdentity.id,
        ),
      ];

  return {
    users: nextUsers,
    identities: nextIdentities,
    session: createSession(user.id, {
      accessToken: verifiedAuth.access_token,
      passwordSetupRecommended: options?.passwordSetupRecommended,
      refreshToken: verifiedAuth.refresh_token,
    }),
  };
}

function mergePasswordEmailAuthState(
  state: AuthState,
  verifiedAuth: SupabaseAuthResponse,
  verifiedUser: SupabaseAuthUser,
  email: string,
  options?: { profile?: SupabaseProfileRow },
): AuthState {
  const nextState = mergeVerifiedEmailAuthState(
    state,
    verifiedAuth,
    verifiedUser,
    email,
    {
      passwordSetupRecommended: false,
      profile: options?.profile,
    },
  );
  const nextIdentities = nextState.identities.map((identity) =>
    identity.provider === "email" && identity.providerUid === email
      ? { ...identity, hasPassword: true }
      : identity,
  );

  return {
    ...nextState,
    identities: nextIdentities,
  };
}

function mergePasswordPhoneAuthState(
  state: AuthState,
  verifiedAuth: SupabaseAuthResponse,
  verifiedUser: SupabaseAuthUser,
  phone: string,
  options?: { profile?: SupabaseProfileRow },
): AuthState {
  const nextState = mergeVerifiedPhoneAuthState(
    state,
    verifiedAuth,
    verifiedUser,
    phone,
    {
      profile: options?.profile,
    },
  );
  const nextIdentities = nextState.identities.map((identity) =>
    identity.provider === "phone" && identity.providerUid === phone
      ? { ...identity, hasPassword: true }
      : identity,
  );

  return {
    ...nextState,
    identities: nextIdentities,
  };
}

function mergeVerifiedPhoneAuthState(
  state: AuthState,
  verifiedAuth: SupabaseAuthResponse,
  verifiedUser: SupabaseAuthUser,
  phone: string,
  options?: { profile?: SupabaseProfileRow },
): AuthState {
  const user = applySupabaseProfileToUser(
    createUserFromSupabasePhone(verifiedUser, phone),
    options?.profile,
  );
  const existingUser = state.users.find((item) => item.id === user.id);
  const existingPhoneIdentity = state.identities.find(
    (identity) =>
      identity.provider === "phone" && identity.providerUid === phone,
  );
  const nextUsers = existingUser
    ? state.users.map((item) =>
        item.id === user.id
          ? mergeSupabaseUserIntoExistingUser(item, user)
          : item,
      )
    : [user, ...state.users];
  const phoneIdentity = existingPhoneIdentity
    ? touchIdentity(existingPhoneIdentity)
    : createIdentity(user.id, "phone", phone, maskPhone(phone));
  const nextIdentities = existingPhoneIdentity
    ? state.identities.map((identity) =>
        identity.id === existingPhoneIdentity.id ? phoneIdentity : identity,
      )
    : [
        phoneIdentity,
        ...state.identities.filter(
          (identity) => identity.id !== phoneIdentity.id,
        ),
      ];

  return {
    users: nextUsers,
    identities: nextIdentities,
    session: createSession(user.id, {
      accessToken: verifiedAuth.access_token,
      refreshToken: verifiedAuth.refresh_token,
    }),
  };
}

function mergeVerifiedWechatAuthState(
  state: AuthState,
  verifiedAuth: SupabaseAuthResponse,
  verifiedUser: SupabaseAuthUser,
  options?: { profile?: SupabaseProfileRow },
): AuthState {
  const user = applySupabaseProfileToUser(
    createUserFromSupabaseWechat(verifiedUser),
    options?.profile,
  );
  const providerUid =
    normalizeString(verifiedUser.user_metadata?.wechat_unionid) ??
    normalizeString(verifiedUser.user_metadata?.wechat_openid) ??
    user.id;
  const existingUser = state.users.find((item) => item.id === user.id);
  const existingWechatIdentity = state.identities.find(
    (identity) =>
      identity.provider === "wechat" && identity.providerUid === providerUid,
  );
  const nextUsers = existingUser
    ? state.users.map((item) =>
        item.id === user.id
          ? mergeSupabaseUserIntoExistingUser(item, user)
          : item,
      )
    : [user, ...state.users];
  const wechatIdentity = existingWechatIdentity
    ? touchIdentity(existingWechatIdentity)
    : createIdentity(user.id, "wechat", providerUid, "微信");
  const nextIdentities = existingWechatIdentity
    ? state.identities.map((identity) =>
        identity.id === existingWechatIdentity.id ? wechatIdentity : identity,
      )
    : [
        wechatIdentity,
        ...state.identities.filter(
          (identity) => identity.id !== wechatIdentity.id,
        ),
      ];

  return {
    users: nextUsers,
    identities: nextIdentities,
    session: createSession(user.id, {
      accessToken: verifiedAuth.access_token,
      refreshToken: verifiedAuth.refresh_token,
    }),
  };
}

async function syncCurrentProfileToSupabase(
  currentUser: CurrentAuthUser,
  input: UpdateUserProfileInput,
): Promise<void> {
  if (!currentUser.session.accessToken) {
    return;
  }

  await requestSupabase<unknown>({
    accessToken: currentUser.session.accessToken,
    body: {
      id: currentUser.user.id,
      avatar_offset_x: normalizeAvatarOffset(input.avatarOffsetX) ?? 0,
      avatar_offset_y: normalizeAvatarOffset(input.avatarOffsetY) ?? 0,
      avatar_url: normalizeString(input.avatarUrl) ?? null,
      avatar_scale: normalizeAvatarScale(input.avatarScale) ?? 1,
      bio: normalizeString(input.bio) ?? null,
      display_name:
        normalizeString(input.displayName) ?? currentUser.user.displayName,
      home_city: normalizeString(input.homeCity) ?? null,
    },
    method: "POST",
    path: "profiles?on_conflict=id",
    prefer: "resolution=merge-duplicates,return=minimal",
    service: "rest",
  });
}

export async function refreshSupabaseSession(
  session: AuthSession,
): Promise<AuthSession> {
  if (!session.refreshToken) {
    authLogger.warn(
      "session.refresh.missing-refresh-token",
      {
        userId: session.userId,
      },
      "Cannot refresh auth session because refresh token is missing",
    );
    throw new Error("登录状态已过期，请重新登录");
  }

  authLogger.info(
    "session.refresh.started",
    {
      userId: session.userId,
    },
    "Refreshing auth session",
  );

  const refreshedAuth = await requestSupabase<SupabaseAuthResponse>({
    body: {
      refresh_token: session.refreshToken,
    },
    path: "token?grant_type=refresh_token",
    service: "auth",
  });
  const accessToken = normalizeString(refreshedAuth.access_token);

  if (!accessToken) {
    authLogger.error(
      "session.refresh.missing-access-token",
      {
        userId: session.userId,
      },
      "Refresh response did not include an access token",
    );
    throw new Error("登录状态已过期，请重新登录");
  }

  authLogger.info(
    "session.refresh.succeeded",
    {
      userId: session.userId,
    },
    "Refreshed auth session",
  );
  return {
    ...session,
    accessToken,
    lastActiveAt: new Date().toISOString(),
    refreshToken:
      normalizeString(refreshedAuth.refresh_token) ?? session.refreshToken,
  };
}

function getCurrentUserFromState(state: AuthState): CurrentAuthUser | null {
  if (!state.session) {
    return null;
  }

  const user = state.users.find((item) => item.id === state.session?.userId);

  if (!user) {
    return null;
  }

  return {
    user,
    identities: state.identities.filter(
      (identity) => identity.userId === user.id,
    ),
    session: state.session,
  };
}

function isCloudBackedCurrentUser(
  currentUser: CurrentAuthUser | null,
): boolean {
  return (
    currentUser?.identities.some((identity) => identity.provider !== "guest") ??
    false
  );
}

async function clearLocalSyncMetadata(
  storage: AuthStorageAdapter,
): Promise<void> {
  await Promise.all([
    storage.removeItem(TRIP_SYNC_STORAGE_KEY),
    storage.removeItem(FAVORITE_PLACE_SYNC_STORAGE_KEY),
  ]);
}

async function clearAllLocalAppData(
  storage: AuthStorageAdapter,
): Promise<void> {
  //
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy-load trips/storage so Node-only auth tests do not evaluate AsyncStorage-dependent modules during import.
  const { invalidateTripsCache } = require("../trips/storage");
  invalidateTripsCache();
  await Promise.all([
    storage.removeItem(TRIPS_STORAGE_KEY),
    storage.removeItem(TRIP_SYNC_STORAGE_KEY),
    storage.removeItem("waylog.trips.seeded.v2"),
    storage.removeItem("waylog.trips.seed.dismissed.v1"),
    storage.removeItem(FAVORITE_PLACES_STORAGE_KEY),
    storage.removeItem(FAVORITE_PLACE_SYNC_STORAGE_KEY),
    storage.removeItem(TRIP_ROUTE_PREFERENCE_STORAGE_KEY),
    storage.removeItem(TRIP_EXPENSE_PREFERENCE_STORAGE_KEY),
    storage.removeItem(TRIP_ROUTE_UNIFIED_PREFERENCE_STORAGE_KEY),
    storage.removeItem(TRIP_EXPENSE_UNIFIED_PREFERENCE_STORAGE_KEY),
    storage.removeItem(TRIP_CHECKLIST_TEMPLATE_PREFERENCE_STORAGE_KEY),
    storage.removeItem("waylog.trip_sync_preferences.v1"),
    storage.removeItem("waylog.trip_route_segments.v14"),
    storage.removeItem("waylog.trip_route_segments.v13"),
    storage.removeItem("waylog.route_cache_seeded.v3"),
    storage.removeItem("waylog.route_cache_seeded.v2"),
    storage.removeItem("waylog.place_cache.v1"),
    clearLocalAgentData(storage),
  ]);
}

async function clearLocalAgentData(storage: AuthStorageAdapter): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy-load agent storage to avoid making auth depend on agent at module initialization time.
  const { getAgentLocalStorage } = require("../agent/agent-local-storage") as {
    getAgentLocalStorage: () => AuthStorageAdapter;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy-load agent ledger cleanup with the rest of local Agent data cleanup.
  const { clearAppliedAgentProposalLedger } =
    require("../agent/applied-proposals") as {
      clearAppliedAgentProposalLedger: () => Promise<void>;
    };
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Trip 创建回执与待恢复记录和其它 Agent 本地状态一起清理。
  const { clearTripCreateLocalState } =
    require("../agent/flows/trip-create/trip-create-local-state") as {
      clearTripCreateLocalState: () => Promise<void>;
    };
  const agentStorage = getAgentLocalStorage();
  const conversationKeys =
    await getAgentConversationStorageKeysForRemoval(storage);
  const sqliteConversationKeys =
    await getAgentConversationStorageKeysForRemoval(agentStorage);

  await Promise.all([
    storage.removeItem(AGENT_APPLIED_PROPOSALS_STORAGE_KEY),
    storage.removeItem(AGENT_CONVERSATION_INDEX_STORAGE_KEY),
    ...conversationKeys.map((key) => storage.removeItem(key)),
    clearAppliedAgentProposalLedger(),
    clearTripCreateLocalState(),
    agentStorage.removeItem(AGENT_CONVERSATION_INDEX_STORAGE_KEY),
    ...sqliteConversationKeys.map((key) => agentStorage.removeItem(key)),
  ]);
}

async function getAgentConversationStorageKeysForRemoval(
  storage: AuthStorageAdapter,
): Promise<string[]> {
  const keys = new Set<string>();
  const rawIndex = await storage.getItem(AGENT_CONVERSATION_INDEX_STORAGE_KEY);

  if (rawIndex) {
    for (const conversationId of readAgentConversationIdsFromIndex(rawIndex)) {
      keys.add(getAgentConversationStorageKey(conversationId));
    }
  }

  if (storage.getAllKeys) {
    const allKeys = await storage.getAllKeys();

    for (const key of allKeys) {
      if (key.startsWith(AGENT_CONVERSATION_STORAGE_KEY_PREFIX)) {
        keys.add(key);
      }
    }
  }

  return [...keys];
}

function readAgentConversationIdsFromIndex(rawIndex: string): string[] {
  try {
    const parsed = JSON.parse(rawIndex);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return [];
    }

    const source = parsed as Record<string, unknown>;
    const ids = new Set<string>();

    if (
      typeof source.currentConversationId === "string" &&
      source.currentConversationId.trim()
    ) {
      ids.add(source.currentConversationId.trim());
    }

    if (Array.isArray(source.summaries)) {
      for (const summary of source.summaries) {
        if (
          typeof summary === "object" &&
          summary !== null &&
          !Array.isArray(summary)
        ) {
          const id = (summary as Record<string, unknown>).id;

          if (typeof id === "string" && id.trim()) {
            ids.add(id.trim());
          }
        }
      }
    }

    return [...ids];
  } catch {
    return [];
  }
}

function getAgentConversationStorageKey(conversationId: string): string {
  return `${AGENT_CONVERSATION_STORAGE_KEY_PREFIX}${conversationId}`;
}

export async function getCurrentAuthUser(): Promise<CurrentAuthUser | null> {
  const currentUser = getCurrentUserFromState(await getAuthState());
  authLogger.debug(
    "current-user.read",
    {
      hasSession: Boolean(currentUser?.session),
      userId: currentUser?.user.id ?? null,
    },
    "Read current auth user",
  );
  return currentUser;
}

export async function hasGuestIdentityRecord(): Promise<boolean> {
  return (await getAuthState()).identities.some(
    (identity) => identity.provider === "guest",
  );
}

export async function getCurrentAuthAccessToken(): Promise<string | undefined> {
  try {
    const accessToken = normalizeString(
      (await getAuthState()).session?.accessToken,
    );
    authLogger.debug(
      "access-token.read",
      {
        hasAccessToken: Boolean(accessToken),
      },
      "Read current auth access token",
    );
    return accessToken;
  } catch (error) {
    authLogger.warn(
      "access-token.read.failed",
      {
        error,
      },
      "Failed to read current auth access token",
    );
    return undefined;
  }
}

export async function signInAsGuest(): Promise<CurrentAuthUser> {
  authLogger.info("sign-in.guest.started", {}, "Starting guest sign-in");
  const state = await getAuthState();
  const existingGuestIdentity = state.identities.find(
    (identity) => identity.provider === "guest",
  );
  let nextState = state;

  if (existingGuestIdentity) {
    nextState = {
      ...state,
      identities: state.identities.map((identity) =>
        identity.id === existingGuestIdentity.id
          ? touchIdentity(identity)
          : identity,
      ),
      session: createSession(existingGuestIdentity.userId),
    };
  } else {
    const user = createUser("本机旅行者");
    const identity = createIdentity(
      user.id,
      "guest",
      createId("guest-device"),
      "本机游客",
    );
    nextState = {
      users: [user, ...state.users],
      identities: [identity, ...state.identities],
      session: createSession(user.id),
    };
  }

  await saveAuthState(nextState);
  const currentUser = getCurrentUserFromState(nextState);

  if (!currentUser) {
    authLogger.error(
      "sign-in.guest.failed-no-session",
      {},
      "Guest sign-in finished without a current user",
    );
    throw new Error("Failed to create guest session.");
  }

  authLogger.info(
    "sign-in.guest.succeeded",
    {
      userId: currentUser.user.id,
    },
    "Signed in as guest",
  );
  return currentUser;
}

async function verifyTokenHash(
  token_hash: string,
): Promise<SupabaseAuthResponse> {
  return requestSupabase<SupabaseAuthResponse>({
    body: {
      token_hash,
      type: "magiclink",
    },
    path: "verify",
    service: "auth",
  });
}

export async function requestEmailOtp(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  authLogger.info(
    "request-email-otp.started",
    {
      emailHint: maskEmail(normalizedEmail),
    },
    "Requesting email OTP",
  );

  await requestSupabase<SupabaseAuthResponse>({
    body: {
      email: normalizedEmail,
      create_user: true,
    },
    path: "otp",
    service: "auth",
  });

  authLogger.info(
    "request-email-otp.succeeded",
    {
      emailHint: maskEmail(normalizedEmail),
    },
    "Requested email OTP",
  );
}

export async function signInWithEmailCode(
  email: string,
  code: string,
): Promise<CurrentAuthUser> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeEmailOtpCode(code);
  authLogger.info(
    "sign-in.email-code.started",
    {
      emailHint: maskEmail(normalizedEmail),
    },
    "Starting email code sign-in",
  );

  if (!normalizedCode) {
    authLogger.warn(
      "sign-in.email-code.missing-code",
      {
        emailHint: maskEmail(normalizedEmail),
      },
      "Email code sign-in failed because code is missing",
    );
    throw new Error("请输入邮箱验证码");
  }

  let verifiedAuth: SupabaseAuthResponse;
  let isFirstTimeEmailSignup = false;

  try {
    verifiedAuth = await requestSupabase<SupabaseAuthResponse>({
      body: {
        email: normalizedEmail,
        token: normalizedCode,
        type: "email",
      },
      path: "verify",
      service: "auth",
    });
  } catch (error) {
    try {
      verifiedAuth = await requestSupabase<SupabaseAuthResponse>({
        body: {
          email: normalizedEmail,
          token: normalizedCode,
          type: "signup",
        },
        path: "verify",
        service: "auth",
      });
      isFirstTimeEmailSignup = true;
      authLogger.info(
        "sign-in.email-code.signup-fallback",
        {
          emailHint: maskEmail(normalizedEmail),
        },
        "Email code sign-in fell back to signup verification",
      );
    } catch (signupError) {
      if (isInvalidOtpError(error) || isInvalidOtpError(signupError)) {
        authLogger.warn(
          "sign-in.email-code.invalid-otp",
          {
            emailHint: maskEmail(normalizedEmail),
          },
          "Email code sign-in failed because OTP is invalid or expired",
        );
        throw new Error("验证码不正确或已过期，请重新发送后再试。");
      }

      authLogger.error(
        "sign-in.email-code.failed",
        {
          emailHint: maskEmail(normalizedEmail),
          error,
          signupError,
        },
        "Email code sign-in failed",
      );
      throw error;
    }
  }

  const verifiedUser = verifiedAuth.user;

  if (!verifiedUser || !normalizeString(verifiedUser.id)) {
    throw new Error("邮箱验证码验证成功，但没有返回用户信息。");
  }

  const profile = await fetchSupabaseProfile(verifiedAuth);
  const nextState = mergeVerifiedEmailAuthState(
    await getAuthState(),
    verifiedAuth,
    verifiedUser,
    normalizedEmail,
    {
      passwordSetupRecommended: isFirstTimeEmailSignup,
      profile,
    },
  );

  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "sign-in.email-code.failed-no-session",
      {
        emailHint: maskEmail(normalizedEmail),
      },
      "Email code sign-in finished without a current user",
    );
    throw new Error("Failed to create email session.");
  }

  authLogger.info(
    "sign-in.email-code.succeeded",
    {
      isFirstTimeEmailSignup,
      userId: nextCurrentUser.user.id,
    },
    "Signed in with email code",
  );

  if (nextCurrentUser.session.accessToken) {
    void refreshCurrentUserIdentities(nextCurrentUser.session);
  }

  return nextCurrentUser;
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<CurrentAuthUser> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);
  authLogger.info(
    "sign-in.email-password.started",
    {
      emailHint: maskEmail(normalizedEmail),
    },
    "Starting email password sign-in",
  );

  let verifiedAuth: SupabaseAuthResponse;

  try {
    verifiedAuth = await requestSupabase<SupabaseAuthResponse>({
      body: {
        email: normalizedEmail,
        password: normalizedPassword,
      },
      path: "token?grant_type=password",
      service: "auth",
    });
  } catch (error) {
    if (isInvalidPasswordSignInError(error)) {
      authLogger.warn(
        "sign-in.email-password.invalid-credentials",
        {
          emailHint: maskEmail(normalizedEmail),
        },
        "Email password sign-in failed because credentials are invalid",
      );
      throw new Error("邮箱或密码不正确，请检查后再试。");
    }

    authLogger.error(
      "sign-in.email-password.failed",
      {
        emailHint: maskEmail(normalizedEmail),
        error,
      },
      "Email password sign-in failed",
    );
    throw error;
  }

  const verifiedUser = verifiedAuth.user;

  if (!verifiedUser || !normalizeString(verifiedUser.id)) {
    throw new Error("邮箱密码登录成功，但没有返回用户信息。");
  }

  const profile = await fetchSupabaseProfile(verifiedAuth);
  const nextState = mergePasswordEmailAuthState(
    await getAuthState(),
    verifiedAuth,
    verifiedUser,
    normalizedEmail,
    {
      profile,
    },
  );

  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "sign-in.email-password.failed-no-session",
      {
        emailHint: maskEmail(normalizedEmail),
      },
      "Email password sign-in finished without a current user",
    );
    throw new Error("Failed to create email password session.");
  }

  authLogger.info(
    "sign-in.email-password.succeeded",
    {
      userId: nextCurrentUser.user.id,
    },
    "Signed in with email password",
  );

  if (nextCurrentUser.session.accessToken) {
    void refreshCurrentUserIdentities(nextCurrentUser.session);
  }

  return nextCurrentUser;
}

export async function signInWithPhonePassword(
  phone: string,
  password: string,
): Promise<CurrentAuthUser> {
  const normalizedPhone = normalizeMainlandPhone(phone);
  const normalizedPassword = normalizePassword(password);
  authLogger.info(
    "sign-in.phone-password.started",
    {
      phoneHint: maskPhone(normalizedPhone),
    },
    "Starting phone password sign-in",
  );

  let verifiedAuth: SupabaseAuthResponse;

  try {
    verifiedAuth = await requestSupabase<SupabaseAuthResponse>({
      body: {
        phone: normalizedPhone,
        password: normalizedPassword,
      },
      path: "phone-password-login",
      service: "functions",
    });
  } catch (error) {
    if (isInvalidPasswordSignInError(error)) {
      authLogger.warn(
        "sign-in.phone-password.invalid-credentials",
        {
          phoneHint: maskPhone(normalizedPhone),
        },
        "Phone password sign-in failed because credentials are invalid",
      );
      throw new Error("手机号或密码不正确，请检查后再试。");
    }

    authLogger.error(
      "sign-in.phone-password.failed",
      {
        phoneHint: maskPhone(normalizedPhone),
        error,
      },
      "Phone password sign-in failed",
    );
    throw error;
  }

  const verifiedUser = verifiedAuth.user;

  if (!verifiedUser || !normalizeString(verifiedUser.id)) {
    throw new Error("手机号密码登录成功，但没有返回用户信息。");
  }

  const profile = await fetchSupabaseProfile(verifiedAuth);
  const nextState = mergePasswordPhoneAuthState(
    await getAuthState(),
    verifiedAuth,
    verifiedUser,
    normalizedPhone,
    {
      profile,
    },
  );

  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "sign-in.phone-password.failed-no-session",
      {
        phoneHint: maskPhone(normalizedPhone),
      },
      "Phone password sign-in finished without a current user",
    );
    throw new Error("Failed to create phone password session.");
  }

  authLogger.info(
    "sign-in.phone-password.succeeded",
    {
      userId: nextCurrentUser.user.id,
    },
    "Signed in with phone password",
  );

  if (nextCurrentUser.session.accessToken) {
    void refreshCurrentUserIdentities(nextCurrentUser.session);
  }

  return nextCurrentUser;
}

export async function requestPhoneOtp(phone: string): Promise<void> {
  const normalizedPhone = normalizeMainlandPhone(phone);
  authLogger.info(
    "request-phone-otp.started",
    {
      phoneHint: maskPhone(normalizedPhone),
    },
    "Requesting phone OTP",
  );

  await requestSupabase<{ success?: boolean }>({
    body: {
      phone: normalizedPhone,
    },
    path: "send-sms",
    service: "functions",
  });

  authLogger.info(
    "request-phone-otp.succeeded",
    {
      phoneHint: maskPhone(normalizedPhone),
    },
    "Requested phone OTP",
  );
}

export async function signInWithPhoneCode(
  phone: string,
  code: string,
): Promise<CurrentAuthUser> {
  const normalizedPhone = normalizeMainlandPhone(phone);
  const normalizedCode = code.trim();
  authLogger.info(
    "sign-in.phone-code.started",
    {
      phoneHint: maskPhone(normalizedPhone),
    },
    "Starting phone code sign-in",
  );

  if (!normalizedCode) {
    authLogger.warn(
      "sign-in.phone-code.missing-code",
      {
        phoneHint: maskPhone(normalizedPhone),
      },
      "Phone code sign-in failed because code is missing",
    );
    throw new Error("请输入短信验证码");
  }

  const phoneLogin = await requestSupabase<{
    isNewUser?: boolean;
    token_hash?: string;
    type?: string;
    user_hint?: SupabaseAuthUser;
  }>({
    body: {
      code: normalizedCode,
      phone: normalizedPhone,
    },
    path: "phone-login",
    service: "functions",
  });
  const tokenHash = normalizeString(phoneLogin.token_hash);

  if (!tokenHash) {
    throw new Error("手机号登录失败：未获取到认证令牌。");
  }

  const userId = normalizeString(phoneLogin.user_hint?.id);
  const isNewUser = Boolean(phoneLogin.isNewUser);
  authLogger.info(
    "sign-in.phone-code.user-found",
    {
      phoneHint: maskPhone(normalizedPhone),
      userId,
      isNewUser,
    },
    "Found or created user for phone",
  );

  const verifiedAuth = await verifyTokenHash(tokenHash);
  const verifiedUser = verifiedAuth.user ?? phoneLogin.user_hint;

  if (!verifiedUser || !normalizeString(verifiedUser.id)) {
    throw new Error("短信验证码验证成功，但没有返回用户信息。");
  }

  const profile = await fetchSupabaseProfile(verifiedAuth);
  const nextState = mergeVerifiedPhoneAuthState(
    await getAuthState(),
    verifiedAuth,
    verifiedUser,
    normalizedPhone,
    {
      profile,
    },
  );

  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "sign-in.phone-code.failed-no-session",
      {
        phoneHint: maskPhone(normalizedPhone),
      },
      "Phone code sign-in finished without a current user",
    );
    throw new Error("Failed to create phone session.");
  }

  authLogger.info(
    "sign-in.phone-code.succeeded",
    {
      isNewUser,
      userId: nextCurrentUser.user.id,
    },
    "Signed in with phone code",
  );

  if (nextCurrentUser.session.accessToken) {
    void refreshCurrentUserIdentities(nextCurrentUser.session);
  }

  return nextCurrentUser;
}

export async function signInWithWechat(
  nativeCode?: string,
): Promise<CurrentAuthUser> {
  const normalizedCode = normalizeString(nativeCode);
  authLogger.info(
    "sign-in.wechat.started",
    {
      hasNativeCode: Boolean(normalizedCode),
    },
    "Starting WeChat sign-in",
  );

  if (!normalizedCode) {
    authLogger.warn(
      "sign-in.wechat.missing-code",
      {},
      "WeChat sign-in failed because native code is missing",
    );
    throw new Error(
      "微信开放平台移动应用审核通过后，需要先从原生微信 SDK 获取授权 code。",
    );
  }

  const wechatResult = await requestSupabase<{
    success: boolean;
    isNewUser: boolean;
    openid: string;
    token_hash: string;
    unionid?: string;
    userId: string;
    nickname?: string;
    avatar_url?: string;
    type?: string;
    error?: string;
  }>({
    body: {
      code: normalizedCode,
    },
    path: "wechat-login",
    service: "functions",
  });

  if (
    !wechatResult.success ||
    !wechatResult.openid ||
    !wechatResult.token_hash ||
    !wechatResult.userId
  ) {
    throw new Error(wechatResult.error || "微信登录失败，无法创建登录会话");
  }

  const providerUid = wechatResult.unionid || wechatResult.openid;
  authLogger.info(
    "sign-in.wechat.user-found",
    {
      providerUid,
      userId: wechatResult.userId,
      isNewUser: wechatResult.isNewUser,
    },
    "Found or created user for WeChat",
  );

  const verifiedAuth = await verifyTokenHash(wechatResult.token_hash);
  const verifiedUser = verifiedAuth.user;

  if (!verifiedUser || !normalizeString(verifiedUser.id)) {
    throw new Error("微信登录成功，但没有返回用户信息。");
  }

  if (verifiedUser.id !== wechatResult.userId) {
    throw new Error("微信登录返回的用户信息不一致，请重试。");
  }

  const profile = await fetchSupabaseProfile(verifiedAuth);
  const nextState = mergeVerifiedWechatAuthState(
    await getAuthState(),
    verifiedAuth,
    verifiedUser,
    {
      profile,
    },
  );

  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "sign-in.wechat.failed-no-session",
      {},
      "WeChat sign-in finished without a current user",
    );
    throw new Error("Failed to create WeChat session.");
  }

  authLogger.info(
    "sign-in.wechat.succeeded",
    {
      isNewUser: wechatResult.isNewUser,
      userId: nextCurrentUser.user.id,
    },
    "Signed in with WeChat",
  );

  if (nextCurrentUser.session.accessToken) {
    void refreshCurrentUserIdentities(nextCurrentUser.session);
  }

  return nextCurrentUser;
}

function createUserFromSupabaseApple(
  user: SupabaseAuthUser,
  fullName?: string,
): UserProfile {
  const now = new Date().toISOString();
  const displayName =
    normalizeString(user.user_metadata?.full_name) ??
    normalizeString(user.user_metadata?.name) ??
    normalizeString(fullName) ??
    "Apple 用户";
  const createdAt = normalizeString(user.created_at) ?? now;

  return {
    id: normalizeString(user.id) ?? createId("user"),
    displayName,
    createdAt,
    updatedAt: normalizeString(user.updated_at) ?? now,
  };
}

function mergeVerifiedAppleAuthState(
  state: AuthState,
  verifiedAuth: SupabaseAuthResponse,
  verifiedUser: SupabaseAuthUser,
  options?: { profile?: SupabaseProfileRow; fullName?: string },
): AuthState {
  const user = applySupabaseProfileToUser(
    createUserFromSupabaseApple(verifiedUser, options?.fullName),
    options?.profile,
  );
  const providerUid =
    normalizeString(verifiedUser.user_metadata?.sub) ??
    normalizeString(verifiedUser.id) ??
    user.id;
  const existingUser = state.users.find((item) => item.id === user.id);
  const existingAppleIdentity = state.identities.find(
    (identity) =>
      identity.provider === "apple" && identity.providerUid === providerUid,
  );
  const nextUsers = existingUser
    ? state.users.map((item) =>
        item.id === user.id
          ? mergeSupabaseUserIntoExistingUser(item, user)
          : item,
      )
    : [user, ...state.users];
  const appleIdentity = existingAppleIdentity
    ? touchIdentity(existingAppleIdentity)
    : createIdentity(user.id, "apple", providerUid, "Apple");
  const nextIdentities = existingAppleIdentity
    ? state.identities.map((identity) =>
        identity.id === existingAppleIdentity.id ? appleIdentity : identity,
      )
    : [
        appleIdentity,
        ...state.identities.filter(
          (identity) => identity.id !== appleIdentity.id,
        ),
      ];

  return {
    users: nextUsers,
    identities: nextIdentities,
    session: createSession(user.id, {
      accessToken: verifiedAuth.access_token,
      refreshToken: verifiedAuth.refresh_token,
    }),
  };
}

export async function signInWithApple(
  identityToken: string,
  fullName?: string,
): Promise<CurrentAuthUser> {
  const normalizedToken = normalizeString(identityToken);
  authLogger.info(
    "sign-in.apple.started",
    {
      hasToken: Boolean(normalizedToken),
    },
    "Starting Apple sign-in",
  );

  if (!normalizedToken) {
    authLogger.warn(
      "sign-in.apple.missing-token",
      {},
      "Apple sign-in failed because identity token is missing",
    );
    throw new Error("Apple 登录失败：未获取到身份令牌。");
  }

  const verifiedAuth = await requestSupabase<SupabaseAuthResponse>({
    body: {
      id_token: normalizedToken,
      provider: "apple",
    },
    path: "token?grant_type=id_token",
    service: "auth",
  });
  const verifiedUser = verifiedAuth.user;

  if (!verifiedUser || !normalizeString(verifiedUser.id)) {
    throw new Error("Apple 登录成功，但没有返回用户信息。");
  }

  const profile = await fetchSupabaseProfile(verifiedAuth);
  const nextState = mergeVerifiedAppleAuthState(
    await getAuthState(),
    verifiedAuth,
    verifiedUser,
    {
      profile,
      fullName,
    },
  );

  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "sign-in.apple.failed-no-session",
      {},
      "Apple sign-in finished without a current user",
    );
    throw new Error("Failed to create Apple session.");
  }

  authLogger.info(
    "sign-in.apple.succeeded",
    {
      userId: nextCurrentUser.user.id,
    },
    "Signed in with Apple",
  );

  if (nextCurrentUser.session.accessToken) {
    void refreshCurrentUserIdentities(nextCurrentUser.session);
  }

  return nextCurrentUser;
}

export async function updateCurrentUserProfile(
  input: UpdateUserProfileInput,
): Promise<CurrentAuthUser> {
  authLogger.info(
    "profile.update.started",
    {
      fields: Object.keys(input).sort(),
    },
    "Starting profile update",
  );
  const state = await getAuthState();
  let currentUser = getCurrentUserFromState(state);

  if (!currentUser) {
    authLogger.warn(
      "profile.update.no-user",
      {},
      "Profile update aborted because no user is signed in",
    );
    throw new Error("请先登录");
  }

  let nextSession = state.session;

  if (shouldRefreshSupabaseSession(currentUser.session)) {
    const refreshedSession = await refreshSupabaseSession(currentUser.session);

    currentUser = {
      ...currentUser,
      session: refreshedSession,
    };
    nextSession = refreshedSession;
  }

  const nextUsers = state.users.map((user) =>
    user.id === currentUser.user.id
      ? {
          ...user,
          avatarOffsetX: normalizeAvatarOffset(input.avatarOffsetX),
          avatarOffsetY: normalizeAvatarOffset(input.avatarOffsetY),
          avatarScale: normalizeAvatarScale(input.avatarScale),
          avatarUrl: normalizeString(input.avatarUrl),
          bio: normalizeString(input.bio),
          displayName: normalizeString(input.displayName) ?? user.displayName,
          homeCity: normalizeString(input.homeCity),
          updatedAt: new Date().toISOString(),
        }
      : user,
  );

  try {
    await syncCurrentProfileToSupabase(currentUser, input);
  } catch (error) {
    if (!isExpiredJwtError(error)) {
      throw error;
    }

    const refreshedSession = await refreshSupabaseSession(currentUser.session);

    await syncCurrentProfileToSupabase(
      {
        ...currentUser,
        session: refreshedSession,
      },
      input,
    );
    nextSession = refreshedSession;
  }

  const nextState = {
    ...state,
    session: nextSession,
    users: nextUsers,
  };
  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "profile.update.failed-no-user",
      {
        userId: currentUser.user.id,
      },
      "Profile update finished without a current user",
    );
    throw new Error("Failed to update profile.");
  }

  authLogger.info(
    "profile.update.succeeded",
    {
      userId: nextCurrentUser.user.id,
    },
    "Updated current user profile",
  );
  return nextCurrentUser;
}

export async function setCurrentUserPassword(
  password: string,
): Promise<CurrentAuthUser> {
  const normalizedPassword = normalizePassword(password);
  authLogger.info(
    "password.update.started",
    {
      passwordLength: normalizedPassword.length,
    },
    "Starting password update",
  );
  const state = await getAuthState();
  let currentUser = getCurrentUserFromState(state);

  if (!currentUser) {
    authLogger.warn(
      "password.update.no-user",
      {},
      "Password update aborted because no user is signed in",
    );
    throw new Error("请先登录");
  }

  let nextSession = state.session;

  if (shouldRefreshSupabaseSession(currentUser.session)) {
    const refreshedSession = await refreshSupabaseSession(currentUser.session);

    currentUser = {
      ...currentUser,
      session: refreshedSession,
    };
    nextSession = refreshedSession;
  }

  if (!currentUser.session.accessToken) {
    authLogger.warn(
      "password.update.no-access-token",
      {
        userId: currentUser.user.id,
      },
      "Password update aborted because access token is missing",
    );
    throw new Error("登录状态已过期，请重新登录后再设置密码");
  }

  try {
    await requestSupabase<SupabaseAuthResponse>({
      accessToken: currentUser.session.accessToken,
      body: {
        data: {
          waylog_has_password: true,
        },
        password: normalizedPassword,
      },
      method: "PUT",
      path: "user",
      service: "auth",
    });
  } catch (error) {
    if (!isExpiredJwtError(error)) {
      throw error;
    }

    const refreshedSession = await refreshSupabaseSession(currentUser.session);

    await requestSupabase<SupabaseAuthResponse>({
      accessToken: refreshedSession.accessToken,
      body: {
        data: {
          waylog_has_password: true,
        },
        password: normalizedPassword,
      },
      method: "PUT",
      path: "user",
      service: "auth",
    });
    nextSession = refreshedSession;
  }

  const nextState = {
    ...state,
    identities: state.identities.map((identity) =>
      identity.userId === currentUser.user.id &&
      (identity.provider === "email" || identity.provider === "phone")
        ? {
            ...identity,
            hasPassword: true,
          }
        : identity,
    ),
    session: nextSession
      ? {
          ...nextSession,
          passwordSetupDismissedAt: new Date().toISOString(),
          passwordSetupRecommended: false,
        }
      : nextSession,
  };
  await saveAuthState(nextState);
  const nextCurrentUser = getCurrentUserFromState(nextState);

  if (!nextCurrentUser) {
    authLogger.error(
      "password.update.failed-no-user",
      {
        userId: currentUser.user.id,
      },
      "Password update finished without a current user",
    );
    throw new Error("Failed to update password.");
  }

  authLogger.info(
    "password.update.succeeded",
    {
      userId: nextCurrentUser.user.id,
    },
    "Updated current user password",
  );
  return nextCurrentUser;
}

export async function dismissPasswordSetupPrompt(): Promise<CurrentAuthUser | null> {
  authLogger.info(
    "password-setup.dismiss.started",
    {},
    "Dismissing password setup prompt",
  );
  const state = await getAuthState();

  if (!state.session) {
    return getCurrentUserFromState(state);
  }

  const nextState = {
    ...state,
    session: {
      ...state.session,
      passwordSetupDismissedAt: new Date().toISOString(),
      passwordSetupRecommended: false,
    },
  };

  await saveAuthState(nextState);

  authLogger.info(
    "password-setup.dismiss.succeeded",
    {
      userId: nextState.session?.userId ?? null,
    },
    "Dismissed password setup prompt",
  );
  return getCurrentUserFromState(nextState);
}

export async function bindWechatToCurrentUser(
  nativeCode: string,
): Promise<BindWechatResult> {
  const normalizedCode = normalizeString(nativeCode);
  authLogger.info(
    "bind.wechat.started",
    {
      hasNativeCode: Boolean(normalizedCode),
    },
    "Starting WeChat bind",
  );

  if (!normalizedCode) {
    throw new Error("请先从微信获取授权码");
  }

  const state = await getAuthState();
  const currentUser = getCurrentUserFromState(state);

  if (!currentUser) {
    throw new Error("请先登录");
  }

  let session = currentUser.session;

  if (shouldRefreshSupabaseSession(session)) {
    session = await refreshSupabaseSession(session);
  }

  const result = await requestSupabase<BindWechatResult>({
    accessToken: session.accessToken,
    body: { code: normalizedCode },
    path: "bind-wechat",
    service: "functions",
  });

  if ("success" in result && result.success) {
    authLogger.info(
      "bind.wechat.succeeded",
      {
        userId: currentUser.user.id,
        alreadyBound: result.already_bound,
      },
      "WeChat bound successfully",
    );

    await refreshCurrentUserIdentities(session);
  }

  return result;
}

export type BindPhoneResult =
  | { success: true; already_bound: boolean }
  | {
      conflict: true;
      conflict_user_id: string;
      display_name: string;
      merge_token: string;
    };

export async function bindPhoneToCurrentUser(
  phone: string,
  code: string,
): Promise<BindPhoneResult> {
  const normalizedPhone = normalizeMainlandPhone(phone);
  const normalizedCode = code.trim();
  authLogger.info(
    "bind.phone.started",
    {
      phoneHint: maskPhone(normalizedPhone),
    },
    "Starting phone bind",
  );

  if (!/^\d{4,6}$/.test(normalizedCode)) {
    throw new Error("请输入正确的短信验证码");
  }

  const state = await getAuthState();
  const currentUser = getCurrentUserFromState(state);

  if (!currentUser) {
    throw new Error("请先登录");
  }

  let session = currentUser.session;

  if (shouldRefreshSupabaseSession(session)) {
    session = await refreshSupabaseSession(session);
  }

  if (!session.accessToken) {
    throw new Error("登录状态已过期，请重新登录");
  }

  const result = await requestSupabase<BindPhoneResult>({
    accessToken: session.accessToken,
    body: {
      code: normalizedCode,
      phone: normalizedPhone,
    },
    path: "bind-phone",
    service: "functions",
  });

  if ("conflict" in result && result.conflict) {
    authLogger.warn(
      "bind.phone.conflict",
      {
        conflictUserId: result.conflict_user_id,
        phoneHint: maskPhone(normalizedPhone),
      },
      "Phone bind conflict: already bound to another user",
    );
    return result;
  }

  authLogger.info(
    "bind.phone.succeeded",
    {
      userId: currentUser.user.id,
      alreadyBound: "already_bound" in result ? result.already_bound : false,
    },
    "Phone bound successfully",
  );

  await refreshCurrentUserIdentities(session);

  return result;
}

export type BindEmailResult =
  | { success: true; already_bound: boolean }
  | {
      conflict: true;
      conflict_user_id: string;
      display_name: string;
      merge_token: string;
    };

export async function bindEmailToCurrentUser(
  email: string,
  code: string,
): Promise<BindEmailResult> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeEmailOtpCode(code);
  authLogger.info(
    "bind.email.started",
    {
      emailHint: maskEmail(normalizedEmail),
    },
    "Starting email bind",
  );

  if (!normalizedEmail) {
    throw new Error("请输入邮箱地址");
  }

  if (!normalizedCode) {
    throw new Error("请输入验证码");
  }

  const state = await getAuthState();
  const currentUser = getCurrentUserFromState(state);

  if (!currentUser) {
    throw new Error("请先登录");
  }

  let session = currentUser.session;

  if (shouldRefreshSupabaseSession(session)) {
    session = await refreshSupabaseSession(session);
  }

  if (!session.accessToken) {
    throw new Error("登录状态已过期，请重新登录");
  }

  let verifiedEmailAuth: SupabaseAuthResponse;

  try {
    verifiedEmailAuth = await requestSupabase<SupabaseAuthResponse>({
      body: {
        email: normalizedEmail,
        token: normalizedCode,
        type: "email",
      },
      path: "verify",
      service: "auth",
    });
  } catch (error) {
    try {
      verifiedEmailAuth = await requestSupabase<SupabaseAuthResponse>({
        body: {
          email: normalizedEmail,
          token: normalizedCode,
          type: "signup",
        },
        path: "verify",
        service: "auth",
      });
    } catch (signupError) {
      authLogger.error(
        "bind.email.verify-failed",
        {
          emailHint: maskEmail(normalizedEmail),
          error,
          signupError,
        },
        "Email verification failed",
      );
      throw new Error("验证码不正确或已过期，请重新发送后再试。");
    }
  }

  const emailAccessToken = normalizeString(verifiedEmailAuth.access_token);

  if (!emailAccessToken) {
    throw new Error("邮箱验证成功，但没有返回访问令牌。");
  }

  const result = await requestSupabase<BindEmailResult>({
    accessToken: session.accessToken,
    body: {
      emailAccessToken,
    },
    path: "bind-email",
    service: "functions",
  });

  if ("conflict" in result && result.conflict) {
    authLogger.warn(
      "bind.email.conflict",
      {
        conflictUserId: result.conflict_user_id,
        emailHint: maskEmail(normalizedEmail),
      },
      "Email bind conflict: already bound to another user",
    );
    return result;
  }

  authLogger.info(
    "bind.email.succeeded",
    {
      userId: currentUser.user.id,
      alreadyBound: "success" in result ? result.already_bound : false,
    },
    "Email bound successfully",
  );

  await refreshCurrentUserIdentities(session);

  return result;
}

export async function mergeWithAccount(
  secondaryId: string,
  mergeToken: string,
): Promise<boolean> {
  authLogger.info(
    "merge.started",
    {
      secondaryId,
    },
    "Starting account merge",
  );

  const state = await getAuthState();
  const currentUser = getCurrentUserFromState(state);

  if (!currentUser) {
    throw new Error("请先登录");
  }

  let session = currentUser.session;

  if (shouldRefreshSupabaseSession(session)) {
    session = await refreshSupabaseSession(session);
  }

  const result = await requestSupabase<{ success?: boolean; error?: string }>({
    accessToken: session.accessToken,
    body: {
      merge_token: mergeToken,
      primary_id: currentUser.user.id,
      secondary_id: secondaryId,
    },
    path: "merge-accounts",
    service: "functions",
  });

  if (result.error) {
    throw new Error(result.error);
  }

  if (result.success) {
    authLogger.info(
      "merge.succeeded",
      {
        primaryId: currentUser.user.id,
        secondaryId,
      },
      "Account merge completed",
    );

    await refreshCurrentUserIdentities(session);
  }

  return Boolean(result.success);
}

export async function refreshCurrentUserIdentities(
  session: AuthSession,
): Promise<void> {
  if (!session.userId || !session.accessToken) {
    return;
  }

  const state = await getAuthState();

  try {
    const response = await requestSupabase<SupabaseAuthUser>({
      accessToken: session.accessToken,
      method: "GET",
      path: "user",
      service: "auth",
    });

    if (!response?.id) {
      return;
    }

    const now = new Date().toISOString();
    const mappedIdentities: AuthIdentity[] = [];

    const previousIdentities = state.identities.filter(
      (identity) => identity.userId === session.userId,
    );
    const hasPassword =
      response.user_metadata?.waylog_has_password === true ||
      previousIdentities.some((identity) => identity.hasPassword === true);

    if (Array.isArray(response.identities)) {
      for (const identity of response.identities) {
        const provider = identity.provider as AuthProvider;
        const identityEmail =
          (identity.identity_data?.email as string | undefined) ??
          (provider === "email" ? identity.provider_id : undefined);
        const identityPhone =
          (identity.identity_data?.phone as string | undefined) ??
          (provider === "phone" ? (response.phone ?? undefined) : undefined);
        const providerUid =
          provider === "email"
            ? identityEmail
            : provider === "phone"
              ? identityPhone
              : identity.provider_id;

        if (
          ["email", "phone", "wechat", "apple"].includes(provider) &&
          providerUid &&
          !(provider === "email" && isInternalAuthEmail(identityEmail))
        ) {
          mappedIdentities.push({
            createdAt: identity.created_at ?? now,
            id: identity.id,
            label:
              (identity.identity_data?.email as string) ??
              (identity.identity_data?.phone as string) ??
              response.email ??
              response.phone ??
              "",
            lastLoginAt: identity.updated_at ?? now,
            provider,
            providerUid,
            userId: identity.user_id,
            hasPassword:
              provider === "email" || provider === "phone"
                ? hasPassword
                : undefined,
          });
        }
      }
    }

    const customIdentities = await requestSupabase<
      {
        id: string;
        user_id: string;
        provider: string;
        provider_uid: string;
        display_name?: string | null;
        created_at?: string;
      }[]
    >({
      accessToken: session.accessToken,
      method: "GET",
      path: `user_identities?user_id=eq.${encodeURIComponent(session.userId)}&select=id,user_id,provider,provider_uid,display_name,created_at`,
      service: "rest",
    });

    if (Array.isArray(customIdentities)) {
      for (const identity of customIdentities) {
        const provider =
          identity.provider === "sms_phone"
            ? "phone"
            : (identity.provider as AuthProvider);

        if (
          ["phone", "wechat"].includes(provider) &&
          !mappedIdentities.some(
            (i) =>
              i.provider === provider &&
              i.providerUid === identity.provider_uid,
          )
        ) {
          mappedIdentities.push({
            createdAt: identity.created_at ?? now,
            id: identity.id,
            label:
              normalizeString(identity.display_name) ?? identity.provider_uid,
            lastLoginAt: identity.created_at ?? now,
            provider,
            providerUid: identity.provider_uid,
            userId: identity.user_id,
            hasPassword:
              provider === "email" || provider === "phone"
                ? hasPassword
                : undefined,
          });
        }
      }
    }

    if (
      response.phone &&
      !mappedIdentities.some((i) => i.provider === "phone")
    ) {
      mappedIdentities.push({
        createdAt: response.created_at ?? now,
        id: `phone-${response.id}`,
        label: response.phone,
        lastLoginAt: response.updated_at ?? now,
        provider: "phone",
        providerUid: response.phone,
        userId: response.id,
        hasPassword,
      });
    }

    if (
      response.email &&
      !isInternalAuthEmail(response.email) &&
      !mappedIdentities.some((i) => i.provider === "email")
    ) {
      mappedIdentities.push({
        createdAt: response.created_at ?? now,
        id: `email-${response.id}`,
        label: response.email,
        lastLoginAt: response.updated_at ?? now,
        provider: "email",
        providerUid: response.email,
        userId: response.id,
        hasPassword,
      });
    }

    const latestState = await getAuthState();
    const latestSession = latestState.session;

    if (
      latestSession?.userId !== session.userId ||
      latestSession.accessToken !== session.accessToken
    ) {
      authLogger.info(
        "refresh-identities.skipped-stale-session",
        {
          requestedUserId: session.userId,
          currentUserId: latestSession?.userId ?? null,
        },
        "Skipped stale identity refresh result",
      );
      return;
    }

    const nextState = {
      ...latestState,
      identities: [
        ...latestState.identities.filter((i) => i.userId !== session.userId),
        ...mappedIdentities,
      ],
      session: latestSession,
    };

    await saveAuthState(nextState);
    authLogger.info(
      "refresh-identities.succeeded",
      {
        count: mappedIdentities.length,
        hasPassword,
        providers: mappedIdentities.map((i) => i.provider).join(","),
      },
      "Refreshed identities from Supabase",
    );
  } catch (error) {
    authLogger.error(
      "refresh-identities.failed",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to refresh identities",
    );
  }
}

export async function signOut(): Promise<void> {
  const state = await getAuthState();
  const currentUser = getCurrentUserFromState(state);
  authLogger.info(
    "sign-out.started",
    {
      isCloudBacked: isCloudBackedCurrentUser(currentUser),
      userId: currentUser?.user.id ?? null,
    },
    "Starting sign-out",
  );

  if (currentUser?.user.id) {
    clearAgentRuntimeForAccount(currentUser.user.id);
  }

  await saveAuthState({
    ...state,
    session: null,
  });

  const storage = await getAuthStorage();

  if (isCloudBackedCurrentUser(currentUser)) {
    await clearAllLocalAppData(storage);
  } else {
    await clearLocalSyncMetadata(storage);
  }

  try {
    const [
      { clearAllCache: clearPlaceCache },
      { clearRouteSegmentCache },
      { emitTripsUpdated },
    ] = await Promise.all([
      import("../trips/place-cache.js"),
      import("../trips/route-segments.js"),
      import("../trips/events.js"),
    ]);
    await Promise.all([clearPlaceCache(), clearRouteSegmentCache()]);
    emitTripsUpdated();
  } catch (error) {
    authLogger.warn(
      "sign-out.cache-clear-failed",
      { error },
      "Signed out but could not clear in-memory trip caches",
    );
  }

  authLogger.info(
    "sign-out.succeeded",
    {
      userId: currentUser?.user.id ?? null,
    },
    "Signed out and cleared all local data",
  );
}
