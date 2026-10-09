import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-server";
import {
  normalizeServiceConfigId,
  readServiceConfigDetail,
  updateServiceConfig,
} from "@/lib/admin-service-config-server";

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
  const configId = normalizeServiceConfigId(id);

  if (!isUuid(configId)) {
    return NextResponse.json(
      { error: "服务配置 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const detail = await readServiceConfigDetail(
    authorized.context.adminClient,
    configId,
  );

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { id } = await context.params;
  const configId = normalizeServiceConfigId(id);

  if (!isUuid(configId)) {
    return NextResponse.json(
      { error: "服务配置 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => undefined);
  const detail = await updateServiceConfig(
    {
      adminClient: authorized.context.adminClient,
      member: authorized.context.member,
      request,
      user: authorized.context.user,
    },
    configId,
    body,
  );

  return detail instanceof NextResponse ? detail : NextResponse.json(detail);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
