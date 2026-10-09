import { createDiagnosticLogger } from "../diagnostics";
import { createLocalDbKeyValueStorageAdapter } from "../local-db";
import {
  ROUTE_CACHE_STORAGE_KEY,
  type RouteCacheStore,
  type TripRouteCoordinates,
  type TripRouteGeocodeCacheEntry,
  type TripRouteModeOption,
  type TripRouteSegmentCacheEntry,
} from "./route-segments";
import { seedTrips } from "./seed";
import { findSeedAmapRoute } from "./seed-amap-data";

const SEED_ROUTE_CACHE_MARKER_KEY = "waylog.route_cache_seeded.v3";
const routeCacheStorage =
  createLocalDbKeyValueStorageAdapter("trip-route-cache");
const seedRouteCacheLogger = createDiagnosticLogger("seed-route-cache");

const FALLBACK_SPEED_KMH: Record<string, number> = {
  driving: 68,
  cycling: 16,
  walking: 4.8,
  transit: 28,
};

const DISTANCE_FACTOR: Record<string, number> = {
  driving: 1.25,
  cycling: 1.2,
  walking: 1.15,
  transit: 1.4,
};

const MODE_LABEL: Record<string, string> = {
  driving: "驾车",
  cycling: "骑行",
  walking: "步行",
  transit: "公共交通",
};

const ROUTE_MODES = ["cycling", "driving", "transit", "walking"] as const;

function hashText(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function buildSignature(
  placeId: string,
  name: string,
  address: string | undefined,
  area: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
): string {
  return [
    (placeId ?? "").trim(),
    (name ?? "").trim(),
    (address ?? "").trim(),
    (area ?? "").trim(),
    typeof lat === "number" && Number.isFinite(lat) ? lat.toFixed(6) : "",
    typeof lng === "number" && Number.isFinite(lng) ? lng.toFixed(6) : "",
  ].join("|");
}

function createCacheKey(fromSignature: string, toSignature: string): string {
  const primaryHash = hashText(`${fromSignature}=>${toSignature}`);
  const reverseHash = hashText(`${toSignature}=>${fromSignature}`);
  return `amap-v14-${primaryHash}-${reverseHash}`;
}

function createGeocodeCacheKey(
  signature: string,
  query: string,
  routeCity: string,
): string {
  return hashText(
    [signature, query.trim().toLocaleLowerCase(), routeCity].join("|"),
  );
}

function getHaversineDistanceKm(
  from: TripRouteCoordinates,
  to: TripRouteCoordinates,
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateModeOption(
  mode: string,
  directDistanceKm: number,
): TripRouteModeOption {
  const factor = DISTANCE_FACTOR[mode] ?? 1.25;
  const speed = FALLBACK_SPEED_KMH[mode] ?? 20;
  const distanceKm = Number(
    (directDistanceKm * factor).toFixed(directDistanceKm >= 100 ? 0 : 2),
  );
  const durationMinutes = Math.max(1, Math.round((distanceKm / speed) * 60));
  return {
    mode: mode as TripRouteModeOption["mode"],
    label: MODE_LABEL[mode] ?? mode,
    distanceKm,
    durationMinutes,
    source: "estimated",
  };
}

interface SeedPlaceInfo {
  id: string;
  name: string;
  address?: string;
  area?: string;
  lat: number;
  lng: number;
  query: string;
  routeCity: string;
}

function extractSeedPlaces(): Map<string, SeedPlaceInfo> {
  const places = new Map<string, SeedPlaceInfo>();
  const trip = seedTrips.find((t) => t.id === "seed-xian");
  if (!trip) return places;

  for (const place of trip.places) {
    if (
      typeof place.latitude !== "number" ||
      typeof place.longitude !== "number"
    )
      continue;
    const routeCity =
      (place.externalRefs?.amapCityName ?? "").trim() ||
      (place.area?.match(/[^省市区县\s·,，、/]+市/)?.[0] ?? "") ||
      (place.address?.match(/[^省市区县\s·,，、/]+市/)?.[0] ?? "");
    places.set(place.id, {
      id: place.id,
      name: place.name,
      address: place.address,
      area: place.area,
      lat: place.latitude,
      lng: place.longitude,
      query: [place.name, place.address, place.area].filter(Boolean).join(" "),
      routeCity,
    });
  }

  return places;
}

function extractSeedPlacePairs(): { fromId: string; toId: string }[] {
  const trip = seedTrips.find((t) => t.id === "seed-xian");
  if (!trip) return [];

  const pairs: { fromId: string; toId: string }[] = [];

  for (const day of trip.days) {
    const items = day.items;
    for (let i = 0; i < items.length - 1; i += 1) {
      const fromId = items[i].placeId;
      const toId = items[i + 1].placeId;
      if (fromId && toId) {
        pairs.push({ fromId, toId });
      }
    }
  }

  return pairs;
}

function buildSeedRouteCacheData(): {
  entries: Record<string, TripRouteSegmentCacheEntry>;
  geocodes: Record<string, TripRouteGeocodeCacheEntry>;
} {
  const places = extractSeedPlaces();
  const pairs = extractSeedPlacePairs();
  const entries: Record<string, TripRouteSegmentCacheEntry> = {};
  const geocodes: Record<string, TripRouteGeocodeCacheEntry> = {};

  for (const [, place] of places) {
    const signature = buildSignature(
      place.id,
      place.name,
      place.address,
      place.area,
      place.lat,
      place.lng,
    );
    const geocodeKey = createGeocodeCacheKey(
      signature,
      place.query,
      place.routeCity,
    );
    geocodes[geocodeKey] = {
      status: "ready",
      provider: "amap",
      query: place.query,
      routeCity: place.routeCity || undefined,
      coordinates: { latitude: place.lat, longitude: place.lng },
      updatedAt: "2026-05-04T00:00:00.000Z",
    };
  }

  for (const { fromId, toId } of pairs) {
    const from = places.get(fromId);
    const to = places.get(toId);
    if (!from || !to) continue;

    const fromSignature = buildSignature(
      from.id,
      from.name,
      from.address,
      from.area,
      from.lat,
      from.lng,
    );
    const toSignature = buildSignature(
      to.id,
      to.name,
      to.address,
      to.area,
      to.lat,
      to.lng,
    );
    const cacheKey = createCacheKey(fromSignature, toSignature);

    const fromCoords: TripRouteCoordinates = {
      latitude: from.lat,
      longitude: from.lng,
    };
    const toCoords: TripRouteCoordinates = {
      latitude: to.lat,
      longitude: to.lng,
    };
    const directDistance = getHaversineDistanceKm(fromCoords, toCoords);

    const amapRoutes = findSeedAmapRoute(fromId, toId);
    const amapModeMap = new Map(amapRoutes?.map((r) => [r.mode, r.data]) ?? []);

    const modeOptions: TripRouteModeOption[] = ROUTE_MODES.map((mode) => {
      const amapData = amapModeMap.get(mode);

      if (amapData) {
        const distanceKm = Number((amapData.distanceMeters / 1000).toFixed(2));
        const durationMinutes = Math.max(
          1,
          Math.round(amapData.durationSeconds / 60),
        );
        return {
          mode: mode as TripRouteModeOption["mode"],
          label: MODE_LABEL[mode] ?? mode,
          distanceKm,
          durationMinutes,
          source: "amap" as const,
          polyline: amapData.polyline,
        };
      }

      const option = estimateModeOption(mode, directDistance);
      option.polyline = [fromCoords, toCoords];
      return option;
    }).sort((a, b) => {
      if (a.mode === "transit" && b.mode !== "transit") return 1;
      if (a.mode !== "transit" && b.mode === "transit") return -1;
      return a.durationMinutes - b.durationMinutes;
    });

    const entry: TripRouteSegmentCacheEntry = {
      status: "ready",
      provider: "amap",
      fromSignature,
      toSignature,
      fromLabel: from.name,
      toLabel: to.name,
      fromQuery: from.query,
      toQuery: to.query,
      fromCoordinates: fromCoords,
      toCoordinates: toCoords,
      modeOptions,
      updatedAt: "2026-05-04T00:00:00.000Z",
    };

    entries[cacheKey] = entry;
  }

  return { entries, geocodes };
}

export async function clearSeedRouteCacheMarker(): Promise<void> {
  try {
    await routeCacheStorage.removeItem(SEED_ROUTE_CACHE_MARKER_KEY);
  } catch {}
}

export async function seedRouteCacheIfNeeded(): Promise<void> {
  try {
    const marker = await routeCacheStorage.getItem(SEED_ROUTE_CACHE_MARKER_KEY);
    if (marker === "true") return;

    const { entries, geocodes } = buildSeedRouteCacheData();
    if (Object.keys(entries).length === 0) return;

    let existingStore: RouteCacheStore = {
      version: 14,
      entries: {},
      geocodes: {},
    };
    try {
      const raw = await routeCacheStorage.getItem(ROUTE_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.version === 14) {
          existingStore = parsed as RouteCacheStore;
        }
      }
    } catch {}

    for (const [key, entry] of Object.entries(entries)) {
      if (!existingStore.entries[key]) {
        existingStore.entries[key] = entry;
      }
    }
    for (const [key, geocode] of Object.entries(geocodes)) {
      if (!existingStore.geocodes[key]) {
        existingStore.geocodes[key] = geocode;
      }
    }

    await routeCacheStorage.setItem(
      ROUTE_CACHE_STORAGE_KEY,
      JSON.stringify(existingStore),
    );
    await routeCacheStorage.setItem(SEED_ROUTE_CACHE_MARKER_KEY, "true");

    seedRouteCacheLogger.info(
      "prefill.succeeded",
      {
        geocodeCount: Object.keys(geocodes).length,
        routeCount: Object.keys(entries).length,
      },
      "Seed route cache prefill succeeded",
    );
  } catch (error) {
    seedRouteCacheLogger.warn(
      "prefill.failed",
      { error },
      "Seed route cache prefill failed",
    );
  }
}
