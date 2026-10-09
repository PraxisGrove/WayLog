import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import type { TripPlace } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";
export function PlaceReviewPreview({
  place,
  recordTags,
  onPress,
  styles,
}: {
  place: TripPlace;
  recordTags: string[];
  onPress?: () => void;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  const reviewCount = place.details?.reviewCount;
  const highlight = place.details?.highlights?.[0];
  const caution = place.details?.cautions?.[0];
  const sourceLabel = `${place.details?.ratingSource ?? "个人"}评价参考`;
  const reviewTone =
    theme.mode === "dark"
      ? {
          accent: "#FDBA74",
          background: ["#2B241C", "#1C2434"] as const,
          chip: "#3F2D19",
          iconBackground: "#4A2E16",
        }
      : {
          accent: "#EA580C",
          background: ["#FFF8F1", "#FFF1E6"] as const,
          chip: "#FFEDD5",
          iconBackground: "#FFF7ED",
        };

  return (
    <Pressable
      accessibilityHint="展开或收起完整评价详情"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryPanelTouch,
        pressed && styles.summaryPanelPressed,
      ]}
    >
      <LinearGradient
        colors={reviewTone.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.summaryPanel, { shadowColor: reviewTone.accent }]}
      >
        <View style={styles.summaryPanelHeader}>
          <View style={styles.summaryEyebrowRow}>
            <View
              style={[
                styles.summaryAccentDot,
                { backgroundColor: reviewTone.accent },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[styles.summaryEyebrow, { color: theme.colors.textMuted }]}
            >
              发表高见
            </Text>
          </View>
          <View
            style={[styles.summaryBadge, { backgroundColor: reviewTone.chip }]}
          >
            <Text
              numberOfLines={1}
              style={[styles.summaryBadgeText, { color: reviewTone.accent }]}
            >
              {typeof reviewCount === "number" ? `${reviewCount} 条` : "待记录"}
            </Text>
          </View>
        </View>
        <View style={styles.summaryHeroRow}>
          <View style={styles.summaryHeroCopy}>
            <Text
              numberOfLines={1}
              style={[styles.summaryTitle, { color: theme.colors.text }]}
            >
              发表高见
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.summarySubtitle,
                { color: theme.colors.textMuted },
              ]}
            >
              {highlight
                ? `${sourceLabel} · 亮点已收录`
                : caution
                  ? `${sourceLabel} · 有注意事项`
                  : sourceLabel}
            </Text>
          </View>
          <View
            style={[
              styles.summaryIconBubble,
              { backgroundColor: reviewTone.iconBackground },
            ]}
          >
            <MaterialIcons
              name="rate-review"
              size={24}
              color={reviewTone.accent}
            />
          </View>
        </View>
        <View style={styles.summaryInsightList}>
          {highlight ? (
            <View style={styles.summaryInsightRow}>
              <MaterialIcons
                name="sentiment-satisfied-alt"
                size={14}
                color={theme.colors.success}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.summaryInsightText,
                  { color: theme.colors.text },
                ]}
              >
                {highlight}
              </Text>
            </View>
          ) : null}
          {caution ? (
            <View style={styles.summaryInsightRow}>
              <MaterialIcons
                name="report-problem"
                size={14}
                color={theme.colors.warning}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.summaryInsightText,
                  { color: theme.colors.text },
                ]}
              >
                {caution}
              </Text>
            </View>
          ) : null}
          {!highlight && !caution ? (
            <Text
              numberOfLines={2}
              style={[
                styles.summaryPlaceholder,
                { color: theme.colors.textMuted },
              ]}
            >
              查看来源、评价亮点和避坑信息
            </Text>
          ) : null}
        </View>
        {recordTags.length > 0 ? (
          <View style={styles.summaryTagRow}>
            {recordTags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                style={[
                  styles.summaryTag,
                  { backgroundColor: reviewTone.chip },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.summaryTagText, { color: reviewTone.accent }]}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}
