import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createClarificationFeedback } from "@/shared/agent/clarification-feedback";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { triggerHaptic } from "@/shared/ui/haptic-feedback";

export type AgentDestinationClarificationCardProps = {
  disabled?: boolean;
  error?: string;
  isSubmitting?: boolean;
  onSubmit: (destination: string) => void;
  question: string;
};

export function AgentDestinationClarificationCard({
  disabled = false,
  error,
  isSubmitting = false,
  onSubmit,
  question,
}: AgentDestinationClarificationCardProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [destination, setDestination] = useState("");
  const feedback = useMemo(
    () => createClarificationFeedback({ haptic: triggerHaptic }),
    [],
  );
  const normalizedDestination = destination.trim();
  const canSubmit =
    normalizedDestination.length >= 1 &&
    normalizedDestination.length <= 120 &&
    !disabled &&
    !isSubmitting;

  return (
    <View accessibilityLiveRegion="polite" style={styles.card}>
      <Text style={styles.eyebrow}>补充旅行目的地</Text>
      <Text style={styles.question}>{question}</Text>
      <TextInput
        accessibilityLabel="旅行目的地"
        editable={!disabled && !isSubmitting}
        maxLength={120}
        onChangeText={setDestination}
        placeholder="例如：云南、Tokyo"
        placeholderTextColor={theme.colors.textMuted}
        returnKeyType="done"
        style={styles.input}
        value={destination}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: isSubmitting, disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={() => {
          feedback.confirm();
          onSubmit(normalizedDestination);
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
          <Text style={styles.submitText}>确认目的地并继续规划</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
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
    input: {
      minHeight: 46,
      paddingHorizontal: 12,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceMuted,
      fontSize: 15,
      fontWeight: "700",
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
