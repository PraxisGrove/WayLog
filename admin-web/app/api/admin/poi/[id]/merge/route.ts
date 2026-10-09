import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  mapPoiRow,
  normalizeAmapPoiId,
  readPoiDetail,
  recordPoiAuditLog,
} from "@/lib/admin-poi-server";
import { authorizeAdminRequest } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  if (authorized.context.member.role === "readonly") {
    return NextResponse.json(
      { error: "只读管理员不能合并 POI。" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const amapPoiId = normalizeAmapPoiId(id);
  const body = await request.json().catch(() => undefined);
  const targetAmapPoiId = readTargetAmapPoiId(body);

  if (!amapPoiId) {
    return NextResponse.json({ error: "POI ID 不能为空。" }, { status: 400 });
  }

  if (!targetAmapPoiId) {
    return NextResponse.json(
      { error: "合并目标 POI ID 不能为空。" },
      { status: 400 },
    );
  }

  if (targetAmapPoiId === amapPoiId) {
    return NextResponse.json(
      { error: "合并目标不能是当前 POI。" },
      { status: 400 },
    );
  }

  const [before, target] = await Promise.all([
    readCurrentPoi(authorized.context.adminClient, amapPoiId),
    readCurrentPoi(authorized.context.adminClient, targetAmapPoiId),
  ]);

  if (!before) {
    return NextResponse.json({ error: "没有找到当前 POI。" }, { status: 404 });
  }

  if (!target) {
    return NextResponse.json(
      { error: "没有找到合并目标 POI。" },
      { status: 404 },
    );
  }

  const patch = {
    merged_into_amap_poi_id: targetAmapPoiId,
    review_note: readNote(body) ?? before.reviewNote,
    review_status: "merged",
    reviewed_at: new Date().toISOString(),
    reviewed_by: authorized.context.user.id,
  };

  try {
    await recordPoiAuditLog(
      {
        adminClient: authorized.context.adminClient,
        request,
        user: authorized.context.user,
      },
      {
        action: "poi.merge",
        after: { ...patch, target },
        before,
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
    .update(patch)
    .eq("amap_poi_id", amapPoiId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `合并 POI 失败：${error.message}` },
      { status: 500 },
    );
  }

  const detail = await readPoiDetail(authorized.context.adminClient, amapPoiId);

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

async function readCurrentPoi(client: SupabaseClient, amapPoiId: string) {
  const { data, error } = await client
    .from("poi_cache")
    .select("*")
    .eq("amap_poi_id", amapPoiId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPoiRow(data as Parameters<typeof mapPoiRow>[0]);
}

function readTargetAmapPoiId(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return readString(value.targetAmapPoiId);
}

function readNote(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return readString(value.note) ?? null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
