import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-server";
import {
  normalizeServiceConfigId,
  readServiceConfigAuditLogs,
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

  const auditLogs = await readServiceConfigAuditLogs(
    authorized.context.adminClient,
    configId,
  );

  return NextResponse.json({ auditLogs });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
