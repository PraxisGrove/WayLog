import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";
import {
  formatTemperatureRange,
  type TripWeatherCondition,
  type TripWeatherDayForecast,
} from "@/features/weather";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";
function getWeatherIconName(
  condition?: TripWeatherCondition,
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
    default:
      return "wb-cloudy";
  }
}

type PlaceWeatherPalette = {
  accent: string;
  background: string;
  border: string;
  iconBackground: string;
  metricBackground: string;
  mutedText: string;
  text: string;
};

function getPlaceWeatherPalette(
  condition: TripWeatherCondition | undefined,
  theme: ReturnType<typeof useAppTheme>,
): PlaceWeatherPalette {
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
    background: theme.colors.surfaceSubtle,
    border: theme.colors.border,
    iconBackground,
    metricBackground: theme.colors.surface,
    mutedText: theme.colors.textMuted,
    text: theme.colors.text,
  };
}

export function PlaceWeatherPreview({
  forecast,
  hasCoordinates,
  isLoading,
  scheduleDayTitle,
  styles,
  weatherContentScale,
}: {
  forecast?: TripWeatherDayForecast;
  hasCoordinates: boolean;
  isLoading: boolean;
  scheduleDayTitle?: string;
  styles: ReturnType<typeof createPlaceDetailStyles>;
  weatherContentScale: number;
}) {
  const theme = useAppTheme();
  const palette = getPlaceWeatherPalette(forecast?.condition, theme);
  const compactScheduleDayTitle = scheduleDayTitle?.split("·")[0]?.trim();
  const weatherMetaLabel = forecast
    ? [compactScheduleDayTitle, forecast.label].filter(Boolean).join(" · ")
    : "";
  const statusTitle = isLoading ? "天气同步中" : "天气待同步";
  const statusDescription = isLoading
    ? "正在读取当前地点天气"
    : hasCoordinates
      ? "天气数据暂不可用"
      : "补充地点坐标后可查看天气";

  return (
    <View
      style={[
        styles.weatherPanel,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          shadowColor: palette.accent,
        },
      ]}
    >
      <View style={styles.weatherTopRow}>
        <View style={styles.weatherEyebrowRow}>
          <View
            style={[
              styles.weatherAccentDot,
              { backgroundColor: palette.accent },
            ]}
          />
          <Text style={[styles.weatherEyebrow, { color: palette.mutedText }]}>
            当前地点天气
          </Text>
        </View>
        {forecast ? (
          <View
            style={[
              styles.weatherSourceCompact,
              { backgroundColor: palette.metricBackground },
            ]}
          >
            <MaterialIcons
              name="cloud-queue"
              size={12 * weatherContentScale}
              color={palette.mutedText}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.weatherSourceCompactText,
                { color: palette.mutedText },
              ]}
            >
              {forecast.source.label}
            </Text>
          </View>
        ) : null}
      </View>
      {forecast ? (
        <>
          <View style={styles.weatherHeroRow}>
            <View style={styles.weatherHeroCopy}>
              <Text
                numberOfLines={1}
                style={[styles.weatherTemperature, { color: palette.text }]}
              >
                {formatTemperatureRange(
                  forecast.temperatureLow,
                  forecast.temperatureHigh,
                )}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.weatherMetaLine, { color: palette.mutedText }]}
              >
                <Text style={{ color: palette.accent }}>
                  {forecast.conditionLabel}
                </Text>
                {weatherMetaLabel ? ` · ${weatherMetaLabel}` : ""}
              </Text>
            </View>
            <View
              style={[
                styles.weatherIconBubble,
                { backgroundColor: palette.iconBackground },
              ]}
            >
              <MaterialIcons
                name={getWeatherIconName(forecast.condition)}
                size={31 * weatherContentScale}
                color={palette.accent}
              />
            </View>
          </View>
          <View style={styles.weatherMetricsRow}>
            <WeatherMetric
              accent={palette.accent}
              backgroundColor={palette.metricBackground}
              icon="air"
              label="风力"
              mutedColor={palette.mutedText}
              styles={styles}
              textColor={palette.text}
              value={forecast.windLevel}
              weatherContentScale={weatherContentScale}
            />
            <WeatherMetric
              accent={palette.accent}
              backgroundColor={palette.metricBackground}
              icon="wb-sunny"
              label="UV"
              mutedColor={palette.mutedText}
              styles={styles}
              textColor={palette.text}
              value={`${forecast.uvIndex}`}
              weatherContentScale={weatherContentScale}
            />
            <WeatherMetric
              accent={palette.accent}
              backgroundColor={palette.metricBackground}
              icon="grain"
              label="降雨"
              mutedColor={palette.mutedText}
              styles={styles}
              textColor={palette.text}
              value={`${forecast.precipitationChance}%`}
              weatherContentScale={weatherContentScale}
            />
          </View>
          <View style={styles.weatherFooter}>
            <View style={styles.weatherRiskRow}>
              {(forecast.riskLabels.length > 0
                ? forecast.riskLabels.slice(0, 2)
                : ["适合出行"]
              ).map((label) => (
                <View
                  key={label}
                  style={[
                    styles.weatherRiskBadge,
                    { backgroundColor: palette.iconBackground },
                  ]}
                >
                  <View
                    style={[
                      styles.weatherRiskDot,
                      { backgroundColor: palette.accent },
                    ]}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.weatherRiskBadgeText,
                      { color: palette.accent },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.weatherEmptyState}>
          <View
            style={[
              styles.weatherIconBubble,
              { backgroundColor: palette.iconBackground },
            ]}
          >
            <MaterialIcons
              name={getWeatherIconName()}
              size={31 * weatherContentScale}
              color={palette.accent}
            />
          </View>
          <Text style={[styles.weatherEmptyTitle, { color: palette.text }]}>
            {statusTitle}
          </Text>
          <Text
            style={[
              styles.weatherEmptyDescription,
              { color: palette.mutedText },
            ]}
          >
            {statusDescription}
          </Text>
        </View>
      )}
    </View>
  );
}

export function WeatherMetric({
  accent,
  backgroundColor,
  icon,
  label,
  mutedColor,
  styles,
  textColor,
  value,
  weatherContentScale,
}: {
  accent: string;
  backgroundColor: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  mutedColor: string;
  styles: ReturnType<typeof createPlaceDetailStyles>;
  textColor: string;
  value: string;
  weatherContentScale: number;
}) {
  return (
    <View style={[styles.weatherMetric, { backgroundColor }]}>
      <View style={styles.weatherMetricLabelRow}>
        <MaterialIcons
          name={icon}
          size={13 * weatherContentScale}
          color={accent}
        />
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={[styles.weatherMetricLabel, { color: mutedColor }]}
        >
          {label}
        </Text>
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.weatherMetricValue, { color: textColor }]}
      >
        {value}
      </Text>
    </View>
  );
}
