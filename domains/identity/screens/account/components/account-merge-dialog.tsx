import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getProfileGlassCardStyle,
  type ProfileGlassSurfaceTone,
} from "@/domains/identity/components/profile-glass-card";
import { useAppTheme } from "@/shared/theme/use-app-theme";

export type AccountMergeConfirmState = {
  conflictUserId: string;
  displayName: string;
  mergeToken: string;
  provider: "email" | "phone";
};

export function AccountMergeDialog({
  isBusy,
  mergeConfirm,
  onCancel,
  onConfirm,
  tone,
}: {
  isBusy: boolean;
  mergeConfirm: AccountMergeConfirmState | null;
  onCancel: () => void;
  onConfirm: () => void;
  tone: ProfileGlassSurfaceTone;
}) {
  const theme = useAppTheme();

  if (!mergeConfirm) {
    return null;
  }

  return (
    <View
      style={[styles.mergeOverlay, { backgroundColor: theme.colors.overlay }]}
    >
      <View
        style={[
          styles.mergeDialog,
          styles.profileGlassCard,
          getProfileGlassCardStyle(tone),
        ]}
      >
        <Text style={[styles.mergeTitle, { color: theme.colors.text }]}>
          合并账号
        </Text>
        <Text
          style={[styles.mergeDescription, { color: theme.colors.textMuted }]}
        >
          检测到{mergeConfirm.provider === "phone" ? "手机号" : "邮箱"}
          已属于另一个账号（
          {mergeConfirm.displayName}
          ）。合并后，该账号的行程和收藏将转移到当前账号，且无法撤销。
        </Text>
        <View style={styles.mergeActions}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.colors.border },
              pressed && { backgroundColor: theme.colors.surfacePressed },
            ]}
          >
            <Text
              style={[styles.secondaryButtonText, { color: theme.colors.text }]}
            >
              取消
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.colors.danger },
              pressed && { backgroundColor: theme.colors.dangerPressed },
              isBusy && { opacity: 0.64 },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.onPrimary },
              ]}
            >
              {isBusy ? "合并中..." : "确认合并"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileGlassCard: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  mergeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  mergeDialog: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    padding: 24,
    gap: 16,
  },
  mergeTitle: {
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
  },
  mergeDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  mergeActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
