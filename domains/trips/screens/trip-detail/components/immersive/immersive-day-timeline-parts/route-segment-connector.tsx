import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import {
  getRouteSegmentSelectedOption,
  getRouteSegmentStatusText,
  getTripRouteModeLabel,
  type TripRouteMode,
  type TripRouteSegmentResult,
} from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { createImmersiveDayTimelineStyles } from "./styles";

const routeModeIconMap: Record<
  TripRouteMode,
  keyof typeof MaterialIcons.glyphMap
> = {
  cycling: "directions-bike",
  driving: "directions-car",
  transit: "directions-bus",
  walking: "directions-walk",
};

type RouteSegmentConnectorProps = {
  isPending?: boolean;
  onPress: () => void;
  result?: TripRouteSegmentResult;
  selectedMode?: TripRouteMode;
};

export function RouteSegmentConnector({
  isPending = false,
  onPress,
  result,
  selectedMode,
}: RouteSegmentConnectorProps) {
  const theme = useAppTheme();
  const styles = useMemo(
    () => createImmersiveDayTimelineStyles(theme),
    [theme],
  );
  const option = getRouteSegmentSelectedOption(result, selectedMode);
  const mode = option?.mode ?? selectedMode;
  const icon = mode ? routeModeIconMap[mode] : "near-me";
  const isUnavailable = result?.entry.status === "unavailable";

  return (
    <Pressable
      accessibilityLabel="查看地点之间的交通信息"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.routeConnector,
        isUnavailable && styles.routeConnectorMuted,
        pressed && styles.routeConnectorPressed,
      ]}
    >
      <View style={styles.routeConnectorMain}>
        <MaterialIcons
          name={icon}
          size={18}
          color={isUnavailable ? theme.colors.textSubtle : theme.colors.link}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.routeConnectorLabel,
            { color: theme.colors.link },
            isUnavailable && styles.routeConnectorLabelMuted,
            isUnavailable && { color: theme.colors.textSubtle },
          ]}
        >
          {mode ? getTripRouteModeLabel(mode) : "交通"}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.routeConnectorMeta, { color: theme.colors.textMuted }]}
        >
          {getRouteSegmentStatusText(result, option, isPending)}
        </Text>
      </View>
      <View style={styles.routeConnectorAction}>
        <Text
          style={[
            styles.routeConnectorActionText,
            { color: theme.colors.primary },
          ]}
        >
          导航
        </Text>
        <MaterialIcons
          name="chevron-right"
          size={18}
          color={theme.colors.primary}
        />
      </View>
    </Pressable>
  );
}
