import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AgentServiceStatus } from "@/features/agent";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

export function AgentUsageStatus({
  expanded,
  onToggle,
  status,
}: {
  expanded: boolean;
  onToggle: () => void;
  status?: AgentServiceStatus;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  if (!status) return null;

  const summary = status.availability.available
    ? `每日额度：剩余 ${status.quota.remaining} / ${status.quota.limit}`
    : status.availability.message;

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityLabel={expanded ? "收起旅行助手用量" : "展开旅行助手用量"}
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <MaterialIcons
          color={
            status.availability.available
              ? theme.colors.textMuted
              : theme.colors.danger
          }
          name={status.availability.available ? "data-usage" : "cloud-off"}
          size={14}
        />
        <Text
          numberOfLines={2}
          style={[
            styles.summaryText,
            !status.availability.available && styles.unavailableText,
          ]}
        >
          {summary}
        </Text>
        <MaterialIcons
          color={theme.colors.textSubtle}
          name={expanded ? "expand-less" : "expand-more"}
          size={16}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <UsageDetail
            label="模型档位"
            value={status.usage.modelProfile ?? "暂无"}
          />
          <UsageDetail
            label="模型调用"
            value={`${status.usage.modelCalls} 次`}
          />
          <UsageDetail
            label="工具调用"
            value={`${status.usage.toolCalls} 次`}
          />
          <UsageDetail
            label="累计耗时"
            value={formatDuration(status.usage.durationMs)}
          />
          <UsageDetail label="升级" value={`${status.usage.escalations} 次`} />
        </View>
      ) : null}
    </View>
  );
}

function UsageDetail({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  return `${Math.round(milliseconds / 1_000)}s`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      width: "100%",
      gap: 6,
      paddingHorizontal: 8,
      paddingBottom: 6,
    },
    summary: {
      minHeight: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 5,
    },
    pressed: { opacity: 0.68 },
    summaryText: {
      flexShrink: 1,
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 15,
      textAlign: "right",
    },
    unavailableText: { color: theme.colors.danger },
    details: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 6,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    detailLabel: {
      color: theme.colors.textSubtle,
      fontSize: 10,
      fontWeight: "700",
    },
    detailValue: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: "900",
    },
  });
}
