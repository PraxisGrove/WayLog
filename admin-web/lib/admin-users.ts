"use client";

import { fetchAdminJson } from "./admin-api";
import type { AdminUserDetail, AdminUsersData } from "./admin-users-types";

export type FetchAdminUsersOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
};

export async function fetchAdminUsers(
  options: FetchAdminUsersOptions = {},
): Promise<AdminUsersData> {
  const params = new URLSearchParams();

  if (options.query?.trim()) {
    params.set("q", options.query.trim());
  }

  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }

  const queryString = params.toString();

  return fetchAdminJson<AdminUsersData>(
    `/api/admin/users${queryString ? `?${queryString}` : ""}`,
    { fallbackMessage: "用户列表加载失败。" },
  );
}

export async function fetchAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail> {
  return fetchAdminJson<AdminUserDetail>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    { fallbackMessage: "用户详情加载失败。" },
  );
}
