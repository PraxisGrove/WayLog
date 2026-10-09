"use client";

import { fetchAdminJson } from "./admin-api";
import type {
  AdminPoiCreateInput,
  AdminPoiDeleteResult,
  AdminPoiDetail,
  AdminPoiListData,
  AdminPoiListOptions,
  AdminPoiMergeInput,
  AdminPoiUpdateInput,
} from "./admin-poi-types";

export async function fetchAdminPoiEntries(
  options: AdminPoiListOptions = {},
): Promise<AdminPoiListData> {
  const params = new URLSearchParams();

  if (options.query?.trim()) {
    params.set("q", options.query.trim());
  }

  if (options.reviewStatus && options.reviewStatus !== "all") {
    params.set("status", options.reviewStatus);
  }

  if (options.category?.trim()) {
    params.set("category", options.category.trim());
  }

  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }

  const queryString = params.toString();

  return fetchAdminJson<AdminPoiListData>(
    `/api/admin/poi${queryString ? `?${queryString}` : ""}`,
    { fallbackMessage: "POI 列表加载失败。" },
  );
}

export async function fetchAdminPoiDetail(
  amapPoiId: string,
): Promise<AdminPoiDetail> {
  return fetchAdminJson<AdminPoiDetail>(
    `/api/admin/poi/${encodeURIComponent(amapPoiId)}`,
    { fallbackMessage: "POI 详情加载失败。" },
  );
}

export async function createAdminPoiEntry(
  input: AdminPoiCreateInput,
): Promise<AdminPoiDetail> {
  return fetchAdminJson<AdminPoiDetail>("/api/admin/poi", {
    body: input,
    fallbackMessage: "POI 新增失败。",
    method: "POST",
  });
}

export async function updateAdminPoiEntry(
  amapPoiId: string,
  input: AdminPoiUpdateInput,
): Promise<AdminPoiDetail> {
  return fetchAdminJson<AdminPoiDetail>(
    `/api/admin/poi/${encodeURIComponent(amapPoiId)}`,
    {
      body: input,
      fallbackMessage: "POI 保存失败。",
      method: "PATCH",
    },
  );
}

export async function deleteAdminPoiEntry(
  amapPoiId: string,
  options: { hard?: boolean } = {},
): Promise<AdminPoiDeleteResult> {
  const queryString = options.hard ? "?hard=1" : "";

  return fetchAdminJson<AdminPoiDeleteResult>(
    `/api/admin/poi/${encodeURIComponent(amapPoiId)}${queryString}`,
    {
      fallbackMessage: "POI 删除失败。",
      method: "DELETE",
    },
  );
}

export async function mergeAdminPoiEntry(
  amapPoiId: string,
  input: AdminPoiMergeInput,
): Promise<AdminPoiDetail> {
  return fetchAdminJson<AdminPoiDetail>(
    `/api/admin/poi/${encodeURIComponent(amapPoiId)}/merge`,
    {
      body: input,
      fallbackMessage: "POI 合并失败。",
      method: "POST",
    },
  );
}
