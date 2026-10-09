import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentAuthAccessToken } from "../auth/storage";
import { getSupabaseConfig } from "../auth/supabase";
import { createDiagnosticLogger } from "../diagnostics";
import { fetchPoiFromCloud, syncPoiToCloud } from "./poi-cache";
import type { TripPlace } from "./types";

export type LLMPlaceSummary = {
  text: string;
  fetchedAt: number;
  source: "llm";
};

const memoryCache = new Map<string, LLMPlaceSummary>();

const CACHE_PREFIX = "llm_place_";

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

const TIMEOUT_MS = 15_000;
const llmLogger = createDiagnosticLogger("llm-place-summary");

const LOW_VALUE_POI_GROUPS = new Set(["transport", "medical", "other"]);
const LOW_VALUE_CATEGORY_NAMES = new Set(["交通", "医疗"]);
const LOW_VALUE_NAME_PATTERNS = [
  /厕所/,
  /卫生间/,
  /洗手间/,
  /母婴室/,
  /服务台/,
  /闸机/,
  /检票口/,
  /出入口/,
  /停车场/,
  /收费站/,
  /公交站/,
  /公交站台/,
  /地铁站/,
  /地铁站口/,
  /地铁口/,
  /站台/,
  /候车室/,
  /安检口/,
  /值机柜台/,
  /登机口/,
  /摆渡车/,
];

function cacheKey(placeId: string): string {
  return `${CACHE_PREFIX}${placeId}`;
}

function checkMemoryCache(placeId: string): LLMPlaceSummary | null {
  const cached = memoryCache.get(placeId);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  memoryCache.delete(placeId);
  return null;
}

async function checkAsyncStorageCache(
  placeId: string,
): Promise<LLMPlaceSummary | null> {
  try {
    const json = await AsyncStorage.getItem(cacheKey(placeId));

    if (!json) {
      return null;
    }

    const cached: LLMPlaceSummary = JSON.parse(json);

    if (Date.now() - cached.fetchedAt >= CACHE_TTL) {
      AsyncStorage.removeItem(cacheKey(placeId)).catch(() => {});
      return null;
    }

    memoryCache.set(placeId, cached);
    return cached;
  } catch {
    return null;
  }
}

async function writeToCache(
  placeId: string,
  summary: LLMPlaceSummary,
): Promise<void> {
  memoryCache.set(placeId, summary);

  try {
    await AsyncStorage.setItem(cacheKey(placeId), JSON.stringify(summary));
  } catch {}
}

async function callLLMFunction(
  placeName: string,
  cityName?: string,
  country?: string,
  category?: string,
  address?: string,
): Promise<string | null> {
  try {
    const config = getSupabaseConfig();
    const accessToken = await getCurrentAuthAccessToken();

    const headers: Record<string, string> = {
      Accept: "application/json",
      apikey: config.anonKey,
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${config.url}/functions/v1/generate-place-info`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          placeName,
          cityName,
          country,
          category,
          address,
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      llmLogger.warn(
        "edge-function.request.failed",
        { status: response.status },
        "Place summary Edge Function request failed",
      );
      return null;
    }

    const data = await response.json();

    if (data?.error) {
      llmLogger.warn(
        "edge-function.api-error",
        { error: data.error },
        "Place summary Edge Function returned an API error",
      );
      return null;
    }

    return data?.text || null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      llmLogger.warn(
        "edge-function.request.timeout",
        undefined,
        "Place summary request timed out",
      );
    } else {
      llmLogger.warn(
        "edge-function.request.failed",
        { error },
        "Place summary request failed",
      );
    }
    return null;
  }
}

function isSharedAmapPoiId(placeId: string): boolean {
  return !/^(place|favorite-place)-/.test(placeId);
}

export function shouldGeneratePlaceSummary(input: {
  category?: string;
  placeId: string;
  placeName: string;
  poiGroup?: string;
}): boolean {
  if (!input.placeId || !input.placeName.trim()) {
    return false;
  }

  if (!isSharedAmapPoiId(input.placeId)) {
    return false;
  }

  if (input.poiGroup && LOW_VALUE_POI_GROUPS.has(input.poiGroup)) {
    return false;
  }

  if (input.category && LOW_VALUE_CATEGORY_NAMES.has(input.category)) {
    return false;
  }

  return !LOW_VALUE_NAME_PATTERNS.some((pattern) =>
    pattern.test(input.placeName),
  );
}

export async function getLLMPlaceSummary(
  placeId: string,
  placeName: string,
  cityName?: string,
  country?: string,
  category?: string,
  address?: string,
): Promise<LLMPlaceSummary | null> {
  if (!placeId || !placeName) {
    return null;
  }

  const memHit = checkMemoryCache(placeId);

  if (memHit) {
    return memHit;
  }

  const storageHit = await checkAsyncStorageCache(placeId);

  if (storageHit) {
    return storageHit;
  }

  const hasSharedAmapPoiId = isSharedAmapPoiId(placeId);

  if (hasSharedAmapPoiId) {
    try {
      const cached = await fetchPoiFromCloud(placeId);
      if (cached?.details?.summary) {
        const summary: LLMPlaceSummary = {
          text: cached.details.summary,
          fetchedAt: Date.now(),
          source: "llm",
        };
        await writeToCache(placeId, summary);
        return summary;
      }
    } catch {}
  }

  const text = await callLLMFunction(
    placeName,
    cityName,
    country,
    category,
    address,
  );

  if (!text) {
    return null;
  }

  const summary: LLMPlaceSummary = {
    text,
    fetchedAt: Date.now(),
    source: "llm",
  };

  await writeToCache(placeId, summary);

  if (hasSharedAmapPoiId) {
    const placeForCache: TripPlace = {
      id: placeId,
      name: placeName,
      category: "其他",
      isScheduled: false,
      externalRefs: { amapPoiId: placeId },
      details: { summary: text },
    };
    syncPoiToCloud(placeForCache).catch((err) =>
      llmLogger.warn(
        "summary.poi-cache.sync.failed",
        { error: err, placeId },
        "Failed to sync place summary to POI cache",
      ),
    );
  }

  return summary;
}

export function getCachedLLMPlaceSummary(
  placeId: string,
): LLMPlaceSummary | null {
  return checkMemoryCache(placeId);
}
