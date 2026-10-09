import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import { formatExpenseAmount, type TripExpenseEntry } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";
export function PlaceExpensePreview({
  placeExpenseTotal,
  expenseRecordEntries,
  onPress,
  styles,
}: {
  placeExpenseTotal: number;
  expenseRecordEntries: TripExpenseEntry[];
  onPress?: () => void;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  const latestEntry = expenseRecordEntries[0];
  const expenseTone =
    theme.mode === "dark"
      ? {
          accent: "#5EEAD4",
          background: ["#172D3B", "#18283A"] as const,
          chip: "#123B3D",
          iconBackground: "#123B3D",
        }
      : {
          accent: "#0F766E",
          background: ["#F8FAFC", "#ECFDF5"] as const,
          chip: "#DFF7EE",
          iconBackground: "#ECFDF5",
        };

  return (
    <Pressable
      accessibilityHint="展开或收起完整开销记录"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryPanelTouch,
        pressed && styles.summaryPanelPressed,
      ]}
    >
      <LinearGradient
        colors={expenseTone.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.summaryPanel, { shadowColor: expenseTone.accent }]}
      >
        <View style={styles.summaryPanelHeader}>
          <View style={styles.summaryEyebrowRow}>
            <View
              style={[
                styles.summaryAccentDot,
                { backgroundColor: expenseTone.accent },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[styles.summaryEyebrow, { color: theme.colors.textMuted }]}
            >
              开销记录
            </Text>
          </View>
          <View
            style={[styles.summaryBadge, { backgroundColor: expenseTone.chip }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.summaryBadgeText, { color: expenseTone.accent }]}
            >
              {expenseRecordEntries.length} 条
            </Text>
          </View>
        </View>
        <View style={styles.summaryHeroRow}>
          <View style={styles.summaryHeroCopy}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.summaryTitleLarge, { color: theme.colors.text }]}
            >
              {expenseRecordEntries.length > 0
                ? formatExpenseAmount(placeExpenseTotal)
                : "待记录"}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.summarySubtitle,
                { color: theme.colors.textMuted },
              ]}
            >
              {latestEntry ? "最近一笔" : "点击添加开销"}
            </Text>
          </View>
          <View
            style={[
              styles.summaryIconBubble,
              { backgroundColor: expenseTone.iconBackground },
            ]}
          >
            <MaterialIcons
              name="receipt-long"
              size={24}
              color={expenseTone.accent}
            />
          </View>
        </View>
        {latestEntry ? (
          <View style={styles.summaryLatestBox}>
            <View style={styles.summaryInsightRow}>
              <MaterialIcons
                name="schedule"
                size={13}
                color={theme.colors.textSubtle}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.summaryInsightText,
                  { color: theme.colors.text },
                ]}
              >
                {latestEntry.title}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.summaryLatestAmount,
                { color: expenseTone.accent },
              ]}
            >
              {formatExpenseAmount(latestEntry.amount, latestEntry.currency)}
            </Text>
          </View>
        ) : (
          <View style={styles.summaryTagRow}>
            <View
              style={[styles.summaryTag, { backgroundColor: expenseTone.chip }]}
            >
              <Text
                numberOfLines={1}
                style={[styles.summaryTagText, { color: expenseTone.accent }]}
              >
                添加开销
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}
