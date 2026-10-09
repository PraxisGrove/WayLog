"use client";

import { fetchAdminJson } from "./admin-api";
import type {
  AdminMemberCreateInput,
  AdminMemberListItem,
  AdminMembersData,
  AdminMemberUpdateInput,
} from "./admin-members-types";

export async function fetchAdminMembers(): Promise<AdminMembersData> {
  return fetchAdminJson<AdminMembersData>("/api/admin/members", {
    fallbackMessage: "后台成员列表加载失败。",
  });
}

export async function createAdminMember(
  input: AdminMemberCreateInput,
): Promise<AdminMemberListItem> {
  return fetchAdminJson<AdminMemberListItem>("/api/admin/members", {
    body: input,
    fallbackMessage: "后台成员创建失败。",
    method: "POST",
  });
}

export async function updateAdminMember(
  userId: string,
  input: AdminMemberUpdateInput,
): Promise<AdminMemberListItem> {
  return fetchAdminJson<AdminMemberListItem>(
    `/api/admin/members/${encodeURIComponent(userId)}`,
    {
      body: input,
      fallbackMessage: "后台成员保存失败。",
      method: "PATCH",
    },
  );
}

export function replaceAdminMemberItem(
  items: AdminMemberListItem[],
  nextItem: AdminMemberListItem,
) {
  return items.map((item) =>
    item.userId === nextItem.userId ? nextItem : item,
  );
}
