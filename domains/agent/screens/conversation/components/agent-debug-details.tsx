import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { AgentDebugInfo } from "../agent-conversation.types";

export type AgentDebugDetailsProps = {
  debug?: AgentDebugInfo;
  expanded?: boolean;
  onToggle?: () => void;
};

export function AgentDebugDetails({
  debug,
  expanded = false,
  onToggle,
}: AgentDebugDetailsProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const details = formatAgentDebugDetails(debug);

  if (!__DEV__ || details.length === 0) {
    return null;
  }

  const summary = formatAgentDebugSummary(debug);
  const canExpand = Boolean(onToggle);

  return (
    <View style={styles.root}>
      <Pressable
        {...(canExpand ? { accessibilityRole: "button" as const } : {})}
        disabled={!canExpand}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.summaryRow,
          pressed && canExpand && styles.summaryRowPressed,
        ]}
      >
        <MaterialIcons
          name="bug-report"
          size={14}
          color={theme.colors.textSubtle}
        />
        <Text numberOfLines={1} style={styles.summaryText}>
          {summary}
        </Text>
        {canExpand ? (
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={16}
            color={theme.colors.textSubtle}
          />
        ) : null}
      </Pressable>
      {expanded ? (
        <View style={styles.detailBox}>
          {details.map((detail) => (
            <View key={detail.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{detail.label}</Text>
              <Text selectable style={styles.detailValue}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type AgentDebugDetail = {
  label: string;
  value: string;
};

function formatAgentDebugSummary(debug: AgentDebugInfo | undefined) {
  const tokenText =
    debug?.usage?.totalTokens !== undefined
      ? `${formatAgentNumber(debug.usage.totalTokens)} tokens`
      : undefined;
  const latencyText =
    debug?.timing?.totalMs !== undefined
      ? formatAgentDuration(debug.timing.totalMs)
      : undefined;
  const parts = [
    debug?.resultType,
    debug?.route,
    debug?.errorCode,
    tokenText,
    latencyText,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `Debug：${parts.join(" · ")}` : "Debug 明细";
}

function formatAgentDebugDetails(
  debug: AgentDebugInfo | undefined,
): AgentDebugDetail[] {
  if (!debug) {
    return [];
  }

  const details: AgentDebugDetail[] = [];

  appendDetail(details, "turnId", debug.turnId);
  appendDetail(details, "route", debug.route);
  appendDetail(details, "resultType", debug.resultType);
  appendDetail(details, "proposalId", debug.proposalId);
  appendDetail(details, "operationIds", debug.operationIds?.join(", "));
  appendDetail(details, "errorCode", debug.errorCode);
  appendDetail(
    details,
    "tokens.total",
    formatOptionalNumber(debug.usage?.totalTokens),
  );
  appendDetail(
    details,
    "tokens.prompt",
    formatOptionalNumber(debug.usage?.promptTokens),
  );
  appendDetail(
    details,
    "tokens.completion",
    formatOptionalNumber(debug.usage?.completionTokens),
  );
  appendDetail(
    details,
    "latency.total",
    formatOptionalMs(debug.timing?.totalMs),
  );
  appendDetail(details, "latency.llm", formatOptionalMs(debug.timing?.llmMs));
  appendDetail(
    details,
    "latency.placeSearch",
    formatOptionalMs(debug.timing?.placeSearchMs),
  );
  appendDetail(
    details,
    "latency.amapSearch",
    formatOptionalMs(debug.timing?.amapSearchMs),
  );
  appendDetail(
    details,
    "latency.poiCache",
    formatOptionalMs(debug.timing?.poiCacheMs),
  );
  appendDetail(
    details,
    "latency.poiCacheWrite",
    formatOptionalMs(debug.timing?.poiCacheWriteMs),
  );
  appendDetail(
    details,
    "latency.poiCacheWriteQueued",
    formatOptionalMs(debug.timing?.poiCacheWriteQueued),
  );
  appendDetail(
    details,
    "latency.rateLimit",
    formatOptionalMs(debug.timing?.rateLimitMs),
  );

  return details;
}

function appendDetail(
  details: AgentDebugDetail[],
  label: string,
  value: string | undefined,
) {
  if (!value) {
    return;
  }

  details.push({ label, value });
}

function formatOptionalNumber(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatAgentNumber(value);
}

function formatOptionalMs(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatAgentDuration(value);
}

function formatAgentNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatAgentDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return `${Math.round(ms)}ms`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      gap: 6,
      marginTop: 7,
    },
    summaryRow: {
      minHeight: 22,
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    summaryRowPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    summaryText: {
      maxWidth: 220,
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 14,
    },
    detailBox: {
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    detailRow: {
      gap: 3,
    },
    detailLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 14,
    },
    detailValue: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 14,
    },
  });
}
