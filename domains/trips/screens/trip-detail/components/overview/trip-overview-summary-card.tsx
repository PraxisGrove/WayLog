import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

import {
  countDueTripItems,
  countTripItems,
  formatExpenseAmount,
  formatTripDateRange,
  formatTripDestination,
  formatUpdatedAt,
  getTripStatusDisplayLabel,
  type Trip,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { StatusBadge } from "@/shared/ui/status-badge";
import type { createStyles } from "../../trip-detail.styles";

type TripOverviewSummaryCardProps = {
  onEditPress: () => void;
  onOpenAgentPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  totalCost: number;
  trip: Trip;
};

export function TripOverviewSummaryCard({
  onEditPress,
  onOpenAgentPress,
  styles,
  theme,
  totalCost,
  trip,
}: TripOverviewSummaryCardProps) {
  return (
    <View style={[styles.overviewBaseCard, styles.overviewCard]}>
      <View style={styles.overviewHeader}>
        <View style={styles.overviewTitleCopy}>
          <Text style={styles.overviewKicker}>行程控制台</Text>
          <Text numberOfLines={1} style={styles.overviewTitle}>
            {trip.title}
          </Text>
        </View>
        <View style={styles.overviewHeaderActions}>
          <StatusBadge
            status={trip.status}
            label={getTripStatusDisplayLabel(trip)}
          />
        </View>
      </View>

      <View style={styles.overviewInfoBlock}>
        <View style={styles.overviewInfoItem}>
          <MaterialIcons name="place" size={17} color={theme.colors.primary} />
          <View style={styles.overviewInfoCopy}>
            <Text style={styles.overviewInfoLabel}>目的地</Text>
            <Text numberOfLines={1} style={styles.overviewInfoText}>
              {formatTripDestination(trip)}
            </Text>
          </View>
        </View>
        <View style={styles.overviewInfoItem}>
          <MaterialIcons name="event" size={17} color={theme.colors.primary} />
          <View style={styles.overviewInfoCopy}>
            <Text style={styles.overviewInfoLabel}>日期</Text>
            <Text numberOfLines={1} style={styles.overviewInfoText}>
              {formatTripDateRange(trip)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.overviewStatsGrid}>
        <View style={styles.overviewStatCard}>
          <Text style={styles.overviewStatValue}>{trip.days.length}</Text>
          <Text style={styles.overviewStatLabel}>天数</Text>
        </View>
        <View style={styles.overviewStatCard}>
          <Text style={styles.overviewStatValue}>{countTripItems(trip)}</Text>
          <Text style={styles.overviewStatLabel}>地点</Text>
        </View>
        <View style={styles.overviewStatCard}>
          <Text style={styles.overviewStatValue}>
            {countDueTripItems(trip)}
          </Text>
          <Text style={styles.overviewStatLabel}>已到地点</Text>
        </View>
        <View style={styles.overviewStatCard}>
          <Text style={styles.overviewStatValue}>
            {formatExpenseAmount(totalCost, trip.currency)}
          </Text>
          <Text style={styles.overviewStatLabel}>总花费</Text>
        </View>
      </View>

      <View style={styles.overviewFooter}>
        <Text style={styles.overviewUpdatedText}>
          {formatUpdatedAt(trip.updatedAt)}
        </Text>
        <View style={styles.overviewFooterActions}>
          <Pressable
            accessibilityLabel="打开这趟行程的旅行助手"
            accessibilityRole="button"
            onPress={onOpenAgentPress}
            style={({ pressed }) => [
              styles.overviewEditTextButton,
              pressed && [
                styles.overviewEditButtonPressed,
                { backgroundColor: theme.colors.surfaceSubtle },
              ],
            ]}
          >
            <MaterialIcons
              name="auto-awesome"
              size={15}
              color={theme.colors.primary}
            />
            <Text style={styles.editPlanButtonText}>助手</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="编辑这次行程计划"
            accessibilityRole="button"
            onPress={onEditPress}
            style={({ pressed }) => [
              styles.overviewEditTextButton,
              pressed && [
                styles.overviewEditButtonPressed,
                { backgroundColor: theme.colors.surfaceSubtle },
              ],
            ]}
          >
            <MaterialIcons name="edit" size={15} color={theme.colors.primary} />
            <Text style={styles.editPlanButtonText}>编辑计划</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
