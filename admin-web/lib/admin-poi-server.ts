import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type {
  AdminPoiAuditLog,
  AdminPoiDetail,
  AdminPoiItem,
  AdminPoiReviewStatus,
  AdminPoiUpdateInput,
} from "@/lib/admin-poi-types";

export const adminPoiReviewStatuses: AdminPoiReviewStatus[] = [
  "pending",
  "confirmed",
  "needs_fix",
  "merged",
  "ignored",
];

type PoiCacheAdminRow = {
  address?: string | null;
  amap_poi_id: string;
  area?: string | null;
  category?: string | null;
  created_at?: string | null;
  data_source?: string | null;
  details?: unknown;
  externalRefs?: unknown;
  external_refs?: unknown;
  iconKey?: string | null;
  icon_key?: string | null;
  lat?: number | null;
  latitude?: number | null;
  lng?: number | null;
  longitude?: number | null;
  merged_into_amap_poi_id?: string | null;
  name: string;
  photos?: unknown;
  poiGroup?: string | null;
  poiType?: string | null;
  poi_group?: string | null;
  poi_type?: string | null;
  raw_summary?: string | null;
  review_note?: string | null;
  review_status?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  source_note?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  version?: number | null;
};

type AdminAuditLogRow = {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  id: number;
  payload: unknown;
};

export type AdminPoiMutationContext = {
  adminClient: SupabaseClient;
  request: NextRequest;
  user: User;
};

const editableJsonFields = new Set(["details", "externalRefs", "photos"]);

export function mapPoiRow(row: PoiCacheAdminRow): AdminPoiItem {
  return {
    address: row.address ?? null,
    amapPoiId: row.amap_poi_id,
    area: row.area ?? readExternalRefsString(row, "amapCityName"),
    category: row.category ?? null,
    createdAt: row.created_at ?? null,
    dataSource: row.data_source ?? null,
    details: row.details ?? null,
    externalRefs: row.externalRefs ?? row.external_refs ?? null,
    iconKey: row.iconKey ?? row.icon_key ?? null,
    latitude: row.latitude ?? row.lat ?? null,
    longitude: row.longitude ?? row.lng ?? null,
    mergedIntoAmapPoiId: row.merged_into_amap_poi_id ?? null,
    name: row.name,
    photos: row.photos ?? null,
    poiGroup: row.poiGroup ?? row.poi_group ?? null,
    poiType: row.poiType ?? row.poi_type ?? null,
    rawSummary: row.raw_summary ?? null,
    reviewNote: row.review_note ?? null,
    reviewStatus: readPoiReviewStatus(row.review_status),
    reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
    sourceNote: row.source_note ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    version: row.version ?? null,
  };
}

export function mapPoiAuditLog(row: AdminAuditLogRow): AdminPoiAuditLog {
  return {
    action: row.action,
    actorUserId: row.actor_user_id ?? null,
    createdAt: row.created_at,
    id: row.id,
    payload: row.payload ?? {},
  };
}

export async function readPoiDetail(
  client: SupabaseClient,
  amapPoiId: string,
): Promise<AdminPoiDetail | NextResponse> {
  const { data, error } = await client
    .from("poi_cache")
    .select("*")
    .eq("amap_poi_id", amapPoiId)
    .maybeSingle<PoiCacheAdminRow>();

  if (error) {
    return NextResponse.json(
      { error: `读取 POI 失败：${error.message}` },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "没有找到这个 POI。" }, { status: 404 });
  }

  const auditLogs = await readPoiAuditLogs(client, amapPoiId);

  return {
    ...mapPoiRow(data),
    auditLogs,
  };
}

export async function readPoiAuditLogs(
  client: SupabaseClient,
  amapPoiId: string,
): Promise<AdminPoiAuditLog[]> {
  const { data, error } = await client
    .schema("admin")
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,payload,created_at")
    .eq("target_type", "poi_cache")
    .eq("target_id", amapPoiId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<AdminAuditLogRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapPoiAuditLog);
}

export async function recordPoiAuditLog(
  context: AdminPoiMutationContext,
  input: {
    action: string;
    after?: unknown;
    before?: unknown;
    targetId: string;
  },
) {
  const payload = {
    after: input.after ?? null,
    before: input.before ?? null,
  };

  const { error } = await context.adminClient
    .schema("admin")
    .from("admin_audit_logs")
    .insert({
      action: input.action,
      actor_user_id: context.user.id,
      ip: getRequestIp(context.request),
      payload,
      target_id: input.targetId,
      target_type: "poi_cache",
      user_agent: context.request.headers.get("user-agent"),
    });

  if (error) {
    throw new Error(`写入后台审计日志失败：${error.message}`);
  }
}

export function createPoiInsertPatch(
  body: unknown,
  actorUserId: string,
): { ok: true; patch: Record<string, unknown> } | { error: string; ok: false } {
  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  const amapPoiId = readTrimmedString(body.amapPoiId);
  const name = readTrimmedString(body.name);
  const reviewStatus =
    "reviewStatus" in body ? readPoiReviewStatus(body.reviewStatus) : "pending";

  if (!amapPoiId) {
    return { error: "POI ID 不能为空。", ok: false };
  }

  if (!name) {
    return { error: "POI 名称不能为空。", ok: false };
  }

  if ("reviewStatus" in body && reviewStatus !== body.reviewStatus) {
    return { error: "审核状态不正确。", ok: false };
  }

  const updatePatch = createPoiUpdatePatch(
    {
      ...body,
      dataSource: "dataSource" in body ? body.dataSource : "admin",
      name,
      reviewStatus,
    },
    actorUserId,
  );

  if (!updatePatch.ok) {
    return updatePatch;
  }

  if (reviewStatus === "pending") {
    delete updatePatch.patch.reviewed_at;
    delete updatePatch.patch.reviewed_by;
  }

  const now = new Date().toISOString();

  return {
    ok: true,
    patch: {
      ...updatePatch.patch,
      amap_poi_id: amapPoiId,
      created_at: now,
      updatedAt: now,
      version: 1,
    },
  };
}

export function createPoiUpdatePatch(
  body: unknown,
  actorUserId: string,
): { ok: true; patch: Record<string, unknown> } | { error: string; ok: false } {
  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  const patch: Record<string, unknown> = {};

  if ("name" in body) {
    const name = readTrimmedString(body.name);

    if (!name) {
      return { error: "POI 名称不能为空。", ok: false };
    }

    patch.name = name;
  }

  assignNullableStringPatch(patch, body, "address", "address");
  assignNullableStringPatch(patch, body, "area", "area");
  assignNullableStringPatch(patch, body, "category", "category");
  assignNullableStringPatch(patch, body, "dataSource", "data_source");
  assignNullableStringPatch(patch, body, "iconKey", "iconKey");
  assignNullableStringPatch(patch, body, "poiGroup", "poiGroup");
  assignNullableStringPatch(patch, body, "poiType", "poiType");
  assignNullableStringPatch(patch, body, "rawSummary", "raw_summary");
  assignNullableStringPatch(patch, body, "reviewNote", "review_note");
  assignNullableStringPatch(patch, body, "sourceNote", "source_note");

  for (const field of editableJsonFields) {
    if (field in body) {
      patch[field] = normalizeJsonValue(body[field]);
    }
  }

  if ("latitude" in body) {
    const latitude = readNullableCoordinate(body.latitude, 90);

    if (latitude === undefined) {
      return { error: "纬度必须是 -90 到 90 之间的数字。", ok: false };
    }

    patch.latitude = latitude;
  }

  if ("longitude" in body) {
    const longitude = readNullableCoordinate(body.longitude, 180);

    if (longitude === undefined) {
      return { error: "经度必须是 -180 到 180 之间的数字。", ok: false };
    }

    patch.longitude = longitude;
  }

  if ("reviewStatus" in body) {
    const reviewStatus = readPoiReviewStatus(body.reviewStatus);

    if (reviewStatus !== body.reviewStatus) {
      return { error: "审核状态不正确。", ok: false };
    }

    patch.review_status = reviewStatus;
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = actorUserId;

    if (reviewStatus !== "merged") {
      patch.merged_into_amap_poi_id = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { error: "没有可保存的字段。", ok: false };
  }

  return { ok: true, patch };
}

export function readPoiReviewStatus(value: unknown): AdminPoiReviewStatus {
  return adminPoiReviewStatuses.includes(value as AdminPoiReviewStatus)
    ? (value as AdminPoiReviewStatus)
    : "pending";
}

export function normalizeAmapPoiId(value: string) {
  return decodeURIComponent(value).trim();
}

function readExternalRefsString(row: PoiCacheAdminRow, key: string) {
  const externalRefs = row.externalRefs ?? row.external_refs;

  if (!isRecord(externalRefs)) {
    return null;
  }

  const value = externalRefs[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assignNullableStringPatch(
  patch: Record<string, unknown>,
  body: Record<string, unknown>,
  inputKey: keyof AdminPoiUpdateInput & string,
  columnKey: string,
) {
  if (!(inputKey in body)) {
    return;
  }

  patch[columnKey] = readNullableString(body[inputKey]);
}

function readNullableCoordinate(value: unknown, maxAbs: number) {
  if (value === null || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue) || Math.abs(numberValue) > maxAbs) {
    return undefined;
  }

  return numberValue;
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

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeJsonValue(value: unknown) {
  if (value === null || value === "") {
    return null;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const value = forwardedFor?.split(",")[0]?.trim();

  return value && /^[0-9a-f:.]+$/i.test(value) ? value : null;
}
