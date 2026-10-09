import { useMemo } from "react";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  type AmapJsFitPadding,
  type AmapJsMarker,
  type AmapJsPolygon,
  type AmapJsPolyline,
  buildRoutePreviewPolylines,
  flattenRoutePreviewCoordinates,
  getAmapMapVisualPreset,
  getPlaceForTripDayItem,
  getPlaceMapBoundaryPaths,
  hasSelectedSegmentRouteGeometry,
  type Trip,
  type TripDay,
  type TripDayItem,
  type TripDayRouteSegment,
  type TripPlace,
  type TripRouteCoordinates,
  type TripRouteMode,
  type TripRouteSegmentResult,
} from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { AmapPreviewMap } from "./amap-preview-map";

type DayRouteMapProps = {
  activeStopId?: string;
  day: TripDay;
  fitBottomInset?: number;
  immersiveControlsTop?: number;
  immersive?: boolean;
  isLoading?: boolean;
  items: TripDayItem[];
  onNavigateSegment?: (segmentId: string) => void;
  onStopPress?: (item: TripDayItem, place?: TripPlace) => void;
  results: Record<string, TripRouteSegmentResult>;
  selectedModes: Record<string, TripRouteMode>;
  segments: TripDayRouteSegment[];
  style?: StyleProp<ViewStyle>;
  trip: Trip;
};

type RouteStop = {
  coordinate?: TripRouteCoordinates;
  item: TripDayItem;
  place?: TripPlace;
};

const IMMERSIVE_CONTROL_RIGHT_OFFSET = "14px";
const IMMERSIVE_FIT_VIEW_CONTROL_GAP = 36;
const IMMERSIVE_ZOOM_CONTROL_HEIGHT = 74;
const IMMERSIVE_CONTROL_FALLBACK_TOP = 118;

function isFiniteCoordinate(value?: {
  latitude?: number;
  longitude?: number;
}): value is TripRouteCoordinates {
  if (
    !value ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number"
  ) {
    return false;
  }

  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}

function getStops(items: TripDayItem[], trip: Trip): RouteStop[] {
  return items.map((item) => {
    const place = getPlaceForTripDayItem(trip, item);
    const coordinate = isFiniteCoordinate(place)
      ? {
          latitude: place.latitude,
          longitude: place.longitude,
        }
      : undefined;

    return {
      item,
      place,
      coordinate,
    };
  });
}

function getRouteFitPadding(
  immersive: boolean,
  fitBottomInset?: number,
): AmapJsFitPadding {
  return [
    immersive ? 92 : 68,
    Math.max(fitBottomInset ?? (immersive ? 220 : 160), immersive ? 208 : 144),
    immersive ? 30 : 36,
    immersive ? 30 : 36,
  ];
}

export function DayRouteMap({
  activeStopId,
  day,
  fitBottomInset,
  immersiveControlsTop,
  immersive = false,
  isLoading = false,
  items,
  onStopPress,
  results,
  selectedModes,
  segments,
  style,
  trip,
}: DayRouteMapProps) {
  const theme = useAppTheme();
  const visualPreset = useMemo(
    () => getAmapMapVisualPreset(undefined, theme.mode),
    [theme.mode],
  );
  const stops = useMemo(() => getStops(items, trip), [items, trip]);
  const activeStopIndex = stops.findIndex(
    (stop) => stop.item.id === activeStopId,
  );
  const coordinates = useMemo(
    () =>
      stops
        .map((stop) => stop.coordinate)
        .filter((coordinate): coordinate is TripRouteCoordinates =>
          isFiniteCoordinate(coordinate),
        ),
    [stops],
  );
  const routePolylines = useMemo(
    () =>
      buildRoutePreviewPolylines(coordinates, segments, results, selectedModes),
    [coordinates, results, segments, selectedModes],
  );
  const hasAnyRouteGeometry = useMemo(
    () =>
      segments.some((segment) =>
        hasSelectedSegmentRouteGeometry(segment, results, selectedModes),
      ),
    [results, segments, selectedModes],
  );
  const shouldHideFallbackPolylines =
    isLoading && segments.length > 0 && !hasAnyRouteGeometry;
  const markers = useMemo<AmapJsMarker[]>(
    () =>
      stops
        .filter(
          (stop): stop is RouteStop & { coordinate: TripRouteCoordinates } =>
            isFiniteCoordinate(stop.coordinate),
        )
        .map((stop, index) => {
          const color =
            theme.routeMap.marker.palette[
              index % theme.routeMap.marker.palette.length
            ] ?? theme.routeMap.marker.palette[0];

          return {
            activeLabel: stop.item.title,
            activeLabelDesktopMaxLength:
              theme.routeMap.marker.desktopNameMaxLength,
            activeLabelMobileMaxLength:
              theme.routeMap.marker.mobileNameMaxLength,
            appearance: "routeStop" as const,
            backgroundColor: color.background,
            id: stop.item.id,
            coordinate: stop.coordinate,
            label: `${index + 1}`,
            textColor: color.text,
            title: stop.item.title,
          };
        }),
    [stops, theme.routeMap.marker],
  );
  const polylines = useMemo<AmapJsPolyline[]>(() => {
    if (shouldHideFallbackPolylines) {
      return [];
    }

    return routePolylines
      .filter((polyline) => polyline.length >= 2)
      .map((polyline, index) => {
        const segment = segments[index];
        const hasRouteGeometry = segment
          ? hasSelectedSegmentRouteGeometry(segment, results, selectedModes)
          : true;
        const isActiveSegment =
          activeStopIndex >= 0 &&
          (index === activeStopIndex ||
            (activeStopIndex === stops.length - 1 &&
              index === activeStopIndex - 1));

        return {
          id: segment?.id ?? `route-${index}`,
          color: theme.routeMap.route.color,
          coordinates: polyline,
          dashArray: hasRouteGeometry
            ? undefined
            : [...theme.routeMap.route.estimatedPattern],
          directionColor: theme.routeMap.route.outlineColor,
          opacity: hasRouteGeometry
            ? isActiveSegment
              ? theme.routeMap.route.selectedOpacity
              : theme.routeMap.route.normalOpacity
            : theme.routeMap.route.estimatedOpacity,
          outlineColor: theme.routeMap.route.outlineColor,
          outlineWidth: theme.routeMap.route.outlineWidth,
          showDirection: hasRouteGeometry && isActiveSegment,
          strokeStyle: hasRouteGeometry ? "solid" : "dashed",
          width: isActiveSegment
            ? theme.routeMap.route.selectedWidth
            : theme.routeMap.route.normalWidth,
        };
      });
  }, [
    activeStopIndex,
    results,
    routePolylines,
    segments,
    selectedModes,
    shouldHideFallbackPolylines,
    stops.length,
    theme.routeMap.route,
  ]);
  const fitCoordinates = useMemo(() => {
    const routeGeometryCoordinates = shouldHideFallbackPolylines
      ? []
      : flattenRoutePreviewCoordinates(routePolylines);

    if (routeGeometryCoordinates.length >= 2) {
      return routeGeometryCoordinates;
    }

    return coordinates;
  }, [coordinates, routePolylines, shouldHideFallbackPolylines]);
  const routeFitPadding = useMemo(
    () => getRouteFitPadding(immersive, fitBottomInset),
    [fitBottomInset, immersive],
  );
  const immersiveToolbarPosition = useMemo(
    () => ({
      right: IMMERSIVE_CONTROL_RIGHT_OFFSET,
      top: `${Math.round(immersiveControlsTop ?? IMMERSIVE_CONTROL_FALLBACK_TOP)}px`,
    }),
    [immersiveControlsTop],
  );
  const immersiveFitViewControl = useMemo(
    () => ({
      label: "回到地点",
      position: {
        right: IMMERSIVE_CONTROL_RIGHT_OFFSET,
        top: `${Math.round(
          (immersiveControlsTop ?? IMMERSIVE_CONTROL_FALLBACK_TOP) +
            IMMERSIVE_ZOOM_CONTROL_HEIGHT +
            IMMERSIVE_FIT_VIEW_CONTROL_GAP,
        )}px`,
      },
      title: "回到当天地点视野",
    }),
    [immersiveControlsTop],
  );
  const polygons = useMemo<AmapJsPolygon[]>(
    () =>
      stops.flatMap((stop) => {
        if (!stop.place) {
          return [];
        }

        const paths = getPlaceMapBoundaryPaths(stop.place);

        if (paths.length === 0) {
          return [];
        }

        return [
          {
            id: `place-boundary-${stop.place.id}`,
            fillColor: theme.routeMap.route.color,
            fillOpacity: theme.routeMap.area.fillOpacity,
            paths,
            strokeColor: theme.routeMap.route.color,
            strokeOpacity: theme.routeMap.area.strokeOpacity,
            strokeWidth: theme.routeMap.area.strokeWidth,
          },
        ];
      }),
    [stops, theme.routeMap],
  );

  return (
    <View
      style={[
        styles.container,
        style,
        {
          backgroundColor: theme.colors.border,
        },
      ]}
    >
      <AmapPreviewMap
        activeMarkerId={activeStopId}
        fitCoordinates={fitCoordinates.length > 0 ? fitCoordinates : undefined}
        fitPadding={routeFitPadding}
        markers={markers}
        maxFitZoom={17}
        onMarkerPress={(markerId) => {
          const stop = stops.find((item) => item.item.id === markerId);

          if (stop) {
            onStopPress?.(stop.item, stop.place);
          }
        }}
        placeholderDescription="请配置 EXPO_PUBLIC_AMAP_JS_API_KEY 和 EXPO_PUBLIC_AMAP_JS_API_SECURITY_CODE 后查看可交互路线地图"
        placeholderTitle="高德 JS 地图待配置"
        polylines={polylines}
        polygons={polygons}
        style={styles.map}
        fitViewControl={
          immersive && markers.length > 0 ? immersiveFitViewControl : undefined
        }
        toolbarPosition={immersive ? immersiveToolbarPosition : undefined}
        visualPreset={visualPreset.name}
      />

      {!immersive ? (
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.glassStrong,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetCopy}>
              <Text
                style={[
                  styles.sheetEyebrow,
                  { color: theme.colors.textSubtle },
                ]}
              >
                {day.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.sheetTitle, { color: theme.colors.text }]}
              >
                {items.length} 个地点
              </Text>
            </View>
          </View>

          <View style={styles.stopList}>
            {stops.map((stop, index) => {
              const color =
                theme.routeMap.marker.palette[
                  index % theme.routeMap.marker.palette.length
                ] ?? theme.routeMap.marker.palette[0];

              return (
                <Pressable
                  accessibilityRole="button"
                  key={stop.item.id}
                  onPress={() => onStopPress?.(stop.item, stop.place)}
                  style={({ pressed }) => [
                    styles.stopRow,
                    pressed && { backgroundColor: theme.colors.surfaceSubtle },
                  ]}
                >
                  <View
                    style={[
                      styles.stopIndex,
                      stop.coordinate
                        ? {
                            backgroundColor:
                              color?.background ?? theme.colors.primary,
                          }
                        : {
                            backgroundColor: theme.colors.surfaceSubtle,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopIndexText,
                        stop.coordinate
                          ? {
                              color: color?.text ?? theme.colors.onPrimary,
                            }
                          : { color: theme.colors.textSubtle },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.stopCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.stopTitle, { color: theme.colors.text }]}
                    >
                      {stop.item.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.stopMeta,
                        { color: theme.colors.textSubtle },
                      ]}
                    >
                      {stop.coordinate ? "已定位" : "等待地点坐标"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 360,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: "absolute",
    right: 10,
    bottom: 10,
    left: 10,
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 0,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: "800",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  stopList: {
    gap: 4,
  },
  stopRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0,
  },
  stopIndexText: {
    fontSize: 10,
    fontWeight: "700",
  },
  stopCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  stopTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  stopMeta: {
    fontSize: 11,
    fontWeight: "700",
  },
});
