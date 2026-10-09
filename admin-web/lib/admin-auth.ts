import type { User } from "@supabase/supabase-js";

import type {
  AdminMember,
  AdminMemberRpcRow,
  AdminSessionState,
} from "./admin-types";
import {
  getBrowserSupabaseClient,
  isSupabaseConfigured,
} from "./supabase-client";

export async function getCurrentAdminSession(): Promise<AdminSessionState> {
  if (!isSupabaseConfigured) {
    return { status: "not-configured" };
  }

  const supabase = getBrowserSupabaseClient();

  if (!supabase) {
    return { status: "not-configured" };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return { message: sessionError.message, status: "unauthorized" };
  }

  if (!session?.user) {
    return { status: "anonymous" };
  }

  const member = await getAdminMember(session.user);

  if (!member) {
    return {
      message: "该 Supabase Auth 用户尚未加入 admin.admin_members。",
      status: "unauthorized",
    };
  }

  return {
    member,
    status: "authenticated",
    user: session.user,
  };
}

export async function signInAdmin(input: {
  email: string;
  password: string;
}): Promise<void> {
  const supabase = getBrowserSupabaseClient();

  if (!supabase) {
    throw new Error("后台 Supabase 环境变量未配置。");
  }

  const { error } = await supabase.auth.signInWithPassword(input);

  if (error) {
    throw new Error(error.message);
  }

  const session = await getCurrentAdminSession();

  if (session.status !== "authenticated") {
    await supabase.auth.signOut();
    throw new Error(
      session.status === "unauthorized"
        ? session.message
        : "该账号没有后台访问权限。",
    );
  }
}

export async function signOutAdmin(): Promise<void> {
  const supabase = getBrowserSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }
}

async function getAdminMember(user: User): Promise<AdminMember | undefined> {
  const supabase = getBrowserSupabaseClient();

  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .rpc("get_current_admin_member")
    .maybeSingle<AdminMemberRpcRow>();

  if (error || !data?.enabled) {
    return undefined;
  }

  return {
    displayName: data.display_name ?? user.email ?? null,
    enabled: data.enabled,
    note: data.note,
    role: data.role,
    userId: data.user_id,
  };
}
