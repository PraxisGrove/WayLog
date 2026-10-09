import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  adminFeedbackSeverities,
  adminFeedbackStatuses,
  mapFeedbackRow,
  readAuthUserMap,
  readFeedbackSeverity,
  readFeedbackStatus,
  readProfileMap,
} from "@/lib/admin-feedback-server";
import type {
  AdminFeedbackListData,
  AdminFeedbackSeverity,
  AdminFeedbackStatus,
} from "@/lib/admin-feedback-types";
import { authorizeAdminRequest } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 80;

type FeedbackListRow = Parameters<typeof mapFeedbackRow>[0];

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q"));
  const statusParam = searchParams.get("status");
  const severityParam = searchParams.get("severity");
  const status =
    statusParam && statusParam !== "all"
      ? readFeedbackStatus(statusParam)
      : "all";
  const severity =
    severityParam && severityParam !== "all"
      ? readFeedbackSeverity(severityParam)
      : "all";
  const page = readPositiveInteger(searchParams.get("page")) ?? defaultPage;
  const pageSize = Math.min(
    readPositiveInteger(searchParams.get("pageSize")) ?? defaultPageSize,
    maxPageSize,
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const warnings: string[] = [];
  const { adminClient } = authorized.context;

  let listQuery = adminClient
    .from("feedback")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query) {
    const escapedQuery = escapePostgrestLike(query);
    listQuery = listQuery.or(
      [
        `id.ilike.*${escapedQuery}*`,
        `description.ilike.*${escapedQuery}*`,
        `contact_value.ilike.*${escapedQuery}*`,
        `contact_method.ilike.*${escapedQuery}*`,
        `platform.ilike.*${escapedQuery}*`,
        `app_version.ilike.*${escapedQuery}*`,
        `user_id.ilike.*${escapedQuery}*`,
        `related_poi_id.ilike.*${escapedQuery}*`,
        `related_trip_id.ilike.*${escapedQuery}*`,
      ].join(","),
    );
  }

  if (status !== "all") {
    listQuery = listQuery.eq("status", status);
  }

  if (severity !== "all") {
    listQuery = listQuery.eq("severity", severity);
  }

  const [{ data, error, count }, statusCounts, severityCounts] =
    await Promise.all([
      listQuery,
      readStatusCounts(adminClient, warnings),
      readSeverityCounts(adminClient, warnings),
    ]);

  if (error) {
    return NextResponse.json(
      { error: `读取反馈列表失败：${error.message}` },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as FeedbackListRow[];
  const userIds = rows
    .map((row) => row.user_id)
    .filter((value): value is string => Boolean(value));
  const [users, profiles] = await Promise.all([
    readAuthUserMap(adminClient, userIds),
    readProfileMap(adminClient, userIds),
  ]);

  const payload: AdminFeedbackListData = {
    feedback: rows.map((row) => mapFeedbackRow(row, users, profiles)),
    generatedAt: new Date().toISOString(),
    page,
    pageSize,
    query,
    severity,
    severityCounts,
    status,
    statusCounts,
    total: count ?? 0,
    warnings,
  };

  return NextResponse.json(payload);
}

async function readStatusCounts(
  client: SupabaseClient,
  warnings: string[],
): Promise<Record<AdminFeedbackStatus, number>> {
  const counts = Object.fromEntries(
    adminFeedbackStatuses.map((status) => [status, 0]),
  ) as Record<AdminFeedbackStatus, number>;

  await Promise.all(
    adminFeedbackStatuses.map(async (status) => {
      const { count, error } = await client
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", status);

      if (error) {
        warnings.push(`${status} 状态计数失败：${error.message}`);
        return;
      }

      counts[status] = count ?? 0;
    }),
  );

  return counts;
}

async function readSeverityCounts(
  client: SupabaseClient,
  warnings: string[],
): Promise<Record<AdminFeedbackSeverity, number>> {
  const counts = Object.fromEntries(
    adminFeedbackSeverities.map((severity) => [severity, 0]),
  ) as Record<AdminFeedbackSeverity, number>;

  await Promise.all(
    adminFeedbackSeverities.map(async (severity) => {
      const { count, error } = await client
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("severity", severity);

      if (error) {
        warnings.push(`${severity} 严重程度计数失败：${error.message}`);
        return;
      }

      counts[severity] = count ?? 0;
    }),
  );

  return counts;
}

function normalizeQuery(value: string | null) {
  return value?.trim().slice(0, 100) ?? "";
}

function escapePostgrestLike(value: string) {
  return value.replace(/[%*]/g, "");
}

function readPositiveInteger(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
