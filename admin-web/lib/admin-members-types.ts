import type { AdminRole } from "./admin-types";

export type AdminAssignableRole = Exclude<AdminRole, "owner">;

export type AdminMemberAuditLog = {
  action: string;
  actorUserId: string | null;
  createdAt: string;
  id: number;
  payload: unknown;
};

export type AdminMemberListItem = {
  createdAt: string;
  displayName: string | null;
  email: string | null;
  enabled: boolean;
  lastSignInAt: string | null;
  note: string | null;
  phone: string | null;
  role: AdminRole;
  updatedAt: string;
  userId: string;
};

export type AdminMembersData = {
  canManageMembers: boolean;
  currentRole: AdminRole;
  generatedAt: string;
  members: AdminMemberListItem[];
  total: number;
  warnings: string[];
};

export type AdminMemberCreateInput = {
  displayName?: string | null;
  enabled?: boolean;
  note?: string | null;
  role: AdminAssignableRole;
  userRef: string;
};

export type AdminMemberUpdateInput = {
  displayName?: string | null;
  enabled?: boolean;
  note?: string | null;
  role?: AdminAssignableRole;
};
