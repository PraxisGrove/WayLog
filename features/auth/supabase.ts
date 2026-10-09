import { createDiagnosticLogger } from "../diagnostics";

const authHttpLogger = createDiagnosticLogger("auth-http");
const FUTURE_JWT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

export type SupabaseConfig = {
  anonKey: string;
  url: string;
};

export type SupabaseAuthUser = {
  created_at?: string;
  email?: string | null;
  id?: string;
  phone?: string | null;
  updated_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  identities?: {
    id: string;
    user_id: string;
    provider: string;
    provider_id: string;
    identity_data?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
  }[];
};

export type SupabaseAuthResponse = {
  access_token?: string;
  error?:
    | string
    | {
        message?: string;
      };
  error_description?: string;
  msg?: string;
  refresh_token?: string;
  token_hash?: string;
  type?: "email" | "magiclink";
  user?: SupabaseAuthUser;
  user_hint?: SupabaseAuthUser;
};

type SupabaseRequestOptions = {
  accessToken?: string;
  body?: unknown;
  method?: "GET" | "PATCH" | "POST" | "PUT";
  path: string;
  prefer?: string;
  service: "auth" | "functions" | "rest";
  timeoutMs?: number;
};

type SupabaseErrorPayload = {
  code?: string;
  error?:
    | string
    | {
        message?: string;
      };
  error_description?: string;
  message?: string;
  msg?: string;
};

export type AuthInvalidatedEvent = {
  method: "GET" | "PATCH" | "POST" | "PUT";
  path: string;
  service: "auth" | "functions" | "rest";
  status: 401 | 403;
};

export type AuthInvalidatedListener = (event: AuthInvalidatedEvent) => void;

const authInvalidatedListeners = new Set<AuthInvalidatedListener>();

export function addAuthInvalidatedListener(
  listener: AuthInvalidatedListener,
): () => void {
  authInvalidatedListeners.add(listener);
  return () => {
    authInvalidatedListeners.delete(listener);
  };
}

function emitAuthInvalidated(event: AuthInvalidatedEvent): void {
  for (const listener of authInvalidatedListeners) {
    try {
      listener(event);
    } catch (listenerError) {
      authHttpLogger.warn(
        "auth.invalidated.listener-error",
        { error: listenerError },
        "Auth invalidated listener threw; other listeners still invoked",
      );
    }
  }
}

function getSupabaseErrorMessage(
  payload: SupabaseErrorPayload,
): string | undefined {
  return typeof payload.error === "string"
    ? (payload.error_description ?? payload.error)
    : (payload.error?.message ?? payload.message ?? payload.msg);
}

function shouldEmitAuthInvalidatedForError(
  status: number,
  payload: SupabaseErrorPayload,
): status is 401 | 403 {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const message = getSupabaseErrorMessage(payload)?.toLowerCase() ?? "";

  return [
    "jwt",
    "token",
    "session",
    "invalid claim",
    "invalid signature",
    "expired",
    "auth",
    "unauthorized",
  ].some((keyword) => message.includes(keyword));
}

function isJwtIssuedAtFutureError(
  status: number,
  payload: SupabaseErrorPayload,
): boolean {
  return (
    status === 401 &&
    payload.code === "PGRST303" &&
    payload.message === "JWT issued at future"
  );
}

function createAbortError(): Error {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(createAbortError());
    };
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function normalizeConfigValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue && trimmedValue !== "?" && trimmedValue !== "undefined"
    ? trimmedValue
    : "";
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = normalizeConfigValue(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ).replace(/\/+$/, "");
  const anonKey = normalizeConfigValue(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!url || !anonKey) {
    throw new Error(
      "请先配置 Supabase 项目的 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_ANON_KEY。",
    );
  }

  return {
    anonKey,
    url,
  };
}

function createSupabaseUrl(
  config: SupabaseConfig,
  service: SupabaseRequestOptions["service"],
  path: string,
) {
  if (service === "auth") {
    return `${config.url}/auth/v1/${path}`;
  }

  if (service === "functions") {
    return `${config.url}/functions/v1/${path}`;
  }

  return `${config.url}/rest/v1/${path}`;
}

export async function requestSupabase<T>(
  options: SupabaseRequestOptions,
): Promise<T> {
  const config = getSupabaseConfig();
  const timeoutMs = options.timeoutMs ?? 30000;
  const preferHeader =
    options.prefer ??
    (options.service === "rest" ? "return=minimal" : undefined);
  const method = options.method ?? "POST";
  const url = createSupabaseUrl(config, options.service, options.path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (
      let attempt = 0;
      attempt <= FUTURE_JWT_RETRY_DELAYS_MS.length;
      attempt += 1
    ) {
      const response = await fetch(url, {
        method,
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${options.accessToken ?? config.anonKey}`,
          "Content-Type": "application/json",
          ...(preferHeader ? { Prefer: preferHeader } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as T &
        SupabaseErrorPayload;

      if (!response.ok) {
        const shouldRetryFutureJwt = Boolean(
          options.accessToken &&
            options.service === "rest" &&
            isJwtIssuedAtFutureError(response.status, payload),
        );
        const retryDelayMs = FUTURE_JWT_RETRY_DELAYS_MS[attempt];

        if (shouldRetryFutureJwt && retryDelayMs !== undefined) {
          authHttpLogger.warn(
            "jwt.future.retry.scheduled",
            {
              delayMs: retryDelayMs,
              method,
              retryAttempt: attempt + 1,
              service: options.service,
              status: response.status,
            },
            "Retrying Supabase request after future JWT clock skew",
          );
          await waitForRetry(retryDelayMs, controller.signal);
          continue;
        }

        if (
          options.accessToken &&
          !shouldRetryFutureJwt &&
          shouldEmitAuthInvalidatedForError(response.status, payload)
        ) {
          emitAuthInvalidated({
            method,
            path: options.path,
            service: options.service,
            status: response.status,
          });
        }

        const errorMessage = getSupabaseErrorMessage(payload);

        throw new Error(
          errorMessage ??
            payload.message ??
            payload.msg ??
            "Supabase 请求失败，请稍后再试",
        );
      }

      return payload;
    }

    throw new Error("Supabase 请求失败，请稍后再试");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("请求超时，请检查网络后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
