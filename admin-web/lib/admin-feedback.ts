"use client";

import { fetchAdminJson } from "./admin-api";
import type {
  AdminFeedbackDetail,
  AdminFeedbackListData,
  AdminFeedbackListOptions,
  AdminFeedbackUpdateInput,
} from "./admin-feedback-types";

export async function fetchAdminFeedbackEntries(
  options: AdminFeedbackListOptions = {},
): Promise<AdminFeedbackListData> {
  const params = new URLSearchParams();

  if (options.query?.trim()) {
    params.set("q", options.query.trim());
  }

  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }

  if (options.severity && options.severity !== "all") {
    params.set("severity", options.severity);
  }

  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }

  const queryString = params.toString();

  return fetchAdminJson<AdminFeedbackListData>(
    `/api/admin/feedback${queryString ? `?${queryString}` : ""}`,
    { fallbackMessage: "反馈列表加载失败。" },
  );
}

export async function fetchAdminFeedbackDetail(
  feedbackId: string,
): Promise<AdminFeedbackDetail> {
  return fetchAdminJson<AdminFeedbackDetail>(
    `/api/admin/feedback/${encodeURIComponent(feedbackId)}`,
    { fallbackMessage: "反馈详情加载失败。" },
  );
}

export async function updateAdminFeedbackEntry(
  feedbackId: string,
  input: AdminFeedbackUpdateInput,
): Promise<AdminFeedbackDetail> {
  return fetchAdminJson<AdminFeedbackDetail>(
    `/api/admin/feedback/${encodeURIComponent(feedbackId)}`,
    {
      body: input,
      fallbackMessage: "反馈保存失败。",
      method: "PATCH",
    },
  );
}
