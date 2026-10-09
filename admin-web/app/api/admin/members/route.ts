import { NextResponse, type NextRequest } from "next/server";

import {
  createAdminMember,
  readAdminMembers,
} from "@/lib/admin-members-server";
import { authorizeAdminRequest } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const data = await readAdminMembers({
    adminClient: authorized.context.adminClient,
    member: authorized.context.member,
    request,
    user: authorized.context.user,
  });

  return data instanceof NextResponse ? data : NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const body = await request.json().catch(() => undefined);
  const data = await createAdminMember(
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
