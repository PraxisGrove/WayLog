import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { AdminMemberRpcRow } from "@/lib/admin-types";

export type AdminServerEnv = {
  anonKey: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

export type AuthorizedAdminContext = {
  adminClient: SupabaseClient;
  env: AdminServerEnv;
  member: AdminMemberRpcRow;
  user: User;
};

export type AuthorizedAdminResult =
  | { context: AuthorizedAdminContext; ok: true }
  | { ok: false; response: NextResponse };

export async function authorizeAdminRequest(
  request: NextRequest,
): Promise<AuthorizedAdminResult> {
  const env = readAdminServerEnv();

  if (!env) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "后台服务端 Supabase 环境变量未配置完整。" },
        { status: 500 },
      ),
    };
  }

  const token = readBearerToken(request.headers.get("authorization"));

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "请先登录后台。" }, { status: 401 }),
    };
  }

  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "后台登录状态已失效，请重新登录。" },
        { status: 401 },
      ),
    };
  }

  const { data: member, error: memberError } = await userClient
    .rpc("get_current_admin_member")
    .maybeSingle<AdminMemberRpcRow>();

  if (memberError || !member?.enabled) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "当前账号没有后台访问权限。" },
        { status: 403 },
      ),
    };
  }

  return {
    context: {
      adminClient: createAdminServiceClient(env),
      env,
      member,
      user,
    },
    ok: true,
  };
}

export function createAdminServiceClient(env: AdminServerEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function readAdminServerEnv(): AdminServerEnv | undefined {
  const supabaseUrl = readEnvValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_URL",
  );
  const anonKey = readEnvValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
  const serviceRoleKey = readEnvValue(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  );

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return undefined;
  }

  return { anonKey, serviceRoleKey, supabaseUrl };
}

function readBearerToken(value: string | null) {
  const match = value?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim();
}

function readEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value && value !== "undefined" && value !== "null") {
      return value;
    }
  }

  return undefined;
}
