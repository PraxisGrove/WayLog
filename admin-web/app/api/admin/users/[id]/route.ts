import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-server";
import type {
  AdminUserCrashItem,
  AdminUserDetail,
  AdminUserFavoriteItem,
  AdminUserFeedbackItem,
  AdminUserMetric,
  AdminUserProfile,
  AdminUserProvider,
  AdminUserTripItem,
} from "@/lib/admin-users-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProfileRow = {
  avatar_url: string | null;
  bio: string | null;
  created_at: string | null;
  display_name: string | null;
  home_city: string | null;
  updated_at: string | null;
};

type IdentityRow = {
  display_name: string | null;
  provider: string;
  provider_uid: string;
};

type TripRow = {
  deleted_at: string | null;
  destination: string;
  end_date: string | null;
  id: string;
  start_date: string | null;
  status: string;
  title: string;
  updated_at: string;
  version: number;
};

type FavoriteRow = {
  area: string | null;
  category: string;
  deleted_at: string | null;
  favorited_at: string | null;
  id: string;
  name: string;
  provider_place_id: string | null;
  updated_at: string;
};

type FeedbackRow = {
  app_version: string | null;
  contact_method: string | null;
  contact_value: string | null;
  created_at: string;
  description: string;
  id: string;
  platform: string | null;
};

type CrashRow = {
  created_at: string;
  environment: string | null;
  id: string;
  level: string | null;
  release: string | null;
  sentry_url: string | null;
  title: string;
};

const oneDayMs = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { id } = await context.params;
  const userId = decodeURIComponent(id).trim();

  if (!isUuid(userId)) {
    return NextResponse.json(
      { error: "用户 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const { adminClient } = authorized.context;
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.admin.getUserById(userId);

  if (userError || !user) {
    return NextResponse.json(
      { error: userError?.message ?? "没有找到这个用户。" },
      { status: 404 },
    );
  }

  const warnings: string[] = [];
  const since3d = new Date(Date.now() - 3 * oneDayMs);
  const [
    profile,
    identities,
    trips,
    favoritePlaces,
    feedback,
    crashes,
    tripCount,
    favoriteCount,
    feedbackCount,
    crashCount,
    agentCalls3d,
    lastAgentCallAt,
  ] = await Promise.all([
    readProfile(adminClient, userId, warnings),
    readIdentities(adminClient, userId, warnings),
    readTrips(adminClient, userId, warnings),
    readFavoritePlaces(adminClient, userId, warnings),
    readFeedback(adminClient, userId, warnings),
    readCrashes(adminClient, userId, warnings),
    countRows(adminClient, warnings, {
      label: "行程数量",
      table: "user_trips",
      userId,
      withoutDeleted: true,
    }),
    countRows(adminClient, warnings, {
      label: "收藏地点",
      table: "user_favorite_places",
      userId,
      withoutDeleted: true,
    }),
    countRows(adminClient, warnings, {
      label: "反馈数量",
      table: "feedback",
      userId,
    }),
    countRows(adminClient, warnings, {
      label: "崩溃数量",
      table: "crash_reports",
      userId,
    }),
    countRows(adminClient, warnings, {
      dateColumn: "called_at",
      from: since3d,
      label: "Agent 调用",
      table: "agent_calls",
      userId,
    }),
    readLastAgentCallAt(adminClient, userId, warnings),
  ]);

  const metrics: AdminUserMetric[] = [
    {
      description: "未软删除的行程记录",
      key: "trips",
      label: "有效行程",
      value: tripCount,
    },
    {
      description: "未软删除的收藏地点",
      key: "favorites",
      label: "收藏地点",
      value: favoriteCount,
    },
    {
      description: "用户主动提交的反馈",
      key: "feedback",
      label: "反馈",
      value: feedbackCount,
    },
    {
      description: "最近 3 天通过限流的调用",
      key: "agent",
      label: "Agent 3 天",
      value: agentCalls3d,
    },
    {
      description: "Sentry webhook 写入的崩溃摘要",
      key: "crashes",
      label: "崩溃",
      value: crashCount,
    },
  ];

  const data: AdminUserDetail = {
    agentCalls: {
      lastCalledAt: lastAgentCallAt,
      total3d: agentCalls3d,
    },
    crashes,
    email: user.email ?? null,
    favoritePlaces,
    feedback,
    id: user.id,
    identities: mergeProviders(user, identities),
    lastSignInAt: user.last_sign_in_at ?? null,
    metrics,
    phone: user.phone ?? null,
    profile,
    trips,
    warnings,
  };

  return NextResponse.json(data);
}

async function readProfile(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
): Promise<AdminUserProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("display_name,avatar_url,bio,home_city,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    warnings.push(`用户资料读取失败：${error.message}`);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    avatarUrl: data.avatar_url ?? null,
    bio: data.bio ?? null,
    createdAt: data.created_at ?? null,
    displayName: data.display_name ?? null,
    homeCity: data.home_city ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

async function readIdentities(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
): Promise<AdminUserProvider[]> {
  const { data, error } = await client
    .from("user_identities")
    .select("provider,provider_uid,display_name")
    .eq("user_id", userId);

  if (error) {
    warnings.push(`自定义身份读取失败：${error.message}`);
    return [];
  }

  return ((data ?? []) as IdentityRow[]).map((row) => ({
    label: row.display_name ?? maskProviderUid(row.provider_uid),
    provider: row.provider,
  }));
}

async function readTrips(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
): Promise<AdminUserTripItem[]> {
  const { data, error } = await client
    .from("user_trips")
    .select(
      "id,title,destination,status,start_date,end_date,version,deleted_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    warnings.push(`最近行程读取失败：${error.message}`);
    return [];
  }

  return ((data ?? []) as TripRow[]).map((row) => ({
    deletedAt: row.deleted_at ?? null,
    destination: row.destination,
    endDate: row.end_date ?? null,
    id: row.id,
    startDate: row.start_date ?? null,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  }));
}

async function readFavoritePlaces(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
): Promise<AdminUserFavoriteItem[]> {
  const { data, error } = await client
    .from("user_favorite_places")
    .select(
      "id,name,category,area,provider_place_id,favorited_at,deleted_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    warnings.push(`最近收藏读取失败：${error.message}`);
    return [];
  }

  return ((data ?? []) as FavoriteRow[]).map((row) => ({
    area: row.area ?? null,
    category: row.category,
    deletedAt: row.deleted_at ?? null,
    favoritedAt: row.favorited_at ?? null,
    id: row.id,
    name: row.name,
    providerPlaceId: row.provider_place_id ?? null,
    updatedAt: row.updated_at,
  }));
}

async function readFeedback(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
): Promise<AdminUserFeedbackItem[]> {
  const { data, error } = await client
    .from("feedback")
    .select(
      "id,description,contact_method,contact_value,platform,app_version,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    warnings.push(`反馈读取失败：${error.message}`);
    return [];
  }

  return ((data ?? []) as FeedbackRow[]).map((row) => ({
    appVersion: row.app_version ?? null,
    contactMethod: row.contact_method ?? null,
    contactValue: row.contact_value ?? null,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    platform: row.platform ?? null,
  }));
}

async function readCrashes(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
): Promise<AdminUserCrashItem[]> {
  const { data, error } = await client
    .from("crash_reports")
    .select("id,title,level,environment,release,sentry_url,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    warnings.push(`崩溃报告读取失败：${error.message}`);
    return [];
  }

  return ((data ?? []) as CrashRow[]).map((row) => ({
    createdAt: row.created_at,
    environment: row.environment ?? null,
    id: row.id,
    level: row.level ?? null,
    release: row.release ?? null,
    sentryUrl: row.sentry_url ?? null,
    title: row.title,
  }));
}

async function readLastAgentCallAt(
  client: SupabaseClient,
  userId: string,
  warnings: string[],
) {
  const { data, error } = await client
    .from("agent_calls")
    .select("called_at")
    .eq("user_id", userId)
    .order("called_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ called_at: string }>();

  if (error) {
    warnings.push(`最近 Agent 调用读取失败：${error.message}`);
    return null;
  }

  return data?.called_at ?? null;
}

async function countRows(
  client: SupabaseClient,
  warnings: string[],
  options: {
    dateColumn?: string;
    from?: Date;
    label: string;
    table: string;
    userId: string;
    withoutDeleted?: boolean;
  },
) {
  let query = client
    .from(options.table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", options.userId);

  if (options.withoutDeleted) {
    query = query.is("deleted_at", null);
  }

  if (options.dateColumn && options.from) {
    query = query.gte(options.dateColumn, options.from.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    warnings.push(`${options.label}读取失败：${error.message}`);
    return 0;
  }

  return count ?? 0;
}

function mergeProviders(user: User, identities: AdminUserProvider[]) {
  const providers = new Map<string, AdminUserProvider>();

  if (user.email) {
    providers.set("email", { label: user.email, provider: "email" });
  }

  if (user.phone) {
    providers.set("phone", {
      label: maskProviderUid(user.phone),
      provider: "phone",
    });
  }

  for (const identity of user.identities ?? []) {
    const provider = identity.provider;
    const label =
      readString(identity.identity_data?.email) ??
      readString(identity.identity_data?.phone) ??
      readString(identity.identity_data?.name) ??
      provider;

    providers.set(provider, { label, provider });
  }

  for (const identity of identities) {
    providers.set(identity.provider, identity);
  }

  return Array.from(providers.values());
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function maskProviderUid(value: string) {
  if (value.length <= 6) {
    return value;
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
