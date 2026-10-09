import type { User } from "@supabase/supabase-js";

export type AdminRole = "admin" | "developer" | "owner" | "readonly";

export type AdminMember = {
  displayName: string | null;
  enabled: boolean;
  note: string | null;
  role: AdminRole;
  userId: string;
};

export type AdminMemberRpcRow = {
  display_name: string | null;
  enabled: boolean;
  note: string | null;
  role: AdminRole;
  user_id: string;
};

export type AdminSessionState =
  | { status: "anonymous" }
  | { status: "not-configured" }
  | { message?: string; status: "unauthorized" }
  | {
      member: AdminMember;
      status: "authenticated";
      user: User;
    };
