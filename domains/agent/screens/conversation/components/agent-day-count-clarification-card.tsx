import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  canSubmitDayCountSelection,
  createDayCountSelection,
  selectDayCount,
} from "@/features/agent";
import { createClarificationFeedback } from "@/shared/agent/clarification-feedback";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";

export type AgentDayCountClarificationCardProps = {
  disabled?: boolean;
  error?: string;
  isSubmitting?: boolean;
  onSubmit: (dayCount: number) => void;
  question: string;
};

const dayOptions = Array.from({ length: 14 }, (_, index) => index + 1);

export function AgentDayCountClarificationCard({
  disabled = false,
  error,
  isSubmitting = false,
  onSubmit,
  question,
}: AgentDayCountClarificationCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [selection, setSelection] = useState(() => createDayCountSelection(3));
  const feedback = useMemo(
    () => createClarificationFeedback({ haptic: triggerHaptic }),
    [],
  );
  const canSubmit =
    canSubmitDayCountSelection(selection) && !disabled && !isSubmitting;

  return (
    <View accessibilityLiveRegion="polite" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>补充旅行天数</Text>
        <Text style={styles.question}>{question}</Text>
        <Text style={styles.hint}>
          请滑动并点选 1–14 天；居中的数字不会自动提交。
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.options}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {dayOptions.map((day) => {
          const isSelected = selection.selectedDay === day;
          const isNearby = Math.abs(day - selection.focusedDay) <= 1;
          return (
            <Pressable
              accessibilityLabel={`${day} 天`}
              accessibilityRole="radio"
              accessibilityState={{
                checked: isSelected,
                disabled: disabled || isSubmitting,
              }}
              disabled={disabled || isSubmitting}
              key={day}
              onPress={() => {
                setSelection((current) => selectDayCount(current, day));
                feedback.selection();
              }}
              style={({ pressed }) => [
                styles.option,
                isNearby && styles.optionNearby,
                isSelected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text
                style={[
                  styles.optionNumber,
                  isSelected && styles.optionNumberSelected,
                ]}
              >
                {day}
              </Text>
              <Text
                style={[
                  styles.optionUnit,
                  isSelected && styles.optionNumberSelected,
                ]}
              >
                天
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
        disabled={!canSubmit}
        onPress={() => {
          if (!canSubmitDayCountSelection(selection)) return;
          feedback.confirm();
          onSubmit(selection.selectedDay);
        }}
        style={({ pressed }) => [
          styles.submit,
          !canSubmit && styles.submitDisabled,
          pressed && canSubmit && styles.submitPressed,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.onPrimary} size="small" />
        ) : (
          <Text style={styles.submitText}>确认天数并继续规划</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: 14,
      padding: 14,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
    header: { gap: 5 },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.7,
    },
    question: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 23,
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 17,
    },
    options: { gap: 8, paddingVertical: 3, paddingHorizontal: 1 },
    option: {
      width: 54,
      minHeight: 64,
      alignItems: "center",
      justifyContent: "center",
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      backgroundColor: theme.colors.surfaceMuted,
    },
    optionNearby: { borderColor: theme.colors.primaryBorder },
    optionSelected: {
      borderColor: theme.colors.borderStrong,
      borderWidth: 2,
      backgroundColor: theme.colors.primary,
    },
    optionPressed: { transform: [{ scale: 0.97 }] },
    optionNumber: { color: theme.colors.text, fontSize: 21, fontWeight: "900" },
    optionNumberSelected: { color: theme.colors.onPrimary },
    optionUnit: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
    },
    error: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    submit: {
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    submitDisabled: { opacity: 0.42 },
    submitPressed: { transform: [{ translateY: 1 }] },
    submitText: {
      color: theme.colors.onPrimary,
      fontSize: 14,
      fontWeight: "900",
    },
  });
}
