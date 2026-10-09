import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type {
  AdminFeedbackAuditLog,
  AdminFeedbackDetail,
  AdminFeedbackItem,
  AdminFeedbackSeverity,
  AdminFeedbackStatus,
} from "@/lib/admin-feedback-types";

export const adminFeedbackStatuses: AdminFeedbackStatus[] = [
  "pending",
  "in_progress",
  "resolved",
  "ignored",
];

export const adminFeedbackSeverities: AdminFeedbackSeverity[] = [
  "normal",
  "important",
  "blocking",
];

type FeedbackAdminRow = {
  admin_note?: string | null;
  app_version?: string | null;
  assigned_to?: string | null;
  contact_method?: string | null;
  contact_value?: string | null;
  created_at: string;
  description: string;
  device_info?: unknown;
  diagnostic_context?: string | null;
  handled_at?: string | null;
  handled_by?: string | null;
  id: string;
  platform?: string | null;
  related_agent_call_id?: number | null;
  related_poi_id?: string | null;
  related_trip_id?: string | null;
  reply_message?: string | null;
  resolved_at?: string | null;
  severity?: string | null;
  source_page?: string | null;
  status?: string | null;
  updated_at?: string | null;
  user_id?: string | null;
};

type ProfileRow = {
  display_name: string | null;
  id: string;
};

type AuthUserMapItem = {
  email: string | null;
  phone: string | null;
};

type AdminAuditLogRow = {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  id: number;
  payload: unknown;
};

export type AdminFeedbackMutationContext = {
  adminClient: SupabaseClient;
  request: NextRequest;
  user: User;
};

export function mapFeedbackRow(
  row: FeedbackAdminRow,
  users: Map<string, AuthUserMapItem> = new Map(),
  profiles: Map<string, ProfileRow> = new Map(),
): AdminFeedbackItem {
  const userId = row.user_id ?? null;
  const authUser = userId ? users.get(userId) : undefined;
  const profile = userId ? profiles.get(userId) : undefined;

  return {
    adminNote: row.admin_note ?? null,
    appVersion: row.app_version ?? null,
    assignedTo: row.assigned_to ?? null,
    contactMethod: row.contact_method ?? null,
    contactValue: row.contact_value ?? null,
    createdAt: row.created_at,
    description: row.description,
    deviceInfo: row.device_info ?? null,
    diagnosticContext: row.diagnostic_context ?? null,
    handledAt: row.handled_at ?? null,
    handledBy: row.handled_by ?? null,
    id: row.id,
    platform: row.platform ?? null,
    relatedAgentCallId: row.related_agent_call_id ?? null,
    relatedPoiId: row.related_poi_id ?? null,
    relatedTripId: row.related_trip_id ?? null,
    replyMessage: row.reply_message ?? null,
    resolvedAt: row.resolved_at ?? null,
    severity: readFeedbackSeverity(row.severity),
    sourcePage: row.source_page ?? null,
    status: readFeedbackStatus(row.status),
    updatedAt: row.updated_at ?? null,
    user: userId
      ? {
          displayName: profile?.display_name ?? null,
          email: authUser?.email ?? null,
          id: userId,
          phone: authUser?.phone ?? null,
        }
      : null,
    userId,
  };
}

export function mapFeedbackAuditLog(
  row: AdminAuditLogRow,
): AdminFeedbackAuditLog {
  return {
    action: row.action,
    actorUserId: row.actor_user_id ?? null,
    createdAt: row.created_at,
    id: row.id,
    payload: row.payload ?? {},
  };
}

export async function readFeedbackDetail(
  client: SupabaseClient,
  feedbackId: string,
): Promise<AdminFeedbackDetail | NextResponse> {
  const { data, error } = await client
    .from("feedback")
    .select("*")
    .eq("id", feedbackId)
    .maybeSingle<FeedbackAdminRow>();

  if (error) {
    return NextResponse.json(
      { error: `读取反馈失败：${error.message}` },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "没有找到这条反馈。" }, { status: 404 });
  }

  const userIds = data.user_id ? [data.user_id] : [];
  const [users, profiles, auditLogs] = await Promise.all([
    readAuthUserMap(client, userIds),
    readProfileMap(client, userIds),
    readFeedbackAuditLogs(client, feedbackId),
  ]);

  return {
    ...mapFeedbackRow(data, users, profiles),
    auditLogs,
  };
}

export async function readFeedbackAuditLogs(
  client: SupabaseClient,
  feedbackId: string,
): Promise<AdminFeedbackAuditLog[]> {
  const { data, error } = await client
    .schema("admin")
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,payload,created_at")
    .eq("target_type", "feedback")
    .eq("target_id", feedbackId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<AdminAuditLogRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapFeedbackAuditLog);
}

export async function readAuthUserMap(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, AuthUserMapItem>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(isUuid)));
  const users = new Map<string, AuthUserMapItem>();

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const {
        data: { user },
      } = await client.auth.admin.getUserById(userId);

      if (user) {
        users.set(userId, {
          email: user.email ?? null,
          phone: user.phone ?? null,
        });
      }
    }),
  );

  return users;
}

export async function readProfileMap(
  client: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileRow>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(isUuid)));
  const profiles = new Map<string, ProfileRow>();

  if (uniqueUserIds.length === 0) {
    return profiles;
  }

  const { data } = await client
    .from("profiles")
    .select("id,display_name")
    .in("id", uniqueUserIds)
    .returns<ProfileRow[]>();

  for (const profile of data ?? []) {
    profiles.set(profile.id, profile);
  }

  return profiles;
}

export async function recordFeedbackAuditLog(
  context: AdminFeedbackMutationContext,
  input: {
    action: string;
    after?: unknown;
    before?: unknown;
    targetId: string;
  },
) {
  const { error } = await context.adminClient
    .schema("admin")
    .from("admin_audit_logs")
    .insert({
      action: input.action,
      actor_user_id: context.user.id,
      ip: getRequestIp(context.request),
      payload: {
        after: input.after ?? null,
        before: input.before ?? null,
      },
      target_id: input.targetId,
      target_type: "feedback",
      user_agent: context.request.headers.get("user-agent"),
    });

  if (error) {
    throw new Error(`写入后台审计日志失败：${error.message}`);
  }
}

export function createFeedbackUpdatePatch(
  body: unknown,
  actorUserId: string,
): { ok: true; patch: Record<string, unknown> } | { error: string; ok: false } {
  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  const patch: Record<string, unknown> = {};

  if ("status" in body) {
    const status = readFeedbackStatus(body.status);

    if (status !== body.status) {
      return { error: "反馈状态不正确。", ok: false };
    }

    patch.status = status;
    patch.handled_at = new Date().toISOString();
    patch.handled_by = actorUserId;
    patch.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  }

  if ("severity" in body) {
    const severity = readFeedbackSeverity(body.severity);

    if (severity !== body.severity) {
      return { error: "严重程度不正确。", ok: false };
    }

    patch.severity = severity;
  }

  assignNullableStringPatch(patch, body, "adminNote", "admin_note");
  assignNullableStringPatch(patch, body, "replyMessage", "reply_message");
  assignNullableStringPatch(patch, body, "sourcePage", "source_page");
  assignNullableStringPatch(patch, body, "relatedPoiId", "related_poi_id");
  assignNullableStringPatch(patch, body, "relatedTripId", "related_trip_id");

  if ("assignedTo" in body) {
    const assignedTo = readNullableString(body.assignedTo);

    if (assignedTo !== null && !isUuid(assignedTo)) {
      return { error: "负责人 ID 格式不正确。", ok: false };
    }

    patch.assigned_to = assignedTo;
  }

  if ("relatedAgentCallId" in body) {
    const relatedAgentCallId = readNullableInteger(body.relatedAgentCallId);

    if (relatedAgentCallId === undefined) {
      return { error: "Agent 调用 ID 必须是数字。", ok: false };
    }

    patch.related_agent_call_id = relatedAgentCallId;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "没有可保存的字段。", ok: false };
  }

  return { ok: true, patch };
}

export function readFeedbackStatus(value: unknown): AdminFeedbackStatus {
  return adminFeedbackStatuses.includes(value as AdminFeedbackStatus)
    ? (value as AdminFeedbackStatus)
    : "pending";
}

export function readFeedbackSeverity(value: unknown): AdminFeedbackSeverity {
  return adminFeedbackSeverities.includes(value as AdminFeedbackSeverity)
    ? (value as AdminFeedbackSeverity)
    : "normal";
}

export function normalizeFeedbackId(value: string) {
  return decodeURIComponent(value).trim();
}

function assignNullableStringPatch(
  patch: Record<string, unknown>,
  body: Record<string, unknown>,
  inputKey: string,
  columnKey: string,
) {
  if (!(inputKey in body)) {
    return;
  }

  patch[columnKey] = readNullableString(body[inputKey]);
}

function readNullableString(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function readNullableInteger(value: unknown) {
  if (value === null || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isInteger(numberValue) && numberValue > 0
    ? numberValue
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const value = forwardedFor?.split(",")[0]?.trim();

  return value && /^[0-9a-f:.]+$/i.test(value) ? value : null;
}
