import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDiagnosticLogger } from "../diagnostics";

const CACHE_STORAGE_KEY = "waylog.amap_security_code.v1";
const amapSecurityCodeLogger = createDiagnosticLogger(
  "amap-security-code-cache",
);

const CACHE_TTL_MS = 60 * 60 * 1000;

const CACHE_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

/** Edge Function URL */
const EDGE_FUNCTION_URL = "/functions/v1/amap-security-code";

type CacheEntry = {
  securityCode: string;
  backupSecurityCode?: string;
  cachedAt: number;
};

let memoryCache: CacheEntry | null = null;

let pendingRequest: Promise<CacheEntry | null> | null = null;

async function readPersistentCache(): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry;

    if (
      typeof parsed.securityCode !== "string" ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writePersistentCache(entry: CacheEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    amapSecurityCodeLogger.warn(
      "persistent-cache.write.failed",
      undefined,
      "Failed to write Amap security code persistent cache",
    );
  }
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt < CACHE_TTL_MS;
}

function isCacheUsableAsFallback(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt < CACHE_FALLBACK_TTL_MS;
}

async function fetchSecurityCodeFromEdgeFunction(): Promise<CacheEntry | null> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      amapSecurityCodeLogger.error(
        "edge-function.config.missing-supabase-url",
        undefined,
        "Missing Supabase URL while fetching Amap security code",
      );
      return null;
    }

    const response = await fetch(`${supabaseUrl}${EDGE_FUNCTION_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
    });

    if (!response.ok) {
      amapSecurityCodeLogger.warn(
        "edge-function.request.failed",
        { status: response.status },
        "Amap security code Edge Function request failed",
      );
      return null;
    }

    const data = await response.json();

    if (typeof data.securityCode !== "string" || !data.securityCode) {
      amapSecurityCodeLogger.warn(
        "edge-function.response.invalid",
        undefined,
        "Amap security code Edge Function response was invalid",
      );
      return null;
    }

    const entry: CacheEntry = {
      securityCode: data.securityCode,
      backupSecurityCode: data.backupSecurityCode || undefined,
      cachedAt: Date.now(),
    };

    writePersistentCache(entry);

    return entry;
  } catch (error) {
    amapSecurityCodeLogger.warn(
      "edge-function.fetch.failed",
      { error },
      "Failed to fetch Amap security code from Edge Function",
    );
    return null;
  }
}

export async function getAmapSecurityCode(): Promise<{
  securityCode: string;
  backupSecurityCode?: string;
} | null> {
  if (memoryCache && isCacheValid(memoryCache)) {
    return {
      securityCode: memoryCache.securityCode,
      backupSecurityCode: memoryCache.backupSecurityCode,
    };
  }

  const persistentCache = await readPersistentCache();

  if (persistentCache && isCacheValid(persistentCache)) {
    memoryCache = persistentCache;
    return {
      securityCode: persistentCache.securityCode,
      backupSecurityCode: persistentCache.backupSecurityCode,
    };
  }

  if (pendingRequest) {
    const result = await pendingRequest;

    if (result) {
      memoryCache = result;
      return {
        securityCode: result.securityCode,
        backupSecurityCode: result.backupSecurityCode,
      };
    }
  } else {
    pendingRequest = fetchSecurityCodeFromEdgeFunction();

    try {
      const result = await pendingRequest;

      if (result) {
        memoryCache = result;
        return {
          securityCode: result.securityCode,
          backupSecurityCode: result.backupSecurityCode,
        };
      }
    } finally {
      pendingRequest = null;
    }
  }

  const fallbackCache = persistentCache || memoryCache;

  if (fallbackCache && isCacheUsableAsFallback(fallbackCache)) {
    amapSecurityCodeLogger.warn(
      "fallback.expired-cache.used",
      undefined,
      "Using expired Amap security code cache as fallback",
    );
    memoryCache = fallbackCache;
    return {
      securityCode: fallbackCache.securityCode,
      backupSecurityCode: fallbackCache.backupSecurityCode,
    };
  }

  return null;
}

export async function clearAmapSecurityCodeCache(): Promise<void> {
  memoryCache = null;
  pendingRequest = null;

  try {
    await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {}
}
