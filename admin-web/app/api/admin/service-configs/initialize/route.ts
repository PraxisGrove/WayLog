import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-server";
import { initializeServiceProviderConfigs } from "@/lib/admin-service-config-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const data = await initializeServiceProviderConfigs({
    adminClient: authorized.context.adminClient,
    member: authorized.context.member,
    request,
    user: authorized.context.user,
  });

  return data instanceof NextResponse ? data : NextResponse.json(data);
}
