import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type {
  AgentProposalPreviewItem,
  AgentTripDraft,
  AgentTripTargetCandidate,
} from "@/features/agent";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { resolveAgentProposalConfirmationCopy } from "./agent-proposal-confirmation-copy";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type AgentTripSelectionCardProps = {
  candidates: AgentTripTargetCandidate[];
  intentLabel: string;
  onSelect: (candidate: AgentTripTargetCandidate) => void;
};

export type AgentProposalConfirmationCardProps = {
  adapterId?: string;
  disabled?: boolean;
  isApplying?: boolean;
  notice?: string;
  onApply: () => void;
  onCancel: () => void;
  preview: AgentProposalPreviewItem[];
  requiresRegeneration?: boolean;
  tripTitle: string;
};

export type AgentTripDraftCardProps = {
  disabled?: boolean;
  draft: AgentTripDraft;
  isCreating?: boolean;
  notice?: string;
  onCreate: () => void;
  onDiscard: () => void;
  onEdit: () => void;
};

export type AgentErrorCardProps = {
  actionLabel?: string;
  detail?: string;
  onActionPress?: () => void;
  title: string;
};

type AgentActionCardFrameProps = {
  children: ReactNode;
  icon: IconName;
  tone?: AgentActionCardTone;
};

type AgentActionCardTone = "default" | "draft" | "error" | "proposal";

export function AgentTripSelectionCard({
  candidates,
  intentLabel,
  onSelect,
}: AgentTripSelectionCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <AgentActionCardFrame icon="travel-explore">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>目标行程</Text>
          <Text style={styles.title}>{intentLabel}</Text>
          <Text style={styles.description}>
            先选要处理的行程，选好后我会继续匹配地点和生成提案。
          </Text>
        </View>
      </View>
      <View style={styles.optionList}>
        {candidates.map((candidate) => (
          <Pressable
            accessibilityLabel={`选择${candidate.title}`}
            accessibilityRole="button"
            key={candidate.id}
            onPress={() => onSelect(candidate)}
            style={({ pressed }) => [
              styles.optionCard,
              pressed && styles.optionCardPressed,
            ]}
          >
            <View style={styles.optionIcon}>
              <MaterialIcons
                name="map"
                size={17}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>{candidate.title}</Text>
              <Text style={styles.optionMeta} numberOfLines={2}>
                {[
                  candidate.destination,
                  `${candidate.dayCount} 天`,
                  candidate.startDate,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={theme.colors.textSubtle}
            />
          </Pressable>
        ))}
      </View>
    </AgentActionCardFrame>
  );
}

export function AgentProposalConfirmationCard({
  adapterId: _adapterId,
  disabled,
  isApplying,
  notice,
  onApply,
  onCancel,
  preview,
  requiresRegeneration,
  tripTitle,
}: AgentProposalConfirmationCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const risk = getMaxRisk(preview);
  const riskBadgeStyle = getRiskBadgeStyle(styles, risk);
  const riskBadgeTextStyle = getRiskBadgeTextStyle(styles, risk);
  const confirmationCopy = resolveAgentProposalConfirmationCopy(preview);
  const confirmationIcon = getProposalConfirmationIcon(preview, risk);

  return (
    <AgentActionCardFrame icon="rule" tone="proposal">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>待确认提案</Text>
          <Text style={styles.title}>应用到「{tripTitle}」</Text>
          <Text style={styles.description}>{confirmationCopy.description}</Text>
        </View>
        <View style={[styles.riskBadge, riskBadgeStyle]}>
          <Text style={[styles.riskBadgeText, riskBadgeTextStyle]}>
            {getRiskLabel(risk)}
          </Text>
        </View>
      </View>
      <View style={styles.previewList}>
        {preview.map((item, index) => (
          <View key={item.operationId} style={styles.previewItem}>
            <View style={styles.previewIndex}>
              <Text style={styles.previewIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.previewCopy}>
              <AgentProposalPreviewContent item={item} />
            </View>
          </View>
        ))}
      </View>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>取消</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onApply}
          style={({ pressed }) => [
            styles.primaryButton,
            risk === "high" && styles.dangerButton,
            pressed && styles.primaryButtonPressed,
            disabled && styles.disabled,
          ]}
        >
          {isApplying ? (
            <ActivityIndicator color={theme.colors.onPrimary} size="small" />
          ) : (
            <>
              <MaterialIcons
                name={requiresRegeneration ? "refresh" : confirmationIcon}
                size={17}
                color={risk === "high" ? "#111111" : theme.colors.onPrimary}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  risk === "high" && styles.dangerButtonText,
                ]}
              >
                {requiresRegeneration
                  ? "重新生成"
                  : confirmationCopy.confirmLabel}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </AgentActionCardFrame>
  );
}

function AgentProposalPreviewContent({
  item,
}: {
  item: AgentProposalPreviewItem;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { display } = item;

  switch (display.kind) {
    case "update_day_item":
      return (
        <>
          <Text style={styles.previewTitle}>修改 {display.targetName}</Text>
          <View style={styles.changeList}>
            {display.changes.map((change) => (
              <View key={change.field} style={styles.changeRow}>
                <Text style={styles.changeLabel}>{change.label}</Text>
                <View style={styles.changeValues}>
                  <Text style={styles.beforeValue}>
                    {formatPreviewValue(change.beforeValue)}
                  </Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={14}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.afterValue}>
                    {formatPreviewValue(change.afterValue)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      );
    case "move_day_item":
      return (
        <>
          <Text style={styles.previewTitle}>移动 {display.targetName}</Text>
          <View style={styles.moveRoute}>
            <View style={styles.moveStop}>
              <Text style={styles.routeLabel}>来源</Text>
              <Text style={styles.routeValue}>{display.from.dayLabel}</Text>
              <Text style={styles.routeMeta}>
                第 {display.from.position} 项
              </Text>
            </View>
            <MaterialIcons
              name="arrow-forward"
              size={18}
              color={theme.colors.primary}
            />
            <View style={styles.moveStop}>
              <Text style={styles.routeLabel}>目标</Text>
              <Text style={styles.routeValue}>{display.to.dayLabel}</Text>
              <Text style={styles.routeMeta}>第 {display.to.position} 项</Text>
            </View>
          </View>
        </>
      );
    case "remove_day_item":
      return (
        <>
          <Text style={styles.previewTitle}>删除 {display.targetName}</Text>
          <View style={styles.dangerImpact}>
            <MaterialIcons
              name="warning-amber"
              size={17}
              color={theme.colors.danger}
            />
            <View style={styles.dangerImpactCopy}>
              <Text style={styles.dangerImpactTitle}>此操作不可自动撤销</Text>
              <Text style={styles.dangerImpactText}>
                {display.dayLabel} · {display.placeImpact}
              </Text>
            </View>
          </View>
        </>
      );
    case "add_place_to_day":
      return (
        <>
          <Text style={styles.previewTitle}>加入 {display.placeName}</Text>
          <Text style={styles.previewImpact}>
            {display.dayLabel}
            {display.targetPosition ? ` · 第 ${display.targetPosition} 项` : ""}
            {display.time ? ` · ${display.time}` : ""}
          </Text>
          {display.address ? (
            <Text style={styles.previewImpact}>{display.address}</Text>
          ) : null}
          {display.sourceDetails?.map((detail) => (
            <Text key={detail} style={styles.previewImpact}>
              {detail}
            </Text>
          ))}
        </>
      );
    case "update_trip_day_title":
      return (
        <>
          <Text style={styles.previewTitle}>修改 {display.dayLabel} 标题</Text>
          <View style={styles.changeValues}>
            <Text style={styles.beforeValue}>
              {formatPreviewValue(display.beforeValue)}
            </Text>
            <MaterialIcons
              name="arrow-forward"
              size={14}
              color={theme.colors.textMuted}
            />
            <Text style={styles.afterValue}>
              {formatPreviewValue(display.afterValue)}
            </Text>
          </View>
        </>
      );
    case "ensure_trip_day_count":
      return (
        <>
          <Text style={styles.previewTitle}>
            行程天数从 {display.currentDayCount} 天增加到{" "}
            {display.targetDayCount} 天
          </Text>
          <Text style={styles.previewImpact}>
            新增 {display.addedDayLabels.join("、")}
          </Text>
        </>
      );
  }
}

function formatPreviewValue(value: string): string {
  return value.trim() || "未设置";
}

function getProposalConfirmationIcon(
  preview: AgentProposalPreviewItem[],
  risk: ProposalRisk,
): IconName {
  if (risk === "high") {
    return "delete-outline";
  }

  return preview[0]?.display.kind === "move_day_item"
    ? "arrow-forward"
    : "check";
}

export function AgentTripDraftCard({
  disabled,
  draft,
  isCreating,
  notice,
  onCreate,
  onDiscard,
  onEdit,
}: AgentTripDraftCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const totalItems = draft.days.reduce((sum, day) => sum + day.items.length, 0);
  const plannerSteps = draft.planner?.steps ?? [];
  const plannerWarnings =
    draft.planner?.qualityChecks.filter(
      (check) => check.status === "warning",
    ) ?? [];

  return (
    <AgentActionCardFrame icon="auto-awesome" tone="draft">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>新行程草案</Text>
          <Text style={styles.title}>{draft.title}</Text>
          <Text style={styles.description}>
            {draft.destination} · {draft.dayCount} 天 · {totalItems} 个初步安排
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{draft.dayCount} 天</Text>
          </View>
          <Pressable
            accessibilityLabel="放弃这份草案"
            accessibilityRole="button"
            disabled={disabled}
            hitSlop={8}
            onPress={onDiscard}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
              disabled && styles.disabled,
            ]}
          >
            <MaterialIcons
              name="close"
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.previewList}>
        {draft.days.map((day) => (
          <View
            key={`${draft.draftId}-${day.dayIndex}`}
            style={styles.previewItem}
          >
            <View style={styles.previewIndex}>
              <Text style={styles.previewIndexText}>{day.dayIndex}</Text>
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>{day.title}</Text>
              {day.summary ? (
                <Text style={styles.previewImpact}>{day.summary}</Text>
              ) : null}
              <Text style={styles.previewImpact} numberOfLines={2}>
                {day.items
                  .map((item) => item.placeName ?? item.title)
                  .join(" · ")}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {draft.assumptions.length || draft.warnings.length ? (
        <View style={styles.previewList}>
          {[...draft.assumptions, ...draft.warnings].slice(0, 2).map((item) => (
            <Text key={item} style={styles.noticeText}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      {plannerSteps.length || plannerWarnings.length ? (
        <View style={styles.plannerStatusRow}>
          {plannerSteps.slice(0, 3).map((step) => (
            <View key={step.id} style={styles.plannerStatusPill}>
              <MaterialIcons
                name={
                  step.status === "completed"
                    ? "check-circle"
                    : "radio-button-unchecked"
                }
                size={14}
                color={
                  step.status === "completed"
                    ? theme.colors.success
                    : theme.colors.textSubtle
                }
              />
              <Text numberOfLines={1} style={styles.plannerStatusText}>
                {formatPlannerStepLabel(step.id, step.description)}
              </Text>
            </View>
          ))}
          {plannerWarnings.length ? (
            <View style={[styles.plannerStatusPill, styles.plannerWarningPill]}>
              <MaterialIcons
                name="priority-high"
                size={14}
                color={theme.colors.warning}
              />
              <Text
                numberOfLines={1}
                style={[styles.plannerStatusText, styles.plannerWarningText]}
              >
                {plannerWarnings.length} 项已调整
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>编辑</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onCreate}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            disabled && styles.disabled,
          ]}
        >
          {isCreating ? (
            <ActivityIndicator color={theme.colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>应用</Text>
          )}
        </Pressable>
      </View>
    </AgentActionCardFrame>
  );
}

export function AgentErrorCard({
  actionLabel,
  detail,
  onActionPress,
  title,
}: AgentErrorCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <AgentActionCardFrame icon="error-outline" tone="error">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, styles.errorKicker]}>需要处理</Text>
          <Text style={styles.title}>{title}</Text>
          {detail ? <Text style={styles.description}>{detail}</Text> : null}
        </View>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.errorActionButton,
            pressed && styles.errorActionButtonPressed,
          ]}
        >
          <MaterialIcons name="refresh" size={17} color={theme.colors.danger} />
          <Text style={styles.errorActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </AgentActionCardFrame>
  );
}

function AgentActionCardFrame({
  children,
  icon,
  tone = "default",
}: AgentActionCardFrameProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const avatarToneStyle = getAvatarToneStyle(styles, tone);

  return (
    <View style={styles.messageRow}>
      <View style={[styles.avatar, avatarToneStyle]}>
        <MaterialIcons name={icon} size={16} color={theme.colors.primary} />
      </View>
      <View style={[styles.card, tone === "error" && styles.errorCard]}>
        {children}
      </View>
    </View>
  );
}

type ProposalRisk = "high" | "low" | "medium";
type AgentActionCardStyles = ReturnType<typeof createStyles>;

function getMaxRisk(preview: AgentProposalPreviewItem[]): ProposalRisk {
  if (preview.some((item) => item.risk === "high")) {
    return "high";
  }

  if (preview.some((item) => item.risk === "medium")) {
    return "medium";
  }

  return "low";
}

function getRiskLabel(risk: ProposalRisk) {
  if (risk === "high") {
    return "高风险";
  }

  if (risk === "medium") {
    return "中风险";
  }

  return "低风险";
}

function getRiskBadgeStyle(styles: AgentActionCardStyles, risk: ProposalRisk) {
  switch (risk) {
    case "high":
      return styles.highRiskBadge;
    case "medium":
      return styles.mediumRiskBadge;
    case "low":
      return styles.lowRiskBadge;
  }
}

function getRiskBadgeTextStyle(
  styles: AgentActionCardStyles,
  risk: ProposalRisk,
) {
  switch (risk) {
    case "high":
      return styles.highRiskBadgeText;
    case "medium":
      return styles.mediumRiskBadgeText;
    case "low":
      return styles.lowRiskBadgeText;
  }
}

function formatPlannerStepLabel(id: string, fallback: string) {
  switch (id) {
    case "extract_request":
      return "识别需求";
    case "gather_signals":
      return "查询工具";
    case "self_check":
      return "自检修正";
    default:
      return fallback;
  }
}

function getAvatarToneStyle(
  styles: AgentActionCardStyles,
  tone: AgentActionCardTone,
) {
  switch (tone) {
    case "error":
      return styles.errorAvatar;
    case "proposal":
      return styles.proposalAvatar;
    case "draft":
      return styles.draftAvatar;
    case "default":
      return styles.defaultAvatar;
  }
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    messageRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      gap: 8,
      paddingHorizontal: theme.layout.contentPadding,
    },
    avatar: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 7,
      backgroundColor: "#A3E635",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...theme.shadow.card,
    },
    defaultAvatar: {
      backgroundColor: "#A3E635",
    },
    proposalAvatar: {
      backgroundColor: "#F4D35E",
      borderColor: theme.colors.borderStrong,
    },
    draftAvatar: {
      backgroundColor: "#A78BFA",
      borderColor: theme.colors.borderStrong,
    },
    errorAvatar: {
      backgroundColor: "#FF8A7A",
      borderColor: theme.colors.borderStrong,
    },
    card: {
      flex: 1,
      maxWidth: 560,
      gap: 13,
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderWidth: 1.5,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
      ...theme.shadow.card,
    },
    errorCard: {
      borderColor: "#FF8A7A",
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    kicker: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 14,
    },
    errorKicker: {
      color: theme.colors.danger,
    },
    title: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 21,
    },
    description: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 19,
    },
    countBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: theme.colors.infoBorder,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.infoSoft,
    },
    countBadgeText: {
      color: theme.colors.info,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 14,
    },
    headerActions: {
      alignItems: "flex-end",
      gap: 8,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    closeButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    optionList: {
      gap: 9,
    },
    optionCard: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 11,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    optionCardPressed: {
      backgroundColor: theme.colors.surfacePressed,
      borderColor: theme.colors.borderStrong,
    },
    optionIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },
    optionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    optionTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20,
    },
    optionMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    optionHint: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    previewList: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    previewItem: {
      flexDirection: "row",
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    previewIndex: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 6,
      backgroundColor: "#A78BFA",
    },
    previewIndexText: {
      color: "#111111",
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 15,
    },
    previewCopy: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    previewTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 20,
    },
    previewImpact: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    changeList: {
      gap: 9,
    },
    changeRow: {
      gap: 4,
    },
    changeLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 15,
    },
    changeValues: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 7,
    },
    beforeValue: {
      flexShrink: 1,
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
      textDecorationLine: "line-through",
    },
    afterValue: {
      flexShrink: 1,
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 17,
    },
    moveRoute: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    moveStop: {
      flex: 1,
      minWidth: 0,
      gap: 2,
      padding: 10,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceMuted,
    },
    routeLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      lineHeight: 14,
    },
    routeValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 18,
    },
    routeMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
    },
    dangerImpact: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: 10,
      borderLeftWidth: 4,
      borderLeftColor: "#FF8A7A",
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.dangerSoft,
    },
    dangerImpactCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    dangerImpactTitle: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 17,
    },
    dangerImpactText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
    riskBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
    },
    lowRiskBadge: {
      borderColor: theme.colors.borderStrong,
      backgroundColor: "#A3E635",
    },
    mediumRiskBadge: {
      borderColor: theme.colors.borderStrong,
      backgroundColor: "#F4D35E",
    },
    highRiskBadge: {
      borderColor: theme.colors.borderStrong,
      backgroundColor: "#FF8A7A",
    },
    riskBadgeText: {
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 15,
    },
    lowRiskBadgeText: {
      color: "#111111",
    },
    mediumRiskBadgeText: {
      color: "#111111",
    },
    highRiskBadgeText: {
      color: "#111111",
    },
    noticeText: {
      color: theme.colors.warning,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 18,
    },
    plannerStatusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    plannerStatusPill: {
      minHeight: 28,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceMuted,
    },
    plannerStatusText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 15,
    },
    plannerWarningPill: {
      borderColor: theme.colors.warningBorder,
      backgroundColor: theme.colors.warningSoft,
    },
    plannerWarningText: {
      color: theme.colors.warning,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
    },
    secondaryButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    secondaryButtonText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "900",
    },
    primaryButton: {
      flex: 1.4,
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.primary,
    },
    dangerButton: {
      backgroundColor: "#FF8A7A",
    },
    primaryButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    primaryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
    },
    dangerButtonText: {
      color: "#111111",
    },
    disabled: {
      opacity: 0.58,
    },
    errorActionButton: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.dangerBorder,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.dangerSoft,
    },
    errorActionButtonPressed: {
      opacity: 0.72,
    },
    errorActionText: {
      color: theme.colors.danger,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
  });
}
