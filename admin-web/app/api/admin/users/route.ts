import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-server";
import type {
  AdminUserProvider,
  AdminUsersData,
  AdminUserSummary,
} from "@/lib/admin-users-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfileRow = {
  avatar_url: string | null;
  created_at: string | null;
  display_name: string | null;
  id: string;
  updated_at: string | null;
};

type IdentityRow = {
  display_name: string | null;
  provider: string;
  provider_uid: string;
  user_id: string;
};

type IdentitySearchEntry = AdminUserProvider & {
  searchValue: string;
};

type UserMetricCounts = {
  agentCalls3d: number;
  favoritePlaces: number;
  feedbackCount: number;
  trips: number;
};

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 50;
const authScanLimit = 200;
const oneDayMs = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q"));
  const page = readPositiveInteger(searchParams.get("page")) ?? defaultPage;
  const pageSize = Math.min(
    readPositiveInteger(searchParams.get("pageSize")) ?? defaultPageSize,
    maxPageSize,
  );
  const warnings: string[] = [];
  const authPageSize = query ? authScanLimit : pageSize;
  const authPage = query ? 1 : page;
  const { adminClient } = authorized.context;
  const { data: authUsersData, error: authUsersError } =
    await adminClient.auth.admin.listUsers({
      page: authPage,
      perPage: authPageSize,
    });

  if (authUsersError) {
    return NextResponse.json(
      { error: `读取 Auth 用户失败：${authUsersError.message}` },
      { status: 500 },
    );
  }

  const scannedUsers = authUsersData.users ?? [];
  const scannedUserIds = scannedUsers.map((user) => user.id);
  const [profiles, identities] = await Promise.all([
    readProfiles(adminClient, scannedUserIds, warnings),
    readIdentities(adminClient, scannedUserIds, warnings),
  ]);

  const users = query
    ? scannedUsers.filter((user) =>
        matchesUserSearch(
          user,
          profiles.get(user.id),
          identities.get(user.id) ?? [],
          query,
        ),
      )
    : scannedUsers;
  const total = query ? users.length : (authUsersData.total ?? users.length);
  const userIds = users.map((user) => user.id);
  const metricMap = await readMetricMap(adminClient, userIds, warnings);

  const data: AdminUsersData = {
    generatedAt: new Date().toISOString(),
    page,
    pageSize,
    query,
    total,
    users: users.map((user) =>
      createUserSummary({
        identities: stripIdentitySearchValues(identities.get(user.id) ?? []),
        metrics: metricMap.get(user.id),
        profile: profiles.get(user.id),
        user,
      }),
    ),
    warnings,
  };

  return NextResponse.json(data);
}

function createUserSummary({
  identities,
  metrics,
  profile,
  user,
}: {
  identities: AdminUserProvider[];
  metrics: UserMetricCounts | undefined;
  profile: ProfileRow | undefined;
  user: User;
}): AdminUserSummary {
  return {
    agentCalls3d: metrics?.agentCalls3d ?? 0,
    avatarUrl: profile?.avatar_url ?? null,
    createdAt: user.created_at ?? profile?.created_at ?? null,
    displayName:
      profile?.display_name ??
      readString(user.user_metadata?.display_name) ??
      readString(user.user_metadata?.name) ??
      null,
    email: user.email ?? null,
    favoritePlaces: metrics?.favoritePlaces ?? 0,
    feedbackCount: metrics?.feedbackCount ?? 0,
    id: user.id,
    lastSignInAt: user.last_sign_in_at ?? null,
    phone: user.phone ?? null,
    providers: mergeProviders(user, identities),
    trips: metrics?.trips ?? 0,
    updatedAt: profile?.updated_at ?? user.updated_at ?? null,
  };
}

async function readProfiles(
  client: SupabaseClient,
  userIds: string[],
  warnings: string[],
) {
  const profiles = new Map<string, ProfileRow>();

  if (userIds.length === 0) {
    return profiles;
  }

  const { data, error } = await client
    .from("profiles")
    .select("id,display_name,avatar_url,created_at,updated_at")
    .in("id", userIds);

  if (error) {
    warnings.push(`用户资料读取失败：${error.message}`);
    return profiles;
  }

  for (const row of (data ?? []) as ProfileRow[]) {
    profiles.set(row.id, row);
  }

  return profiles;
}

async function readIdentities(
  client: SupabaseClient,
  userIds: string[],
  warnings: string[],
) {
  const identities = new Map<string, IdentitySearchEntry[]>();

  if (userIds.length === 0) {
    return identities;
  }

  const { data, error } = await client
    .from("user_identities")
    .select("user_id,provider,provider_uid,display_name")
    .in("user_id", userIds);

  if (error) {
    warnings.push(`自定义身份读取失败：${error.message}`);
    return identities;
  }

  for (const row of (data ?? []) as IdentityRow[]) {
    const list = identities.get(row.user_id) ?? [];

    list.push({
      label: row.display_name ?? maskProviderUid(row.provider_uid),
      provider: row.provider,
      searchValue: row.provider_uid,
    });
    identities.set(row.user_id, list);
  }

  return identities;
}

async function readMetricMap(
  client: SupabaseClient,
  userIds: string[],
  warnings: string[],
) {
  const metricMap = new Map<string, UserMetricCounts>();

  if (userIds.length === 0) {
    return metricMap;
  }

  for (const userId of userIds) {
    metricMap.set(userId, {
      agentCalls3d: 0,
      favoritePlaces: 0,
      feedbackCount: 0,
      trips: 0,
    });
  }

  await Promise.all([
    fillMetric(client, metricMap, warnings, {
      column: "trips",
      label: "行程数量",
      table: "user_trips",
      userIds,
    }),
    fillMetric(client, metricMap, warnings, {
      column: "favoritePlaces",
      label: "收藏地点",
      table: "user_favorite_places",
      userIds,
    }),
    fillMetric(client, metricMap, warnings, {
      column: "feedbackCount",
      label: "反馈数量",
      table: "feedback",
      userIds,
    }),
    fillMetric(client, metricMap, warnings, {
      column: "agentCalls3d",
      from: new Date(Date.now() - 3 * oneDayMs),
      label: "Agent 调用",
      table: "agent_calls",
      userIds,
    }),
  ]);

  return metricMap;
}

async function fillMetric(
  client: SupabaseClient,
  metricMap: Map<string, UserMetricCounts>,
  warnings: string[],
  options: {
    column: keyof UserMetricCounts;
    from?: Date;
    label: string;
    table: string;
    userIds: string[];
  },
) {
  for (const userId of options.userIds) {
    let query = client
      .from(options.table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (
      options.table === "user_trips" ||
      options.table === "user_favorite_places"
    ) {
      query = query.is("deleted_at", null);
    }

    if (options.from) {
      query = query.gte("called_at", options.from.toISOString());
    }

    const { count, error } = await query;

    if (error) {
      warnings.push(`${options.label}读取失败：${error.message}`);
      return;
    }

    const current = metricMap.get(userId);

    if (current) {
      current[options.column] = count ?? 0;
    }
  }
}

function matchesUserSearch(
  user: User,
  profile: ProfileRow | undefined,
  identities: IdentitySearchEntry[],
  query: string,
) {
  const values = [
    user.id,
    user.email,
    user.phone,
    readString(user.user_metadata?.display_name),
    readString(user.user_metadata?.name),
    readString(user.user_metadata?.full_name),
    profile?.display_name,
    ...identities.flatMap((identity) => [
      identity.label,
      identity.provider,
      identity.searchValue,
    ]),
  ];

  return values.some((value) => value?.toLowerCase().includes(query));
}

function stripIdentitySearchValues(identities: IdentitySearchEntry[]) {
  return identities.map((identity) => ({
    label: identity.label,
    provider: identity.provider,
  }));
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

function maskProviderUid(value: string) {
  if (value.length <= 6) {
    return value;
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function normalizeQuery(value: string | null) {
  return value?.trim().toLowerCase().slice(0, 80) ?? "";
}

function readPositiveInteger(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
