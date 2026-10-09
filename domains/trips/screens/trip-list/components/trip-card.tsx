import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { memo } from "react";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  countTripItems,
  formatTripDateRange,
  formatTripDestination,
  formatTripProgress,
  getTripCurrentDayNumber,
  getTripStatusColors,
  getTripStatusDisplayLabel,
  getTripTicketStats,
  type Trip,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { StatusBadge } from "@/shared/ui/status-badge";

const completedPostmarkSource = require("@/assets/images/completed-postmark.png");
const featuredTicketPunchDotKeys = [
  "dot-1",
  "dot-2",
  "dot-3",
  "dot-4",
  "dot-5",
] as const;

type TripCardProps = {
  accessibilityHint?: string;
  footer?: ReactNode;
  onLongPress?: () => void;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style?: StyleProp<ViewStyle>;
  trip: Trip;
  variant?: "compact" | "featured" | "ticket";
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚更新";
  }

  return `${date.getMonth() + 1} 月 ${date.getDate()} 日更新`;
}

export function PinnedBadge() {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.pinBadge,
        {
          backgroundColor: theme.colors.primarySoft,
          borderRadius: theme.radius.sm,
        },
      ]}
    >
      <MaterialIcons name="push-pin" size={13} color={theme.colors.primary} />
      <Text style={[styles.pinBadgeText, { color: theme.colors.primary }]}>
        置顶
      </Text>
    </View>
  );
}

export const TripCard = memo(function TripCard({
  accessibilityHint,
  footer,
  onLongPress,
  onPress,
  style,
  trip,
  variant = "compact",
}: TripCardProps) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, {
      damping: 15,
      stiffness: 400,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
  };

  if (variant === "ticket") {
    return (
      <Animated.View style={animatedStyle}>
        <TicketTripCard
          accessibilityHint={accessibilityHint}
          footer={footer}
          onLongPress={onLongPress}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={style}
          trip={trip}
        />
      </Animated.View>
    );
  }

  if (variant === "featured") {
    return (
      <Animated.View style={animatedStyle}>
        <FeaturedTicketTripCard
          accessibilityHint={accessibilityHint}
          footer={footer}
          onLongPress={onLongPress}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={style}
          trip={trip}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        delayLongPress={350}
        onLongPress={onLongPress}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: "transparent",
            borderRadius: theme.radius.sm,
            padding: theme.spacing.lg,
          },
          pressed && { backgroundColor: theme.colors.surfacePressed },
          style,
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleCopy}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.colors.text }]}
            >
              {trip.title}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            {trip.pinnedAt ? <PinnedBadge /> : null}
            <StatusBadge
              status={trip.status}
              label={getTripStatusDisplayLabel(trip)}
            />
          </View>
        </View>

        <View
          style={[
            styles.infoBlock,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderRadius: theme.radius.sm,
            },
          ]}
        >
          <View style={styles.infoRow}>
            <MaterialIcons
              name="place"
              size={18}
              color={theme.colors.primary}
            />
            <Text
              numberOfLines={2}
              style={[styles.infoText, { color: theme.colors.textMuted }]}
            >
              {formatTripDestination(trip)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons
              name="event"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>
              {formatTripDateRange(trip)}
            </Text>
          </View>
        </View>

        <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
          {formatTripProgress(trip)} · {formatUpdatedAt(trip.updatedAt)}
        </Text>

        {footer}
      </Pressable>
    </Animated.View>
  );
});
TripCard.displayName = "TripCard";

function formatTripDuration(trip: Trip) {
  const days = Math.max(1, trip.days.length);
  const nights = Math.max(0, days - 1);

  return `${days}天${nights}晚`;
}

function formatTripStart(trip: Trip) {
  if (!trip.startDate) {
    return "待定";
  }

  return formatTripDateRange({ ...trip, endDate: trip.startDate });
}

function TicketDash({
  color = "#A0AAB4",
  noOuterMargin = false,
  segmentThickness,
  orientation = "horizontal",
}: {
  color?: string;
  noOuterMargin?: boolean;
  orientation?: "horizontal" | "vertical";
  segmentThickness?: number;
}) {
  const thickness = segmentThickness ?? 2;

  if (orientation === "vertical") {
    return (
      <View
        style={[
          styles.ticketDashColumn,
          noOuterMargin && styles.ticketDashNoOuterMargin,
          {
            borderLeftWidth: thickness,
            borderLeftColor: color,
            borderStyle: "dashed",
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.ticketDashRow,
        noOuterMargin && styles.ticketDashNoOuterMargin,
        {
          borderTopWidth: thickness,
          borderTopColor: color,
          borderStyle: "dashed",
        },
      ]}
    />
  );
}

function resolveTicketStubPalette(theme: AppTheme, status: Trip["status"]) {
  const statusColors = getTripStatusColors(status, theme.colors.status);

  return {
    stubBackgroundColor: statusColors.accentBackgroundColor,
    stubTextColor: statusColors.accentColor,
    stubIconColor: statusColors.accentColor,
  };
}

function CompletedPostmark() {
  return (
    <View pointerEvents="none" style={styles.ticketCompletedPostmark}>
      <Image
        contentFit="contain"
        source={completedPostmarkSource}
        style={styles.ticketCompletedPostmarkImage}
      />
    </View>
  );
}

function FeaturedTicketTripCard({
  accessibilityHint,
  footer,
  onLongPress,
  onPress,
  onPressIn,
  onPressOut,
  style,
  trip,
}: Omit<TripCardProps, "variant">) {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth <= 390;
  const statusColors = getTripStatusColors(trip.status, theme.colors.status);
  const stats = getTripTicketStats(trip);
  const currentDayNumber = getTripCurrentDayNumber(trip);
  const palette = theme.colors.ticket.featured;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      delayLongPress={350}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.featuredTicketOuter,
        {
          backgroundColor: pressed
            ? palette.paperPressed
            : palette.paperBackground,
          borderRadius: theme.radius.lg,
        },
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      <View
        style={[
          styles.featuredTicketTop,
          {
            backgroundColor: palette.heroBackground,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.featuredTicketTopPattern}>
          <View
            style={[
              styles.featuredTicketPatternDot,
              { borderColor: palette.heroPattern },
            ]}
          />
          <View
            style={[
              styles.featuredTicketPatternDot,
              { borderColor: palette.heroPattern },
            ]}
          />
          <View
            style={[
              styles.featuredTicketPatternDot,
              { borderColor: palette.heroPattern },
            ]}
          />
        </View>

        <View style={styles.featuredTicketBoardingRow}>
          <View
            style={[
              styles.featuredTicketIconBadge,
              { backgroundColor: statusColors.accentBackgroundColor },
            ]}
          >
            <MaterialIcons
              name="confirmation-number"
              size={18}
              color={statusColors.accentColor}
            />
          </View>

          <View style={styles.featuredTicketTitleCopy}>
            <Text
              style={[
                styles.featuredTicketKicker,
                { color: palette.heroMutedText },
              ]}
            >
              当前行程
            </Text>
            <Text
              style={[
                styles.featuredTicketPassText,
                { color: palette.heroMutedText },
              ]}
            >
              TRIP PASS
            </Text>
          </View>

          <StatusBadge
            status={trip.status}
            style={styles.featuredTicketStatusBadge}
            label={getTripStatusDisplayLabel(trip)}
          />
        </View>

        <Text
          numberOfLines={2}
          style={[styles.featuredTicketTitle, { color: palette.heroText }]}
        >
          {trip.title}
        </Text>

        <View style={styles.featuredTicketHeroFooter}>
          <View style={styles.featuredTicketHeroChip}>
            <MaterialIcons
              name="place"
              size={15}
              color={palette.heroMutedText}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.featuredTicketHeroChipText,
                { color: palette.heroMutedText },
              ]}
            >
              {formatTripDestination(trip)}
            </Text>
          </View>
          <View style={styles.ticketBadgeRow}>
            {trip.pinnedAt ? <PinnedBadge /> : null}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.featuredTicketBottom,
          {
            backgroundColor: palette.paperBackground,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: theme.radius.lg,
            borderBottomRightRadius: theme.radius.lg,
            paddingTop: palette.seamHeight + 4,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.featuredTicketSeamOverlay}>
          <View
            style={[
              styles.featuredTicketCenteredDash,
              {
                top: -palette.dashSegmentThickness / 2,
              },
            ]}
          >
            <TicketDash
              color={palette.dashColor}
              noOuterMargin
              segmentThickness={palette.dashSegmentThickness}
            />
          </View>
          <View
            style={[
              styles.featuredTicketSideNotch,
              styles.featuredTicketSideNotchLeft,
              { backgroundColor: theme.colors.background },
            ]}
          />
          <View
            style={[
              styles.featuredTicketSideNotch,
              styles.featuredTicketSideNotchRight,
              { backgroundColor: theme.colors.background },
            ]}
          />
        </View>

        <View style={styles.featuredTicketRouteRow}>
          <View style={styles.featuredTicketRouteCopy}>
            <Text
              style={[
                styles.featuredTicketRouteLabel,
                { color: palette.accentText },
              ]}
            >
              DATE
            </Text>
            <View style={styles.featuredTicketInfoRow}>
              <MaterialIcons name="event" size={18} color={palette.paperText} />
              <Text
                numberOfLines={1}
                style={[
                  styles.featuredTicketInfoText,
                  { color: palette.paperText },
                ]}
              >
                {formatTripDateRange(trip)}
              </Text>
            </View>
          </View>
          <View style={styles.featuredTicketSerialBlock}>
            <View style={styles.featuredTicketSerialRow}>
              <Text
                style={[
                  styles.featuredTicketSerialAffix,
                  { color: palette.accentText },
                ]}
              >
                NO.{" "}
              </Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={[
                  styles.featuredTicketSerialNumber,
                  { color: palette.accentText },
                ]}
              >
                {currentDayNumber}
              </Text>
              <Text
                style={[
                  styles.featuredTicketSerialAffix,
                  { color: palette.accentText },
                ]}
              >
                {" "}
                天
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.featuredTicketStatsGrid,
            isCompact && styles.featuredTicketStatsGridCompact,
          ]}
        >
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.featuredTicketStatCard,
                isCompact && styles.featuredTicketStatCardCompact,
                { backgroundColor: palette.statBackground },
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.62}
                numberOfLines={1}
                style={[
                  styles.featuredTicketStatValue,
                  { color: palette.paperText },
                ]}
              >
                {stat.value}
              </Text>
              <Text
                style={[
                  styles.featuredTicketStatLabel,
                  { color: palette.accentText },
                ]}
              >
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.featuredTicketFooterRow}>
          <Text
            style={[
              styles.featuredTicketUpdatedAt,
              { color: palette.accentText },
            ]}
          >
            {formatUpdatedAt(trip.updatedAt)}
          </Text>
          <View style={styles.featuredTicketPunchRow}>
            {featuredTicketPunchDotKeys.map((dotKey) => (
              <View
                key={dotKey}
                style={[
                  styles.featuredTicketPunchDot,
                  { borderColor: palette.punchBorder },
                ]}
              />
            ))}
          </View>
        </View>
        {footer}
      </View>
    </Pressable>
  );
}

function TicketTripCard({
  accessibilityHint,
  footer,
  onLongPress,
  onPress,
  onPressIn,
  onPressOut,
  style,
  trip,
}: Omit<TripCardProps, "variant">) {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth <= 390;
  const tripItemCount = countTripItems(trip);
  const statusColors = getTripStatusColors(trip.status, theme.colors.status);
  const ticketPalette = resolveTicketStubPalette(theme, trip.status);
  const isCompleted = trip.status === "已完成";

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      delayLongPress={350}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.ticketOuter,
        {
          borderRadius: theme.radius.lg,
        },
        pressed && { opacity: 0.86 },
        style,
      ]}
    >
      <View
        style={[
          styles.ticketMain,
          {
            backgroundColor: theme.colors.ticket.background,
            borderBottomLeftRadius: theme.radius.lg,
            borderTopLeftRadius: theme.radius.lg,
          },
          isCompact && styles.ticketMainCompact,
        ]}
      >
        <View
          style={[
            styles.ticketIconBadge,
            { backgroundColor: statusColors.accentBackgroundColor },
          ]}
        >
          <MaterialIcons
            name="place"
            size={18}
            color={statusColors.accentColor}
          />
        </View>

        <View style={styles.ticketCopy}>
          <Text
            numberOfLines={2}
            style={[
              styles.ticketTitle,
              isCompact && styles.ticketTitleCompact,
              { color: theme.colors.text },
            ]}
          >
            {trip.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.ticketMeta,
              isCompact && styles.ticketMetaCompact,
              { color: theme.colors.textMuted },
            ]}
          >
            出发时间 {formatTripStart(trip)}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.ticketMeta,
              isCompact && styles.ticketMetaCompact,
              { color: theme.colors.textMuted },
            ]}
          >
            {formatTripDestination(trip)}
          </Text>
          <View style={styles.ticketBottomRow}>
            <Text
              style={[
                styles.ticketMemberText,
                { color: theme.colors.textMuted },
              ]}
            >
              共1名成员
            </Text>
            <View style={styles.ticketBadgeRow}>
              {trip.pinnedAt ? <PinnedBadge /> : null}
              {isCompleted && !trip.id.startsWith("seed-") ? null : (
                <StatusBadge
                  status={trip.status}
                  style={styles.ticketStatusBadge}
                  label={getTripStatusDisplayLabel(trip)}
                />
              )}
            </View>
          </View>
          {footer}
        </View>
      </View>

      <View
        style={[
          styles.ticketStub,
          {
            backgroundColor: ticketPalette.stubBackgroundColor,
            borderTopRightRadius: theme.radius.lg,
            borderBottomRightRadius: theme.radius.lg,
          },
          isCompact && styles.ticketStubCompact,
        ]}
      >
        <View style={styles.ticketStubHeader}>
          <Text
            style={[
              styles.ticketSlogan,
              { color: ticketPalette.stubTextColor },
            ]}
          >
            THE TRIP{"\n"}MUST GO ON
          </Text>
          <MaterialIcons
            name="public"
            size={24}
            color={ticketPalette.stubIconColor}
          />
        </View>
        <TicketDash color={theme.colors.ticket.dash} />
        <View style={styles.ticketStubStat}>
          <Text
            style={[
              styles.ticketStubLabel,
              { color: ticketPalette.stubTextColor },
            ]}
          >
            时长:
          </Text>
          <Text
            style={[
              styles.ticketStubValue,
              { color: ticketPalette.stubTextColor },
            ]}
          >
            {formatTripDuration(trip)}
          </Text>
        </View>
        <View style={styles.ticketStubStat}>
          <Text
            style={[
              styles.ticketStubLabel,
              { color: ticketPalette.stubTextColor },
            ]}
          >
            地点:
          </Text>
          <Text
            style={[
              styles.ticketStubValue,
              { color: ticketPalette.stubTextColor },
            ]}
          >
            {tripItemCount}个
          </Text>
        </View>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.ticketStubDivider,
          isCompact && styles.ticketStubDividerCompact,
        ]}
      >
        <TicketDash color={theme.colors.ticket.dash} orientation="vertical" />
      </View>
      {isCompleted ? <CompletedPostmark /> : null}
      <View
        style={[
          styles.ticketNotch,
          styles.ticketNotchTop,
          isCompact && styles.ticketNotchCompact,
          { backgroundColor: theme.colors.background },
        ]}
      />
      <View
        style={[
          styles.ticketNotch,
          styles.ticketNotchBottom,
          isCompact && styles.ticketNotchCompact,
          { backgroundColor: theme.colors.background },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    borderWidth: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  badgeRow: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pinBadge: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pinBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  infoBlock: {
    gap: 8,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  featuredTicketOuter: {
    overflow: "visible",
    position: "relative",
  },
  featuredTicketTop: {
    minHeight: 110,
    gap: 10,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 11,
    position: "relative",
  },
  featuredTicketTopPattern: {
    position: "absolute",
    right: 16,
    bottom: 10,
    flexDirection: "row",
    gap: 8,
    opacity: 0.18,
  },
  featuredTicketPatternDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  featuredTicketBoardingRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featuredTicketIconBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  featuredTicketTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  featuredTicketKicker: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  featuredTicketPassText: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
  },
  featuredTicketTitle: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  featuredTicketStatusBadge: {
    minHeight: 34,
    minWidth: 70,
    borderRadius: 12,
  },
  featuredTicketHeroFooter: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  featuredTicketHeroChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featuredTicketHeroChipText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  featuredTicketSeamOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    overflow: "visible",
  },
  featuredTicketCenteredDash: {
    position: "absolute",
    left: 38,
    right: 38,
    zIndex: 1,
  },
  featuredTicketBottom: {
    gap: 12,
    overflow: "visible",
    paddingHorizontal: 18,
    paddingBottom: 18,
    position: "relative",
  },
  featuredTicketSideNotch: {
    position: "absolute",
    top: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    zIndex: 2,
  },
  featuredTicketSideNotchLeft: {
    left: -15,
  },
  featuredTicketSideNotchRight: {
    right: -15,
  },
  featuredTicketRouteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  featuredTicketRouteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  featuredTicketRouteLabel: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
    opacity: 0.62,
  },
  featuredTicketInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featuredTicketInfoText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  featuredTicketSerialBlock: {
    minWidth: 82,
    alignItems: "flex-end",
  },
  featuredTicketSerialRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  featuredTicketSerialAffix: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    opacity: 0.82,
  },
  featuredTicketSerialNumber: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
  },
  featuredTicketStatsGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  featuredTicketStatsGridCompact: {
    flexWrap: "wrap",
  },
  featuredTicketStatCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 14,
  },
  featuredTicketStatCardCompact: {
    flexBasis: "47%",
  },
  featuredTicketStatValue: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
    textAlign: "center",
  },
  featuredTicketStatLabel: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    opacity: 0.68,
    textAlign: "center",
  },
  featuredTicketFooterRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  featuredTicketUpdatedAt: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    opacity: 0.64,
  },
  featuredTicketPunchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  featuredTicketPunchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    opacity: 0.42,
  },

  ticketOuter: {
    minHeight: 150,
    flexDirection: "row",
    backgroundColor: "transparent",
    overflow: "visible",
    position: "relative",
  },
  ticketMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  ticketMainCompact: {
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 16,
  },
  ticketIconBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 15,
    marginTop: 1,
  },
  ticketCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  ticketBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ticketTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  ticketTitleCompact: {
    fontSize: 18,
    lineHeight: 23,
  },
  ticketStatusBadge: {
    minHeight: 28,
    minWidth: 58,
    paddingHorizontal: 8,
  },
  ticketMeta: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  ticketMetaCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  ticketBottomRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: "auto",
  },
  ticketMemberText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  ticketStub: {
    width: 128,
    justifyContent: "space-between",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 20,
    position: "relative",
  },
  ticketStubCompact: {
    width: 108,
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  ticketStubHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  ticketSlogan: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
  },
  ticketStubStat: {
    alignItems: "flex-end",
    gap: 3,
  },
  ticketStubLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  ticketStubValue: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  ticketStubDivider: {
    position: "absolute",
    top: 20,
    bottom: 20,
    right: 124,
    alignItems: "center",
    justifyContent: "center",
    width: 8,
  },
  ticketStubDividerCompact: {
    right: 104,
  },
  ticketDashRow: {
    width: "100%",
    minHeight: 2,
    marginVertical: 4,
  },
  ticketDashColumn: {
    height: "100%",
    minWidth: 2,
  },
  ticketDashNoOuterMargin: {
    marginVertical: 0,
  },
  ticketCompletedPostmark: {
    position: "absolute",
    right: 24,
    bottom: 5,
    width: 206,
    height: 103,
    opacity: 0.34,
    transform: [{ rotate: "-7deg" }],
  },
  ticketCompletedPostmarkImage: {
    width: "100%",
    height: "100%",
  },
  ticketNotch: {
    position: "absolute",
    right: 118,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  ticketNotchCompact: {
    right: 98,
  },
  ticketNotchTop: {
    top: -10,
  },
  ticketNotchBottom: {
    bottom: -10,
  },
});
