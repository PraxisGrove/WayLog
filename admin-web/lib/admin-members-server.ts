import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { AdminMemberRpcRow, AdminRole } from "@/lib/admin-types";
import type {
  AdminAssignableRole,
  AdminMemberCreateInput,
  AdminMemberListItem,
  AdminMembersData,
  AdminMemberUpdateInput,
} from "@/lib/admin-members-types";

type AdminMemberRow = {
  created_at: string;
  display_name: string | null;
  enabled: boolean;
  note: string | null;
  role: AdminRole;
  updated_at: string;
  user_id: string;
};

type AdminMemberMutationContext = {
  adminClient: SupabaseClient;
  member: AdminMemberRpcRow;
  request: NextRequest;
  user: User;
};

type AuthUserSummary = {
  email: string | null;
  lastSignInAt: string | null;
  phone: string | null;
};

type ParsedCreateInput = Required<
  Pick<AdminMemberCreateInput, "enabled" | "role" | "userRef">
> &
  Pick<AdminMemberCreateInput, "displayName" | "note">;

type ParsedUpdateInput = AdminMemberUpdateInput;

const roleRank: Record<AdminRole, number> = {
  admin: 3,
  developer: 2,
  owner: 4,
  readonly: 1,
};

const assignableRoles: AdminAssignableRole[] = [
  "admin",
  "developer",
  "readonly",
];

export async function readAdminMembers(
  context: AdminMemberMutationContext,
): Promise<AdminMembersData | NextResponse> {
  const guard = ensureCanManageMembers(context.member.role);

  if (guard) {
    return guard;
  }

  const warnings: string[] = [];
  const { data, error } = await context.adminClient
    .schema("admin")
    .from("admin_members")
    .select("user_id,role,display_name,enabled,note,created_at,updated_at")
    .order("role", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<AdminMemberRow[]>();

  if (error) {
    return NextResponse.json(
      { error: `读取后台成员失败：${error.message}` },
      { status: 500 },
    );
  }

  const rows = data ?? [];
  const sortedRows = [...rows].sort((left, right) => {
    const roleDiff = roleRank[right.role] - roleRank[left.role];

    if (roleDiff !== 0) {
      return roleDiff;
    }

    return left.created_at.localeCompare(right.created_at);
  });
  const authUsers = await readAuthUserMap(
    context.adminClient,
    sortedRows.map((row) => row.user_id),
    warnings,
  );

  return {
    canManageMembers: true,
    currentRole: context.member.role,
    generatedAt: new Date().toISOString(),
    members: sortedRows.map((row) =>
      mapAdminMemberRow(row, authUsers.get(row.user_id)),
    ),
    total: rows.length,
    warnings,
  };
}

export async function createAdminMember(
  context: AdminMemberMutationContext,
  body: unknown,
): Promise<AdminMemberListItem | NextResponse> {
  const guard = ensureCanManageMembers(context.member.role);

  if (guard) {
    return guard;
  }

  const input = parseCreateInput(body);

  if (input instanceof NextResponse) {
    return input;
  }

  if (!canManageRole(context.member.role, input.role)) {
    return NextResponse.json(
      { error: "只能创建比自己权限更低的后台成员。" },
      { status: 403 },
    );
  }

  const authUserResult = await resolveAuthUser(
    context.adminClient,
    input.userRef,
  );

  if (authUserResult instanceof NextResponse) {
    return authUserResult;
  }

  const authUser = authUserResult;
  const current = await readAdminMemberRow(context.adminClient, authUser.id);

  if (current instanceof NextResponse) {
    return current;
  }

  if (current) {
    return NextResponse.json(
      { error: "这个 Auth 用户已经是后台成员，请直接编辑权限。" },
      { status: 409 },
    );
  }

  const { data, error } = await context.adminClient
    .schema("admin")
    .from("admin_members")
    .insert({
      display_name: input.displayName ?? null,
      enabled: input.enabled,
      note: input.note ?? null,
      role: input.role,
      user_id: authUser.id,
    })
    .select("user_id,role,display_name,enabled,note,created_at,updated_at")
    .single<AdminMemberRow>();

  if (error) {
    return NextResponse.json(
      { error: `创建后台成员失败：${error.message}` },
      { status: 500 },
    );
  }

  const item = mapAdminMemberRow(data, mapAuthUser(authUser));

  const auditError = await recordAdminMemberAuditLog(context, {
    action: "admin_member.create",
    after: item,
    targetId: item.userId,
  });

  if (auditError) {
    return auditError;
  }

  return item;
}

export async function updateAdminMember(
  context: AdminMemberMutationContext,
  userId: string,
  body: unknown,
): Promise<AdminMemberListItem | NextResponse> {
  const guard = ensureCanManageMembers(context.member.role);

  if (guard) {
    return guard;
  }

  if (!isUuid(userId)) {
    return NextResponse.json(
      { error: "成员用户 ID 格式不正确。" },
      { status: 400 },
    );
  }

  const input = parseUpdateInput(body);

  if (input instanceof NextResponse) {
    return input;
  }

  const current = await readAdminMemberRow(context.adminClient, userId);

  if (current instanceof NextResponse) {
    return current;
  }

  if (!current) {
    return NextResponse.json(
      { error: "没有找到这个后台成员。" },
      { status: 404 },
    );
  }

  if (!canManageRole(context.member.role, current.role)) {
    return NextResponse.json(
      { error: "不能管理同级或更高权限的后台成员。" },
      { status: 403 },
    );
  }

  if (input.role && !canManageRole(context.member.role, input.role)) {
    return NextResponse.json(
      { error: "不能把成员调整到同级或更高权限。" },
      { status: 403 },
    );
  }

  const patch = createMemberPatch(current, input);
  const authUser = await readAuthUser(context.adminClient, userId);
  const before = mapAdminMemberRow(current, authUser);

  if (Object.keys(patch).length === 0) {
    return before;
  }

  const { data, error } = await context.adminClient
    .schema("admin")
    .from("admin_members")
    .update(patch)
    .eq("user_id", userId)
    .select("user_id,role,display_name,enabled,note,created_at,updated_at")
    .single<AdminMemberRow>();

  if (error) {
    return NextResponse.json(
      { error: `保存后台成员失败：${error.message}` },
      { status: 500 },
    );
  }

  const after = mapAdminMemberRow(data, authUser);

  const auditError = await recordAdminMemberAuditLog(context, {
    action: "admin_member.update",
    after,
    before,
    targetId: after.userId,
  });

  if (auditError) {
    return auditError;
  }

  return after;
}

export function canManageMembers(role: AdminRole) {
  return role === "owner" || role === "admin";
}

export function canManageRole(actorRole: AdminRole, targetRole: AdminRole) {
  return (
    canManageMembers(actorRole) && roleRank[actorRole] > roleRank[targetRole]
  );
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value,
  );
}

function ensureCanManageMembers(role: AdminRole) {
  if (canManageMembers(role)) {
    return undefined;
  }

  return NextResponse.json(
    { error: "只有 owner 或 admin 可以管理后台权限成员。" },
    { status: 403 },
  );
}

async function readAdminMemberRow(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .schema("admin")
    .from("admin_members")
    .select("user_id,role,display_name,enabled,note,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle<AdminMemberRow>();

  if (error) {
    return NextResponse.json(
      { error: `读取后台成员失败：${error.message}` },
      { status: 500 },
    );
  }

  return data ?? undefined;
}

async function readAuthUserMap(
  client: SupabaseClient,
  userIds: string[],
  warnings: string[],
) {
  const map = new Map<string, AuthUserSummary>();

  await Promise.all(
    Array.from(new Set(userIds)).map(async (userId) => {
      const user = await readAuthUser(client, userId);

      if (user) {
        map.set(userId, user);
      } else {
        warnings.push(`Auth 用户 ${userId} 读取失败。`);
      }
    }),
  );

  return map;
}

async function readAuthUser(client: SupabaseClient, userId: string) {
  const {
    data: { user },
  } = await client.auth.admin.getUserById(userId);

  return user ? mapAuthUser(user) : undefined;
}

async function resolveAuthUser(
  client: SupabaseClient,
  userRef: string,
): Promise<User | NextResponse> {
  if (isUuid(userRef)) {
    const { data, error } = await client.auth.admin.getUserById(userRef);

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "没有找到这个 Auth 用户。" },
        { status: 404 },
      );
    }

    return data.user;
  }

  const normalizedRef = userRef.trim().toLowerCase();
  const perPage = 100;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return NextResponse.json(
        { error: `搜索 Auth 用户失败：${error.message}` },
        { status: 500 },
      );
    }

    const match = (data.users ?? []).find((user) => {
      const values = [user.email, user.phone]
        .filter(Boolean)
        .map((value) => value?.trim().toLowerCase());

      return values.includes(normalizedRef);
    });

    if (match) {
      return match;
    }

    if ((data.users ?? []).length < perPage) {
      break;
    }
  }

  return NextResponse.json(
    {
      error:
        "没有找到这个 Auth 用户。用户较多时请改用 Supabase Auth 用户 UUID。",
    },
    { status: 404 },
  );
}

function mapAdminMemberRow(
  row: AdminMemberRow,
  authUser: AuthUserSummary | undefined,
): AdminMemberListItem {
  return {
    createdAt: row.created_at,
    displayName: row.display_name,
    email: authUser?.email ?? null,
    enabled: row.enabled,
    lastSignInAt: authUser?.lastSignInAt ?? null,
    note: row.note,
    phone: authUser?.phone ?? null,
    role: row.role,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function mapAuthUser(user: User): AuthUserSummary {
  return {
    email: user.email ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    phone: user.phone ?? null,
  };
}

function parseCreateInput(body: unknown): ParsedCreateInput | NextResponse {
  if (!isRecord(body)) {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  const userRef = readRequiredString(body.userRef, 180);
  const role = readAssignableRole(body.role);

  if (!userRef) {
    return NextResponse.json(
      { error: "请填写 Supabase Auth 用户 UUID、邮箱或手机号。" },
      { status: 400 },
    );
  }

  if (!role) {
    return NextResponse.json(
      { error: "请选择要授予的后台角色。" },
      { status: 400 },
    );
  }

  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "启停状态格式不正确。" },
      { status: 400 },
    );
  }

  return {
    displayName: readNullableString(body.displayName, 80),
    enabled: body.enabled ?? true,
    note: readNullableString(body.note, 500),
    role,
    userRef,
  };
}

function parseUpdateInput(body: unknown): ParsedUpdateInput | NextResponse {
  if (!isRecord(body)) {
    return NextResponse.json({ error: "请求体格式不正确。" }, { status: 400 });
  }

  const input: ParsedUpdateInput = {};

  if ("role" in body) {
    const role = readAssignableRole(body.role);

    if (!role) {
      return NextResponse.json(
        { error: "后台角色格式不正确。" },
        { status: 400 },
      );
    }

    input.role = role;
  }

  if ("displayName" in body) {
    input.displayName = readNullableString(body.displayName, 80);
  }

  if ("note" in body) {
    input.note = readNullableString(body.note, 500);
  }

  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "启停状态格式不正确。" },
        { status: 400 },
      );
    }

    input.enabled = body.enabled;
  }

  return input;
}

function createMemberPatch(
  current: AdminMemberRow,
  input: ParsedUpdateInput,
): Partial<Pick<AdminMemberRow, "display_name" | "enabled" | "note" | "role">> {
  const patch: Partial<
    Pick<AdminMemberRow, "display_name" | "enabled" | "note" | "role">
  > = {};

  if (input.role !== undefined && input.role !== current.role) {
    patch.role = input.role;
  }

  if (
    input.displayName !== undefined &&
    input.displayName !== current.display_name
  ) {
    patch.display_name = input.displayName;
  }

  if (input.note !== undefined && input.note !== current.note) {
    patch.note = input.note;
  }

  if (input.enabled !== undefined && input.enabled !== current.enabled) {
    patch.enabled = input.enabled;
  }

  return patch;
}

async function recordAdminMemberAuditLog(
  context: AdminMemberMutationContext,
  input: {
    action: string;
    after: AdminMemberListItem;
    before?: AdminMemberListItem;
    targetId: string;
  },
) {
  const payload = input.before
    ? {
        after: sanitizeMemberForAudit(input.after),
        before: sanitizeMemberForAudit(input.before),
        changedFields: readChangedFields(input.before, input.after),
      }
    : {
        after: sanitizeMemberForAudit(input.after),
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
      target_type: "admin_member",
      user_agent: context.request.headers.get("user-agent"),
    });

  if (error) {
    return NextResponse.json(
      { error: `后台成员已保存，但审计日志写入失败：${error.message}` },
      { status: 500 },
    );
  }

  return undefined;
}

function sanitizeMemberForAudit(member: AdminMemberListItem) {
  return {
    displayName: member.displayName,
    enabled: member.enabled,
    role: member.role,
    userId: member.userId,
  };
}

function readChangedFields(
  before: AdminMemberListItem,
  after: AdminMemberListItem,
) {
  return (["displayName", "enabled", "note", "role"] as const).filter(
    (field) => before[field] !== after[field],
  );
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

function readAssignableRole(value: unknown): AdminAssignableRole | undefined {
  return typeof value === "string" &&
    assignableRoles.includes(value as AdminAssignableRole)
    ? (value as AdminAssignableRole)
    : undefined;
}

function readRequiredString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined;
}

function readNullableString(value: unknown, maxLength: number) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
