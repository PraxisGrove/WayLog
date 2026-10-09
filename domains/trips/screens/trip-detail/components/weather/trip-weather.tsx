import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  getTripWeatherSourceBadgeLabel,
  type TripWeatherCondition,
  type TripWeatherDayForecast,
} from "@/features/weather";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type WeatherPalette = {
  accent: string;
  background: string;
  border: string;
  iconBackground: string;
  metricBackground: string;
  mutedText: string;
  text: string;
};

export function getWeatherIconName(
  condition: TripWeatherCondition,
): keyof typeof MaterialIcons.glyphMap {
  switch (condition) {
    case "sunny":
      return "wb-sunny";
    case "cloudy":
      return "cloud-queue";
    case "rain":
      return "grain";
    case "storm":
      return "thunderstorm";
    case "hot":
      return "local-fire-department";
    case "windy":
      return "air";
    case "foggy":
      return "filter-drama";
  }
}

function getWeatherPalette(
  condition: TripWeatherCondition,
  theme: AppTheme,
  isInline: boolean,
): WeatherPalette {
  const isDark = theme.mode === "dark";
  const accent =
    condition === "rain" || condition === "storm"
      ? isDark
        ? "#22D3EE"
        : "#0891B2"
      : condition === "hot" || condition === "sunny"
        ? isDark
          ? "#FB923C"
          : "#EA580C"
        : condition === "windy" || condition === "foggy"
          ? isDark
            ? "#CBD5E1"
            : "#475569"
          : isDark
            ? "#60A5FA"
            : "#2563EB";
  const iconBackground =
    condition === "rain" || condition === "storm"
      ? isDark
        ? "#123746"
        : "#ECFEFF"
      : condition === "hot" || condition === "sunny"
        ? isDark
          ? "#43230F"
          : "#FFF7ED"
        : condition === "windy" || condition === "foggy"
          ? theme.colors.surfacePressed
          : isDark
            ? "#172D52"
            : "#EFF6FF";

  return {
    accent,
    background: isInline ? theme.colors.surfaceSubtle : theme.colors.surface,
    border: theme.colors.border,
    iconBackground,
    metricBackground: theme.colors.surfaceMuted,
    mutedText: theme.colors.textMuted,
    text: theme.colors.text,
  };
}

type DayWeatherBannerProps = {
  forecast: TripWeatherDayForecast;
  style?: StyleProp<ViewStyle>;
  variant?: "card" | "inline";
};

export function DayWeatherBanner({
  forecast,
  style,
  variant = "card",
}: DayWeatherBannerProps) {
  const theme = useAppTheme();
  const locationLabel = forecast.location?.name ?? "地点未定";
  const isInline = variant === "inline";
  const sourceBadgeLabel = getTripWeatherSourceBadgeLabel(forecast.source);
  const palette = getWeatherPalette(forecast.condition, theme, isInline);

  return (
    <View
      style={[
        styles.dayWeatherBanner,
        isInline ? styles.dayWeatherBannerInline : styles.dayWeatherBannerCard,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.dayWeatherIcon,
          isInline ? styles.dayWeatherIconInline : styles.dayWeatherIconCard,
          { backgroundColor: palette.iconBackground },
        ]}
      >
        <MaterialIcons
          name={getWeatherIconName(forecast.condition)}
          size={isInline ? 18 : 21}
          color={palette.accent}
        />
      </View>
      <View style={styles.dayWeatherCopy}>
        <View style={styles.dayWeatherTitleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.dayWeatherTitle,
              isInline
                ? styles.dayWeatherTitleInline
                : styles.dayWeatherTitleCard,
              { color: palette.text },
            ]}
          >
            {locationLabel}
          </Text>
          {sourceBadgeLabel ? (
            <Text
              style={[
                styles.dayWeatherSourceBadge,
                isInline && styles.dayWeatherSourceBadgeInline,
                {
                  backgroundColor: palette.metricBackground,
                  color: palette.mutedText,
                },
              ]}
            >
              {sourceBadgeLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.dayWeatherMetaRow}>
          <View
            style={[
              styles.dayWeatherMetricPill,
              isInline && styles.dayWeatherMetricPillInline,
              {
                backgroundColor: palette.metricBackground,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.dayWeatherMeta,
                isInline
                  ? styles.dayWeatherMetaInline
                  : styles.dayWeatherMetaCard,
                { color: palette.accent },
              ]}
            >
              {forecast.conditionLabel}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.dayWeatherMeta,
              isInline
                ? styles.dayWeatherMetaInline
                : styles.dayWeatherMetaCard,
              { color: palette.mutedText },
            ]}
          >
            {`${forecast.temperatureLow}-${forecast.temperatureHigh}°C`}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.dayWeatherMeta,
              isInline
                ? styles.dayWeatherMetaInline
                : styles.dayWeatherMetaCard,
              styles.dayWeatherMetaAccent,
              { color: palette.mutedText },
            ]}
          >
            {`降雨 ${forecast.precipitationChance}%`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayWeatherBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  dayWeatherBannerCard: {
    padding: 12,
  },
  dayWeatherBannerInline: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayWeatherIcon: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayWeatherIconCard: {
    width: 34,
    height: 34,
  },
  dayWeatherIconInline: {
    width: 32,
    height: 32,
  },
  dayWeatherCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  dayWeatherTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayWeatherMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dayWeatherTitle: {
    flex: 1,
    minWidth: 0,
    fontWeight: "700",
  },
  dayWeatherTitleCard: {
    fontSize: 14,
  },
  dayWeatherTitleInline: {
    fontSize: 15,
  },
  dayWeatherSourceBadge: {
    flexShrink: 0,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: "700",
  },
  dayWeatherSourceBadgeInline: {
    paddingHorizontal: 6,
  },
  dayWeatherMetricPill: {
    maxWidth: 74,
    flexShrink: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayWeatherMetricPillInline: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dayWeatherMeta: {
    fontWeight: "600",
  },
  dayWeatherMetaCard: {
    fontSize: 12,
    lineHeight: 17,
  },
  dayWeatherMetaInline: {
    fontSize: 12,
    lineHeight: 16,
  },
  dayWeatherMetaAccent: {
    flexShrink: 0,
  },
});
