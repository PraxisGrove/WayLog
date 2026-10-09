"use client";

import { fetchAdminJson } from "./admin-api";
import type { AdminDashboardData } from "./admin-dashboard-types";

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  return fetchAdminJson<AdminDashboardData>("/api/admin/dashboard", {
    fallbackMessage: "仪表盘数据加载失败。",
  });
}
