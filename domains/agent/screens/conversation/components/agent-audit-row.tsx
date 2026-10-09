import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AgentConversationAudit } from "@/features/agent";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

export type AgentAuditRowProps = {
  audit?: AgentConversationAudit;
  expanded?: boolean;
  onToggle?: () => void;
};

export function AgentAuditRow({
  audit,
  expanded = false,
  onToggle,
}: AgentAuditRowProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const summary = formatAgentAuditSummary(audit);
  const details = formatAgentAuditDetails(audit);

  if (!summary) {
    return null;
  }

  const canExpand = details.length > 0 && Boolean(onToggle);

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
          name="query-stats"
          size={14}
          color={theme.colors.textSubtle}
        />
        <Text style={styles.summaryText}>{summary}</Text>
        {canExpand ? (
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={16}
            color={theme.colors.textSubtle}
          />
        ) : null}
      </Pressable>
      {expanded && details.length > 0 ? (
        <View style={styles.detailBox}>
          {details.map((detail) => (
            <View key={detail.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{detail.label}</Text>
              <Text style={styles.detailValue}>{detail.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type AgentAuditDetail = {
  label: string;
  value: string;
};

function formatAgentAuditSummary(
  audit: AgentConversationAudit | undefined,
): string | undefined {
  if (!audit) {
    return undefined;
  }

  const parts: string[] = [];
  const totalTokens = resolveAgentAuditTotalTokens(audit);

  if (totalTokens !== undefined) {
    parts.push(`${formatAgentNumber(totalTokens)} tokens`);
  }

  if (audit.timing?.totalMs !== undefined) {
    parts.push(formatAgentDuration(audit.timing.totalMs));
  }

  const modeLabel = getAgentAuditModeLabel(audit.mode);

  if (modeLabel) {
    parts.push(modeLabel);
  } else if (audit.model) {
    parts.push(audit.model);
  }

  return parts.length > 0 ? `本轮：${parts.join(" · ")}` : undefined;
}

function formatAgentAuditDetails(
  audit: AgentConversationAudit | undefined,
): AgentAuditDetail[] {
  if (!audit) {
    return [];
  }

  const details: AgentAuditDetail[] = [];

  if (audit.usage?.promptTokens !== undefined) {
    details.push({
      label: "输入 tokens",
      value: formatAgentNumber(audit.usage.promptTokens),
    });
  }

  if (audit.usage?.completionTokens !== undefined) {
    details.push({
      label: "输出 tokens",
      value: formatAgentNumber(audit.usage.completionTokens),
    });
  }

  const totalTokens = resolveAgentAuditTotalTokens(audit);

  if (totalTokens !== undefined) {
    details.push({ label: "总 tokens", value: formatAgentNumber(totalTokens) });
  }

  if (audit.model) {
    details.push({ label: "模型", value: audit.model });
  }

  if (audit.provider) {
    details.push({ label: "服务", value: audit.provider });
  }

  if (audit.mode) {
    details.push({
      label: "模式",
      value: getAgentAuditModeLabel(audit.mode) ?? audit.mode,
    });
  }

  const timingDetails = formatAgentTimingDetails(audit);

  return dedupeAgentAuditDetails([...details, ...timingDetails]);
}

function formatAgentTimingDetails(
  audit: AgentConversationAudit,
): AgentAuditDetail[] {
  const timing = audit.timing;

  if (!timing) {
    return [];
  }

  const entries: [keyof typeof timing, string][] = [
    ["totalMs", "总耗时"],
    ["rateLimitMs", "限流检查"],
    ["placeSearchMs", "地点搜索"],
    ["amapSearchMs", "高德搜索"],
    ["poiCacheMs", "POI 缓存读取"],
    ["poiCacheWriteMs", "POI 缓存写入"],
    ["llmMs", "模型生成"],
  ];

  return entries
    .map(([key, label]) => {
      const value = timing[key];

      return typeof value === "number"
        ? { label, value: formatAgentDuration(value) }
        : undefined;
    })
    .filter((detail): detail is AgentAuditDetail => Boolean(detail));
}

function dedupeAgentAuditDetails(details: AgentAuditDetail[]) {
  const seen = new Set<string>();
  const nextDetails: AgentAuditDetail[] = [];

  for (const detail of details) {
    if (seen.has(detail.label)) {
      continue;
    }

    seen.add(detail.label);
    nextDetails.push(detail);
  }

  return nextDetails;
}

function resolveAgentAuditTotalTokens(
  audit: AgentConversationAudit,
): number | undefined {
  if (audit.usage?.totalTokens !== undefined) {
    return audit.usage.totalTokens;
  }

  if (
    audit.usage?.promptTokens !== undefined ||
    audit.usage?.completionTokens !== undefined
  ) {
    return (
      (audit.usage.promptTokens ?? 0) + (audit.usage.completionTokens ?? 0)
    );
  }

  return undefined;
}

function formatAgentNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatAgentDuration(milliseconds: number) {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }

  return `${(milliseconds / 1000).toFixed(milliseconds >= 10_000 ? 0 : 1)}s`;
}

function getAgentAuditModeLabel(mode: string | undefined): string | undefined {
  switch (mode) {
    case "llm":
      return "模型";
    case "place_selection":
      return "地点候选";
    case "skill_fallback":
      return "本地技能";
    default:
      return undefined;
  }
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    detailLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 15,
    },
    detailValue: {
      flexShrink: 1,
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 15,
      textAlign: "right",
    },
  });
}
