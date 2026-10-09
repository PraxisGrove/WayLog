import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  createFeedbackUpdatePatch,
  mapFeedbackRow,
  normalizeFeedbackId,
  readFeedbackDetail,
  recordFeedbackAuditLog,
} from "@/lib/admin-feedback-server";
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
  const feedbackId = normalizeFeedbackId(id);

  if (!isUuid(feedbackId)) {
    return NextResponse.json(
      { error: "反馈 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const detail = await readFeedbackDetail(
    authorized.context.adminClient,
    feedbackId,
  );

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  if (authorized.context.member.role === "readonly") {
    return NextResponse.json(
      { error: "只读管理员不能处理反馈。" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const feedbackId = normalizeFeedbackId(id);

  if (!isUuid(feedbackId)) {
    return NextResponse.json(
      { error: "反馈 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => undefined);
  const parsed = createFeedbackUpdatePatch(body, authorized.context.user.id);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const before = await readCurrentFeedback(
    authorized.context.adminClient,
    feedbackId,
  );

  if (!before) {
    return NextResponse.json({ error: "没有找到这条反馈。" }, { status: 404 });
  }

  try {
    await recordFeedbackAuditLog(
      {
        adminClient: authorized.context.adminClient,
        request,
        user: authorized.context.user,
      },
      {
        action: "feedback.update",
        after: parsed.patch,
        before,
        targetId: feedbackId,
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
    .from("feedback")
    .update(parsed.patch)
    .eq("id", feedbackId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `保存反馈失败：${error.message}` },
      { status: 500 },
    );
  }

  const detail = await readFeedbackDetail(
    authorized.context.adminClient,
    feedbackId,
  );

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

async function readCurrentFeedback(client: SupabaseClient, feedbackId: string) {
  const { data, error } = await client
    .from("feedback")
    .select("*")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapFeedbackRow(data as Parameters<typeof mapFeedbackRow>[0]);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
