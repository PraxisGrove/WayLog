"use client";

import {
  getBrowserSupabaseClient,
  isSupabaseConfigured,
} from "./supabase-client";

type FetchAdminJsonOptions = {
  body?: unknown;
  fallbackMessage: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
};

export async function fetchAdminJson<TValue>(
  url: string,
  options: FetchAdminJsonOptions,
): Promise<TValue> {
  if (!isSupabaseConfigured) {
    throw new Error("后台 Supabase 环境变量未配置。");
  }

  const supabase = getBrowserSupabaseClient();

  if (!supabase) {
    throw new Error("无法初始化后台 Supabase 客户端。");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error("登录状态已失效，请重新登录后台。");
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${session.access_token}`,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    headers,
    method: options.method ?? "GET",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const message =
      typeof body?.error === "string" ? body.error : options.fallbackMessage;

    throw new Error(message);
  }

  return (await response.json()) as TValue;
}
