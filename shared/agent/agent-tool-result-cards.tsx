import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { AgentConversationToolResult } from "@/features/agent";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type AgentToolResultCardStatus = "error" | "loading" | "success";

export type AgentToolResultBase = {
  errorMessage?: string;
  sourceLabel?: string;
  status?: AgentToolResultCardStatus;
  updatedAtLabel?: string;
};

export type AgentTimeToolResultCardData = AgentToolResultBase & {
  dateLabel: string;
  kind: "time";
  localTime: string;
  timeZone: string;
  weekday: string;
};

export type AgentWeatherToolResultCardData = AgentToolResultBase & {
  conditionLabel: string;
  dateLabel?: string;
  kind: "weather";
  locationName: string;
  precipitationLabel?: string;
  suggestion?: string;
  temperatureLabel: string;
  windLabel?: string;
};

export type AgentRouteToolResultCardData = AgentToolResultBase & {
  distanceLabel: string;
  durationLabel: string;
  fromLabel: string;
  kind: "route";
  modeLabel: string;
  toLabel: string;
};

export type AgentPoiToolResultCandidate = {
  address?: string;
  area?: string;
  category?: string;
  confidenceLabel?: string;
  name: string;
  ratingLabel?: string;
  sourceLabel?: string;
};

export type AgentPoiToolResultCardData = AgentToolResultBase & {
  candidates: AgentPoiToolResultCandidate[];
  kind: "poi";
  query: string;
};

export type AgentToolResultCardData =
  | AgentPoiToolResultCardData
  | AgentRouteToolResultCardData
  | AgentTimeToolResultCardData
  | AgentWeatherToolResultCardData;

export type AgentToolResultStackProps = {
  items: AgentToolResultCardData[];
};

export function AgentToolResultStack({ items }: AgentToolResultStackProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const keyedItems = createKeyedToolResultItems(items);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {keyedItems.map(({ item, key }) => (
        <AgentToolResultCard item={item} key={key} />
      ))}
    </View>
  );
}

export function AgentToolResultCard({
  item,
}: {
  item: AgentToolResultCardData;
}) {
  switch (item.kind) {
    case "time":
      return <AgentTimeCard data={item} />;
    case "weather":
      return <AgentWeatherCard data={item} />;
    case "route":
      return <AgentRouteEstimateCard data={item} />;
    case "poi":
      return <AgentPoiSearchCard data={item} />;
    default:
      return null;
  }
}

export function AgentTimeCard({ data }: { data: AgentTimeToolResultCardData }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ToolCardFrame
      icon="schedule"
      meta={data.sourceLabel ?? "runtime"}
      status={data.status}
      title="当前时间"
      tone="time"
      updatedAtLabel={data.updatedAtLabel}
    >
      <Text style={styles.metricMain}>{data.localTime}</Text>
      <Text style={styles.metricCaption}>
        {data.dateLabel} · {data.weekday}
      </Text>
      <View style={styles.metricGrid}>
        <MetricCell label="时区" value={data.timeZone} />
      </View>
      <ToolErrorMessage message={data.errorMessage} />
    </ToolCardFrame>
  );
}

export function AgentWeatherCard({
  data,
}: {
  data: AgentWeatherToolResultCardData;
}) {
  const styles = createStyles(useAppTheme());

  return (
    <ToolCardFrame
      icon="wb-sunny"
      meta={data.sourceLabel}
      status={data.status}
      title={data.locationName}
      tone="weather"
      updatedAtLabel={data.updatedAtLabel}
    >
      <Text style={styles.metricMain}>{data.temperatureLabel}</Text>
      <Text style={styles.metricCaption}>
        {[data.conditionLabel, data.dateLabel].filter(Boolean).join(" · ")}
      </Text>
      <View style={styles.metricGrid}>
        {data.precipitationLabel ? (
          <MetricCell label="降雨" value={data.precipitationLabel} />
        ) : null}
        {data.windLabel ? (
          <MetricCell label="风力" value={data.windLabel} />
        ) : null}
      </View>
      {data.suggestion ? (
        <Text style={styles.suggestionText}>{data.suggestion}</Text>
      ) : null}
      <ToolErrorMessage message={data.errorMessage} />
    </ToolCardFrame>
  );
}

export function AgentRouteEstimateCard({
  data,
}: {
  data: AgentRouteToolResultCardData;
}) {
  const styles = createStyles(useAppTheme());

  return (
    <ToolCardFrame
      icon="alt-route"
      meta={data.sourceLabel ?? "estimated"}
      status={data.status}
      title="路线估算"
      tone="route"
      updatedAtLabel={data.updatedAtLabel}
    >
      <Text style={styles.metricMain}>{data.durationLabel}</Text>
      <Text numberOfLines={2} style={styles.metricCaption}>
        {data.fromLabel} → {data.toLabel}
      </Text>
      <View style={styles.metricGrid}>
        <MetricCell label="距离" value={data.distanceLabel} />
        <MetricCell label="方式" value={data.modeLabel} />
      </View>
      <ToolErrorMessage message={data.errorMessage} />
    </ToolCardFrame>
  );
}

export function AgentPoiSearchCard({
  data,
}: {
  data: AgentPoiToolResultCardData;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <ToolCardFrame
      icon="travel-explore"
      meta={data.sourceLabel}
      status={data.status}
      title="地点候选"
      tone="poi"
      updatedAtLabel={data.updatedAtLabel}
    >
      <View style={styles.poiSummaryRow}>
        <Text numberOfLines={1} style={styles.primaryLine}>
          {data.query}
        </Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{data.candidates.length} 个</Text>
        </View>
      </View>
      <View style={styles.poiList}>
        {createKeyedPoiCandidates(data.candidates).map(
          ({ candidate, key, position }) => (
            <View key={key} style={styles.poiCandidateRow}>
              <View style={styles.poiCandidateIcon}>
                <Text style={styles.poiCandidateIndex}>{position}</Text>
              </View>
              <View style={styles.poiCandidateCopy}>
                <Text numberOfLines={1} style={styles.poiCandidateName}>
                  {candidate.name}
                </Text>
                <Text numberOfLines={2} style={styles.poiCandidateMeta}>
                  {[
                    candidate.category,
                    candidate.area,
                    candidate.ratingLabel,
                    candidate.confidenceLabel,
                    candidate.address,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
          ),
        )}
      </View>
      <ToolErrorMessage message={data.errorMessage} />
    </ToolCardFrame>
  );
}

function createKeyedToolResultItems(items: AgentToolResultCardData[]) {
  const counts = new Map<string, number>();

  return items.map((item) => {
    const baseKey = `${item.kind}-${getToolResultKey(item)}`;
    const count = (counts.get(baseKey) ?? 0) + 1;
    counts.set(baseKey, count);
    return { item, key: count === 1 ? baseKey : `${baseKey}-${count}` };
  });
}

function createKeyedPoiCandidates(candidates: AgentPoiToolResultCandidate[]) {
  const counts = new Map<string, number>();
  let position = 0;

  return candidates.map((candidate) => {
    position += 1;
    const baseKey = [
      candidate.name,
      candidate.address,
      candidate.area,
      candidate.category,
    ]
      .filter(Boolean)
      .join("-");
    const count = (counts.get(baseKey) ?? 0) + 1;
    counts.set(baseKey, count);
    return {
      candidate,
      key: count === 1 ? baseKey : `${baseKey}-${count}`,
      position,
    };
  });
}

type ToolCardFrameProps = {
  children: ReactNode;
  icon: IconName;
  meta?: string;
  status?: AgentToolResultCardStatus;
  title: string;
  tone: AgentToolTone;
  updatedAtLabel?: string;
};

type AgentToolTone = "poi" | "route" | "time" | "weather";

function ToolCardFrame({
  children,
  icon,
  meta,
  status = "success",
  title,
  tone,
  updatedAtLabel,
}: ToolCardFrameProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const toneStyle = getToneStyle(theme, tone);

  return (
    <View
      style={[
        styles.card,
        {
          borderTopColor: toneStyle.accentColor,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.toolIcon,
            { backgroundColor: toneStyle.iconBackground },
          ]}
        >
          {status === "loading" ? (
            <ActivityIndicator color={toneStyle.iconColor} size="small" />
          ) : (
            <MaterialIcons
              name={status === "error" ? "error-outline" : icon}
              size={17}
              color={toneStyle.iconColor}
            />
          )}
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.sourceText}>
            {[
              meta,
              updatedAtLabel,
              status !== "success" ? getToolStatusLabel(status) : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  const styles = createStyles(useAppTheme());

  return (
    <View style={styles.metricCell}>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function ToolErrorMessage({ message }: { message?: string }) {
  const styles = createStyles(useAppTheme());

  return message ? <Text style={styles.errorText}>{message}</Text> : null;
}

export function createAgentToolResultPreviewItems(): AgentToolResultCardData[] {
  return [
    {
      dateLabel: "2026-06-29",
      kind: "time",
      localTime: "22:30:15",
      sourceLabel: "runtime",
      status: "success",
      timeZone: "Asia/Shanghai",
      updatedAtLabel: "刚刚",
      weekday: "星期一",
    },
    {
      conditionLabel: "晴间多云",
      dateLabel: "今天",
      kind: "weather",
      locationName: "上海 · 武康大楼",
      precipitationLabel: "10%",
      sourceLabel: "Open-Meteo",
      status: "success",
      suggestion: "适合步行拍照，午后注意防晒。",
      temperatureLabel: "24-30°C",
      updatedAtLabel: "刚刚",
      windLabel: "2级",
    },
    {
      distanceLabel: "6.8 公里",
      durationLabel: "28 分钟",
      fromLabel: "武康大楼",
      kind: "route",
      modeLabel: "驾车",
      sourceLabel: "estimated",
      status: "success",
      toLabel: "外滩",
      updatedAtLabel: "刚刚",
    },
    {
      candidates: [
        {
          address: "淮海中路 1850 号",
          area: "上海市徐汇区",
          category: "景点",
          confidenceLabel: "高匹配",
          name: "武康大楼",
          ratingLabel: "4.7",
          sourceLabel: "高德",
        },
        {
          address: "武康路 393 号附近",
          area: "上海市徐汇区",
          category: "其他",
          confidenceLabel: "需确认",
          name: "武康路历史文化名街",
          sourceLabel: "POI 缓存",
        },
      ],
      kind: "poi",
      query: "武康大楼",
      sourceLabel: "高德 / 缓存",
      status: "success",
      updatedAtLabel: "刚刚",
    },
  ];
}

export function createAgentToolResultCardItemsFromResults(
  results: AgentConversationToolResult[] | undefined,
): AgentToolResultCardData[] {
  if (!results?.length) {
    return [];
  }

  return results
    .map(createAgentToolResultCardItemFromResult)
    .filter((item): item is AgentToolResultCardData => item !== undefined);
}

function createAgentToolResultCardItemFromResult(
  result: AgentConversationToolResult,
): AgentToolResultCardData | undefined {
  const base = {
    errorMessage: result.status === "error" ? result.error.message : undefined,
    sourceLabel: result.audit.source,
    status: result.status,
    updatedAtLabel: formatToolUpdatedAt(result.audit.finishedAt),
  } satisfies AgentToolResultBase;

  if (result.status === "error") {
    return createAgentToolErrorCard(result.toolId, base);
  }

  if (!isRecord(result.data)) {
    return undefined;
  }

  switch (result.toolId) {
    case "time.now":
      return createTimeCardData(result.data, base);
    case "weather.get":
      return createWeatherCardData(result.data, base);
    case "route.estimate":
      return createRouteCardData(result.data, base);
    case "poi.search":
      return createPoiCardData(result.data, base);
    default:
      return undefined;
  }
}

function createAgentToolErrorCard(
  toolId: AgentConversationToolResult["toolId"],
  base: AgentToolResultBase,
): AgentToolResultCardData {
  switch (toolId) {
    case "weather.get":
      return {
        ...base,
        conditionLabel: "查询失败",
        kind: "weather",
        locationName: "天气查询",
        temperatureLabel: "--",
      };
    case "route.estimate":
      return {
        ...base,
        distanceLabel: "--",
        durationLabel: "--",
        fromLabel: "起点",
        kind: "route",
        modeLabel: "--",
        toLabel: "终点",
      };
    case "poi.search":
      return {
        ...base,
        candidates: [],
        kind: "poi",
        query: "地点搜索",
      };
    default:
      return {
        ...base,
        dateLabel: "--",
        kind: "time",
        localTime: "--:--",
        timeZone: "runtime",
        weekday: "--",
      };
  }
}

function createTimeCardData(
  data: Record<string, unknown>,
  base: AgentToolResultBase,
): AgentTimeToolResultCardData | undefined {
  const localTime = readString(data.localTime);
  const dateLabel = readString(data.date);
  const weekday = readString(data.weekday);
  const timeZone = readString(data.timeZone);

  if (!localTime || !dateLabel || !weekday || !timeZone) {
    return undefined;
  }

  return {
    ...base,
    dateLabel,
    kind: "time",
    localTime,
    timeZone,
    weekday,
  };
}

function createWeatherCardData(
  data: Record<string, unknown>,
  base: AgentToolResultBase,
): AgentWeatherToolResultCardData | undefined {
  const forecast = isRecord(data.forecast) ? data.forecast : undefined;
  const placeName = readString(data.placeName);

  if (!forecast || !placeName) {
    return undefined;
  }

  const temperatureLow = readNumber(forecast.temperatureLow);
  const temperatureHigh = readNumber(forecast.temperatureHigh);
  const precipitationChance = readNumber(forecast.precipitationChance);
  const source = isRecord(forecast.source)
    ? readString(forecast.source.label)
    : undefined;

  return {
    ...base,
    conditionLabel: readString(forecast.conditionLabel) ?? "天气",
    dateLabel: readString(forecast.label) ?? readString(forecast.dateKey),
    kind: "weather",
    locationName: placeName,
    precipitationLabel:
      precipitationChance !== undefined
        ? `${Math.round(precipitationChance)}%`
        : undefined,
    sourceLabel: base.sourceLabel ?? source,
    suggestion: readString(forecast.suggestion),
    temperatureLabel:
      temperatureLow !== undefined && temperatureHigh !== undefined
        ? `${Math.round(temperatureLow)}-${Math.round(temperatureHigh)}°C`
        : "--",
    windLabel: readString(forecast.windLevel),
  };
}

function createRouteCardData(
  data: Record<string, unknown>,
  base: AgentToolResultBase,
): AgentRouteToolResultCardData | undefined {
  const from = isRecord(data.from) ? data.from : undefined;
  const to = isRecord(data.to) ? data.to : undefined;
  const distanceKm = readNumber(data.distanceKm);
  const durationMinutes = readNumber(data.durationMinutes);

  if (
    !from ||
    !to ||
    distanceKm === undefined ||
    durationMinutes === undefined
  ) {
    return undefined;
  }

  return {
    ...base,
    distanceLabel: formatDistanceLabel(distanceKm),
    durationLabel: formatDurationLabel(durationMinutes),
    fromLabel: readString(from.label) ?? "起点",
    kind: "route",
    modeLabel: readString(data.modeLabel) ?? readString(data.mode) ?? "估算",
    sourceLabel: base.sourceLabel ?? readString(data.source),
    toLabel: readString(to.label) ?? "终点",
  };
}

function createPoiCardData(
  data: Record<string, unknown>,
  base: AgentToolResultBase,
): AgentPoiToolResultCardData | undefined {
  const query = readString(data.query);
  const rawCandidates = Array.isArray(data.candidates) ? data.candidates : [];

  if (!query) {
    return undefined;
  }

  return {
    ...base,
    candidates: rawCandidates
      .map(createPoiCandidateCardData)
      .filter(
        (candidate): candidate is AgentPoiToolResultCandidate =>
          candidate !== undefined,
      ),
    kind: "poi",
    query,
  };
}

function createPoiCandidateCardData(
  value: unknown,
): AgentPoiToolResultCandidate | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = readString(value.name);

  if (!name) {
    return undefined;
  }

  return {
    address: readString(value.address),
    area: readString(value.area),
    category: readString(value.category),
    confidenceLabel:
      readNumber(value.distanceKm) !== undefined
        ? formatDistanceLabel(readNumber(value.distanceKm) ?? 0)
        : undefined,
    name,
    ratingLabel: readNumber(value.rating)?.toFixed(1),
    sourceLabel: formatPoiProviderLabel(readString(value.provider)),
  };
}

function formatDistanceLabel(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} 米`;
  }

  return `${distanceKm.toFixed(distanceKm >= 10 ? 1 : 2)} 公里`;
}

function formatDurationLabel(durationMinutes: number) {
  const roundedMinutes = Math.max(1, Math.round(durationMinutes));

  if (roundedMinutes < 60) {
    return `${roundedMinutes} 分钟`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

function formatPoiProviderLabel(provider: string | undefined) {
  if (provider === "amap") {
    return "高德";
  }

  if (provider === "poi_cache") {
    return "POI 缓存";
  }

  if (provider === "mock") {
    return "本地";
  }

  return provider;
}

function formatToolUpdatedAt(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "刚刚";
  }

  const minutes = Math.round(seconds / 60);

  return minutes < 60 ? `${minutes} 分钟前` : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getToolStatusLabel(status: AgentToolResultCardStatus) {
  switch (status) {
    case "loading":
      return "查询中";
    case "error":
      return "未完成";
    default:
      return "工具结果";
  }
}

function getToolResultKey(item: AgentToolResultCardData) {
  switch (item.kind) {
    case "time":
      return item.localTime;
    case "weather":
      return item.locationName;
    case "route":
      return `${item.fromLabel}-${item.toLabel}`;
    case "poi":
      return item.query;
    default:
      return "tool";
  }
}

function getToneStyle(theme: AppTheme, tone: AgentToolTone) {
  switch (tone) {
    case "time":
      return {
        accentColor: "#A78BFA",
        iconBackground: theme.mode === "dark" ? "#3B315C" : "#EDE9FE",
        iconColor: theme.mode === "dark" ? "#DDD6FE" : "#5B21B6",
      };
    case "weather":
      return {
        accentColor: "#F4D35E",
        iconBackground: theme.mode === "dark" ? "#5C3F13" : "#FFF3C4",
        iconColor: theme.mode === "dark" ? "#FDE68A" : "#713F12",
      };
    case "route":
      return {
        accentColor: "#67E8F9",
        iconBackground: theme.mode === "dark" ? "#154651" : "#D7FAFD",
        iconColor: theme.mode === "dark" ? "#A5F3FC" : "#155E75",
      };
    default:
      return {
        accentColor: "#A3E635",
        iconBackground: theme.mode === "dark" ? "#334717" : "#ECFCCB",
        iconColor: theme.mode === "dark" ? "#D9F99D" : "#3F6212",
      };
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    stack: {
      width: "100%",
      maxWidth: 430,
      gap: 10,
    },
    card: {
      gap: 11,
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 15,
      borderWidth: 1,
      borderTopWidth: 5,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
    },
    headerRow: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    toolIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xs,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    sourceText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 13,
    },
    content: {
      gap: 10,
    },
    metricMain: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 31,
    },
    metricCaption: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    primaryLine: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 17,
    },
    secondaryLine: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    metricCell: {
      minWidth: 76,
      flexGrow: 1,
      flexBasis: 0,
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.surfaceMuted,
    },
    metricLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 13,
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 17,
    },
    suggestionText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    poiSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    countPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
    },
    countPillText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 14,
    },
    poiList: {
      gap: 8,
    },
    poiCandidateRow: {
      minHeight: 48,
      flexDirection: "row",
      gap: 10,
      paddingVertical: 4,
    },
    poiCandidateIcon: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.surfaceMuted,
    },
    poiCandidateIndex: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 15,
    },
    poiCandidateCopy: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    poiCandidateName: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 17,
    },
    poiCandidateMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
    },
    infoPill: {
      maxWidth: "100%",
      minHeight: 21,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    infoPillText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 13,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 16,
    },
  });
}
