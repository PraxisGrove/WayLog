import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TripPlace, TripPlaceExternalImage, TripPlaceLLM } from "./types";

type CacheEntry = {
  data: TripPlace;
  updatedAt: string;
};

const PLACE_CACHE_KEY = "waylog.place_cache.v1";

const memoryCache = new Map<string, CacheEntry>();

let persistentCache: Record<string, CacheEntry> | null = null;
let persistentCacheLoading: Promise<void> | null = null;

async function loadPersistentCache(): Promise<Record<string, CacheEntry>> {
  if (persistentCache) return persistentCache;

  if (!persistentCacheLoading) {
    persistentCacheLoading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PLACE_CACHE_KEY);
        persistentCache = raw ? JSON.parse(raw) : {};
      } catch {
        persistentCache = {};
      }
    })();
  }

  await persistentCacheLoading;
  if (!persistentCache) {
    persistentCache = {};
  }

  return persistentCache;
}

async function savePersistentCache(
  cache: Record<string, CacheEntry>,
): Promise<void> {
  persistentCache = cache;
  try {
    await AsyncStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function writeToCache(
  amapPoiId: string,
  entry: CacheEntry,
): Promise<void> {
  memoryCache.set(amapPoiId, entry);

  const store = await loadPersistentCache();
  store[amapPoiId] = entry;
  await savePersistentCache(store);
}

export async function getPlaceCache(
  amapPoiId: string,
): Promise<TripPlace | null> {
  if (!amapPoiId) {
    return null;
  }

  const memEntry = memoryCache.get(amapPoiId);
  if (memEntry) {
    return memEntry.data;
  }

  const store = await loadPersistentCache();
  const entry = store[amapPoiId];

  if (entry) {
    memoryCache.set(amapPoiId, entry);
    return entry.data;
  }

  return null;
}

export async function getOrCreatePlaceCache(
  amapPoiId: string,
  place?: TripPlace,
): Promise<TripPlace> {
  const existing = await getPlaceCache(amapPoiId);
  if (existing) {
    if (place) {
      const merged: TripPlace = { ...existing, ...place };
      await writeToCache(amapPoiId, {
        data: merged,
        updatedAt: new Date().toISOString(),
      });
      return merged;
    }
    return existing;
  }

  const newPlace: TripPlace = place ?? {
    id: `amap-${amapPoiId}`,
    name: "未知地点",
    category: "其他",
    isScheduled: false,
    providerPlaceId: amapPoiId,
    provider: "amap",
    externalRefs: { amapPoiId },
  };

  await writeToCache(amapPoiId, {
    data: newPlace,
    updatedAt: new Date().toISOString(),
  });

  return newPlace;
}

export async function updateLLMInCache(
  amapPoiId: string,
  llm: TripPlaceLLM | null,
): Promise<void> {
  const existing = await getOrCreatePlaceCache(amapPoiId);

  const updated: TripPlace = {
    ...existing,
    llm: llm ?? undefined,
  };

  await writeToCache(amapPoiId, {
    data: updated,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateExternalImagesInCache(
  amapPoiId: string,
  externalImages: TripPlaceExternalImage[] | null,
): Promise<void> {
  const existing = await getOrCreatePlaceCache(amapPoiId);

  const updated: TripPlace = {
    ...existing,
    externalImages: externalImages ?? undefined,
  };

  await writeToCache(amapPoiId, {
    data: updated,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearAllCache(): Promise<void> {
  memoryCache.clear();
  persistentCache = null;
  persistentCacheLoading = null;
  await AsyncStorage.removeItem(PLACE_CACHE_KEY);
}

export async function getCacheStats(): Promise<{
  memoryCount: number;
  persistentCount: number;
}> {
  const store = await loadPersistentCache();
  return {
    memoryCount: memoryCache.size,
    persistentCount: Object.keys(store).length,
  };
}
