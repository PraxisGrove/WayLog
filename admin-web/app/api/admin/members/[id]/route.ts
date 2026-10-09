import { NextResponse, type NextRequest } from "next/server";

import { isUuid, updateAdminMember } from "@/lib/admin-members-server";
import { authorizeAdminRequest } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const { id } = await context.params;
  const userId = decodeURIComponent(id).trim();

  if (!isUuid(userId)) {
    return NextResponse.json(
      { error: "成员用户 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => undefined);
  const data = await updateAdminMember(
    {
      adminClient: authorized.context.adminClient,
      member: authorized.context.member,
      request,
      user: authorized.context.user,
    },
    userId,
    body,
  );

  return data instanceof NextResponse ? data : NextResponse.json(data);
}
