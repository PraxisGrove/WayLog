import { Platform } from "react-native";

import { DayRouteMap as NativeDayRouteMap } from "./day-route-map.native";
import { DayRouteMap as WebDayRouteMap } from "./day-route-map.web";

export const DayRouteMap =
  Platform.OS === "web" ? WebDayRouteMap : NativeDayRouteMap;
