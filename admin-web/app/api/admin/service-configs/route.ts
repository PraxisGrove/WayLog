import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-server";
import {
  createServiceConfig,
  readServiceConfigs,
  readServiceTypeFilter,
} from "@/lib/admin-service-config-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const serviceType = readServiceTypeFilter(
    request.nextUrl.searchParams.get("serviceType"),
  );
  const data = await readServiceConfigs(
    authorized.context.adminClient,
    serviceType,
  );

  return data instanceof NextResponse ? data : NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const body = await request.json().catch(() => undefined);
  const data = await createServiceConfig(
    {
      adminClient: authorized.context.adminClient,
      member: authorized.context.member,
      request,
      user: authorized.context.user,
    },
    body,
  );

  return data instanceof NextResponse ? data : NextResponse.json(data);
}
