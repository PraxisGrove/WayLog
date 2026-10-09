import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  createPoiUpdatePatch,
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

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { id } = await context.params;
  const amapPoiId = normalizeAmapPoiId(id);

  if (!amapPoiId) {
    return NextResponse.json({ error: "POI ID 不能为空。" }, { status: 400 });
  }

  const detail = await readPoiDetail(authorized.context.adminClient, amapPoiId);

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }
  if (authorized.context.member.role === "readonly") {
    return NextResponse.json(
      { error: "只读管理员不能修改 POI。" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const amapPoiId = normalizeAmapPoiId(id);

  if (!amapPoiId) {
    return NextResponse.json({ error: "POI ID 不能为空。" }, { status: 400 });
  }

  const body = await request.json().catch(() => undefined);
  const parsed = createPoiUpdatePatch(body, authorized.context.user.id);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const before = await readCurrentPoi(
    authorized.context.adminClient,
    amapPoiId,
  );

  if (!before) {
    return NextResponse.json({ error: "没有找到这个 POI。" }, { status: 404 });
  }

  try {
    await recordPoiAuditLog(
      {
        adminClient: authorized.context.adminClient,
        request,
        user: authorized.context.user,
      },
      {
        action: "poi.update",
        after: parsed.patch,
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
    .update(parsed.patch)
    .eq("amap_poi_id", amapPoiId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `保存 POI 失败：${error.message}` },
      { status: 500 },
    );
  }

  const detail = await readPoiDetail(authorized.context.adminClient, amapPoiId);

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  if (authorized.context.member.role === "readonly") {
    return NextResponse.json(
      { error: "只读管理员不能删除 POI。" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const amapPoiId = normalizeAmapPoiId(id);

  if (!amapPoiId) {
    return NextResponse.json({ error: "POI ID 不能为空。" }, { status: 400 });
  }

  const hardDelete = request.nextUrl.searchParams.get("hard") === "1";

  if (hardDelete && authorized.context.member.role !== "owner") {
    return NextResponse.json(
      { error: "只有 owner 可以物理删除 POI。" },
      { status: 403 },
    );
  }

  const before = await readCurrentPoi(
    authorized.context.adminClient,
    amapPoiId,
  );

  if (!before) {
    return NextResponse.json({ error: "没有找到这个 POI。" }, { status: 404 });
  }

  if (hardDelete) {
    try {
      await recordPoiAuditLog(
        {
          adminClient: authorized.context.adminClient,
          request,
          user: authorized.context.user,
        },
        {
          action: "poi.hard_delete",
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
      .delete()
      .eq("amap_poi_id", amapPoiId);

    if (error) {
      return NextResponse.json(
        { error: `物理删除 POI 失败：${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ amapPoiId, hardDeleted: true });
  }

  const patch = {
    merged_into_amap_poi_id: null,
    review_note: appendReviewNote(
      before.reviewNote,
      "后台删除：软删除为忽略。",
    ),
    review_status: "ignored",
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
        action: "poi.soft_delete",
        after: patch,
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
    .eq("amap_poi_id", amapPoiId);

  if (error) {
    return NextResponse.json(
      { error: `软删除 POI 失败：${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    amapPoiId,
    hardDeleted: false,
    reviewStatus: "ignored",
  });
}
function appendReviewNote(existing: string | null, nextNote: string) {
  const trimmed = existing?.trim();

  return trimmed ? `${trimmed}\n${nextNote}` : nextNote;
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
