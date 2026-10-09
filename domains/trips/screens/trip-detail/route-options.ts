import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

import type { TripRouteMode, TripRoutePreferredMode } from "@/features/trips";

export const routeModeIconMap: Record<
  TripRouteMode,
  keyof typeof MaterialIcons.glyphMap
> = {
  cycling: "directions-bike",
  driving: "directions-car",
  transit: "directions-bus",
  walking: "directions-walk",
};

export const routePreferredModeOptions: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: TripRoutePreferredMode;
}[] = [
  { icon: "auto-awesome", label: "智能", value: "auto" },
  { icon: "directions-walk", label: "步行", value: "walking" },
  { icon: "directions-bike", label: "骑行", value: "cycling" },
  { icon: "directions-bus", label: "公交", value: "transit" },
  { icon: "directions-car", label: "驾车", value: "driving" },
];
