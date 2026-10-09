import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  adminPoiReviewStatuses,
  createPoiInsertPatch,
  mapPoiRow,
  readPoiDetail,
  readPoiReviewStatus,
  recordPoiAuditLog,
} from "@/lib/admin-poi-server";
import type {
  AdminPoiListData,
  AdminPoiReviewStatus,
} from "@/lib/admin-poi-types";
import { authorizeAdminRequest } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 80;

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q"));
  const category = normalizeQuery(searchParams.get("category"));
  const statusParam = searchParams.get("status");
  const reviewStatus =
    statusParam && statusParam !== "all"
      ? readPoiReviewStatus(statusParam)
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
    .from("poi_cache")
    .select("*", { count: "exact" })
    .order("updatedAt", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (query) {
    const escapedQuery = escapePostgrestLike(query);
    listQuery = listQuery.or(
      [
        `amap_poi_id.ilike.*${escapedQuery}*`,
        `name.ilike.*${escapedQuery}*`,
        `address.ilike.*${escapedQuery}*`,
        `area.ilike.*${escapedQuery}*`,
      ].join(","),
    );
  }

  if (reviewStatus !== "all") {
    listQuery = listQuery.eq("review_status", reviewStatus);
  }

  if (category) {
    listQuery = listQuery.eq("category", category);
  }

  const [{ data, error, count }, statusCounts] = await Promise.all([
    listQuery,
    readStatusCounts(adminClient, warnings),
  ]);

  if (error) {
    return NextResponse.json(
      { error: `读取 POI 列表失败：${error.message}` },
      { status: 500 },
    );
  }

  const payload: AdminPoiListData = {
    category,
    generatedAt: new Date().toISOString(),
    page,
    pageSize,
    pois: ((data ?? []) as Parameters<typeof mapPoiRow>[0][]).map(mapPoiRow),
    query,
    reviewStatus,
    statusCounts,
    total: count ?? 0,
    warnings,
  };

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  if (authorized.context.member.role === "readonly") {
    return NextResponse.json(
      { error: "只读管理员不能新增 POI。" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => undefined);
  const parsed = createPoiInsertPatch(body, authorized.context.user.id);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const amapPoiId = String(parsed.patch.amap_poi_id ?? "").trim();

  const { data: existing, error: existingError } =
    await authorized.context.adminClient
      .from("poi_cache")
      .select("amap_poi_id")
      .eq("amap_poi_id", amapPoiId)
      .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: `检查 POI 是否存在失败：${existingError.message}` },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json(
      { error: "这个 POI ID 已存在，请改为编辑现有记录。" },
      { status: 409 },
    );
  }

  try {
    await recordPoiAuditLog(
      {
        adminClient: authorized.context.adminClient,
        request,
        user: authorized.context.user,
      },
      {
        action: "poi.create",
        after: parsed.patch,
        targetId: amapPoiId,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "写入后台审计日志失败。",
      },
      { status: 500 },
    );
  }

  const { error } = await authorized.context.adminClient
    .from("poi_cache")
    .insert(parsed.patch)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `新增 POI 失败：${error.message}` },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  const detail = await readPoiDetail(authorized.context.adminClient, amapPoiId);

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}
async function readStatusCounts(
  client: SupabaseClient,
  warnings: string[],
): Promise<Record<AdminPoiReviewStatus, number>> {
  const counts = Object.fromEntries(
    adminPoiReviewStatuses.map((status) => [status, 0]),
  ) as Record<AdminPoiReviewStatus, number>;

  await Promise.all(
    adminPoiReviewStatuses.map(async (status) => {
      const { count, error } = await client
        .from("poi_cache")
        .select("*", { count: "exact", head: true })
        .eq("review_status", status);

      if (error) {
        warnings.push(`${status} 状态计数失败：${error.message}`);
        return;
      }

      counts[status] = count ?? 0;
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
