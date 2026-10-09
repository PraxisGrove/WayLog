import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, Pressable, Text, View } from "react-native";
import type { TripPlace } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function getOsmTileUrl(
  latitude: number,
  longitude: number,
  zoom: number,
): string {
  const n = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const latRad = (latitude * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return `https://basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`;
}

function getOsmPreviewZoom(iconKey?: TripPlace["iconKey"]): number {
  switch (iconKey) {
    case "airport":
      return 12;
    case "park":
    case "viewpoint":
    case "attraction":
      return 13;
    case "university":
    case "library":
    case "research":
    case "school":
      return 14;
    case "museum":
    case "temple":
    case "landmark":
      return 15;
    default:
      return 16;
  }
}

export function PlaceMapPreview({
  dashboardScale,
  isReady,
  onPress,
  place,
  styles,
}: {
  dashboardScale: number;
  isReady: boolean;
  onPress?: () => void;
  place: TripPlace;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  const latitude = place.latitude;
  const longitude = place.longitude;
  const hasMapCoordinates =
    isFiniteCoordinate(latitude) && isFiniteCoordinate(longitude);
  const zoom = getOsmPreviewZoom(place.iconKey);
  const tileUrl =
    isReady && hasMapCoordinates
      ? getOsmTileUrl(latitude, longitude, zoom)
      : undefined;
  const scaledIconSize = (size: number) => size * dashboardScale;

  return (
    <View style={styles.mapPanel}>
      <View style={styles.mapCanvas}>
        {tileUrl ? (
          <View style={styles.osmMapContainer}>
            <Image
              source={{ uri: tileUrl }}
              style={styles.osmMapImage}
              resizeMode="cover"
            />
            <View style={styles.osmMapMarker}>
              <MaterialIcons
                name="location-pin"
                size={scaledIconSize(28)}
                color={theme.colors.danger}
              />
            </View>
            <View style={styles.osmMapAttribution}>
              <Text style={styles.osmMapAttributionText}>
                © CARTO © OpenStreetMap
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <MaterialIcons
              name="map"
              size={scaledIconSize(24)}
              color={theme.colors.textMuted}
            />
            <Text style={styles.mapPlaceholderText}>
              {hasMapCoordinates ? "地图加载中" : "坐标待补"}
            </Text>
          </View>
        )}
        <View style={styles.mapOverlayAction}>
          {onPress ? (
            <Pressable
              accessibilityHint="打开这个地点的外部地图"
              accessibilityLabel={`打开${place.name}的地图`}
              accessibilityRole="link"
              hitSlop={10}
              onPress={onPress}
              style={({ pressed }) => [
                styles.mapOverlayButton,
                pressed && styles.mapOverlayButtonPressed,
              ]}
            >
              <MaterialIcons
                name="navigation"
                size={scaledIconSize(19)}
                color={theme.colors.primary}
              />
            </Pressable>
          ) : (
            <View style={styles.mapOverlayButton}>
              <MaterialIcons
                name="my-location"
                size={scaledIconSize(19)}
                color={theme.colors.primary}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
