import type { TripRouteCoordinates } from "./route-segments";

interface SeedRouteModeData {
  distanceMeters: number;
  durationSeconds: number;
  polyline: TripRouteCoordinates[];
}

interface SeedRouteData {
  from: string;
  to: string;
  modes: Record<string, SeedRouteModeData>;
}

// 公开源码不预填供应商路线快照；实际路线由运行时按需查询。
export const SEED_AMAP_ROUTES: SeedRouteData[] = [];

export function findSeedAmapRoute(
  fromId: string,
  toId: string,
): { mode: string; data: SeedRouteModeData }[] | null {
  const forward = SEED_AMAP_ROUTES.find(
    (r) => r.from === fromId && r.to === toId,
  );
  if (forward) {
    return Object.entries(forward.modes).map(([mode, data]) => ({
      mode,
      data,
    }));
  }

  const reverse = SEED_AMAP_ROUTES.find(
    (r) => r.from === toId && r.to === fromId,
  );
  if (reverse) {
    return Object.entries(reverse.modes).map(([mode, data]) => ({
      mode,
      data: {
        ...data,
        polyline: [...data.polyline].reverse(),
      },
    }));
  }

  return null;
}
