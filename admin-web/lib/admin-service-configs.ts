"use client";

import { fetchAdminJson } from "./admin-api";
import type {
  AdminServiceConfigClearSecretInput,
  AdminServiceConfigDetail,
  AdminServiceConfigInitializeResult,
  AdminServiceConfigItem,
  AdminServiceConfigListData,
  AdminServiceConfigListOptions,
  AdminServiceConfigRotateSecretInput,
  AdminServiceConfigTestResult,
  AdminServiceConfigUpsertInput,
} from "./admin-service-config-types";

export async function fetchAdminServiceConfigs(
  options: AdminServiceConfigListOptions = {},
): Promise<AdminServiceConfigListData> {
  const params = new URLSearchParams();

  if (options.serviceType && options.serviceType !== "all") {
    params.set("serviceType", options.serviceType);
  }

  const queryString = params.toString();

  return fetchAdminJson<AdminServiceConfigListData>(
    `/api/admin/service-configs${queryString ? `?${queryString}` : ""}`,
    { fallbackMessage: "服务配置列表加载失败。" },
  );
}

export async function fetchAdminServiceConfigDetail(
  configId: string,
): Promise<AdminServiceConfigDetail> {
  return fetchAdminJson<AdminServiceConfigDetail>(
    `/api/admin/service-configs/${encodeURIComponent(configId)}`,
    { fallbackMessage: "服务配置详情加载失败。" },
  );
}

export async function createAdminServiceConfig(
  input: AdminServiceConfigUpsertInput,
): Promise<AdminServiceConfigDetail> {
  return fetchAdminJson<AdminServiceConfigDetail>(
    "/api/admin/service-configs",
    {
      body: input,
      fallbackMessage: "服务配置创建失败。",
      method: "POST",
    },
  );
}

export async function updateAdminServiceConfig(
  configId: string,
  input: AdminServiceConfigUpsertInput,
): Promise<AdminServiceConfigDetail> {
  return fetchAdminJson<AdminServiceConfigDetail>(
    `/api/admin/service-configs/${encodeURIComponent(configId)}`,
    {
      body: input,
      fallbackMessage: "服务配置保存失败。",
      method: "PATCH",
    },
  );
}

export async function rotateAdminServiceConfigSecret(
  configId: string,
  input: AdminServiceConfigRotateSecretInput,
): Promise<AdminServiceConfigDetail> {
  return fetchAdminJson<AdminServiceConfigDetail>(
    `/api/admin/service-configs/${encodeURIComponent(configId)}/rotate-secret`,
    {
      body: input,
      fallbackMessage: "服务密钥轮换失败。",
      method: "POST",
    },
  );
}

export async function clearAdminServiceConfigSecret(
  configId: string,
  input: AdminServiceConfigClearSecretInput = {},
): Promise<AdminServiceConfigDetail> {
  return fetchAdminJson<AdminServiceConfigDetail>(
    `/api/admin/service-configs/${encodeURIComponent(configId)}/clear-secret`,
    {
      body: input,
      fallbackMessage: "服务密钥清空失败。",
      method: "POST",
    },
  );
}

export async function testAdminServiceConfig(
  configId: string,
): Promise<AdminServiceConfigTestResult> {
  return fetchAdminJson<AdminServiceConfigTestResult>(
    `/api/admin/service-configs/${encodeURIComponent(configId)}/test`,
    {
      fallbackMessage: "服务连接测试失败。",
      method: "POST",
    },
  );
}

export async function initializeAdminServiceConfigs(): Promise<AdminServiceConfigInitializeResult> {
  return fetchAdminJson<AdminServiceConfigInitializeResult>(
    "/api/admin/service-configs/initialize",
    {
      fallbackMessage: "初始化服务 Provider 失败。",
      method: "POST",
    },
  );
}

export function replaceServiceConfigItem(
  items: AdminServiceConfigItem[],
  nextItem: AdminServiceConfigItem,
) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}
