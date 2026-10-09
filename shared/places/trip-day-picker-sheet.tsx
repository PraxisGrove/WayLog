import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createDiagnosticLogger } from "@/features/diagnostics";
import { getTrips, type Trip, type TripDay } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ModalTransition } from "@/shared/ui/modal-transition";

const tripDayPickerSheetLogger = createDiagnosticLogger(
  "trip-day-picker-sheet",
);
type TripDayPickerSheetProps = {
  visible: boolean;
  placeName?: string;
  onClose: () => void;
  onSelect: (tripId: string, dayId: string) => void;
};

function isActiveTrip(trip: Trip): boolean {
  return trip.status === "计划中" || trip.status === "旅途中";
}

function formatTripDateRange(trip: Trip): string {
  if (!trip.startDate || !trip.endDate) {
    return "未设置日期";
  }
  return `${trip.startDate} ~ ${trip.endDate}`;
}

function TripCard({
  isExpanded,
  onToggle,
  onSelectDay,
  theme,
  trip,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  onSelectDay: (dayId: string) => void;
  theme: AppTheme;
  trip: Trip;
}) {
  const hasDays = trip.days.length > 0;
  const { colors } = theme;

  return (
    <View
      style={[
        styles.tripCard,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [
          styles.tripHeader,
          pressed && { backgroundColor: colors.surfacePressed },
        ]}
      >
        <View
          style={[styles.tripIcon, { backgroundColor: colors.primarySoft }]}
        >
          <MaterialIcons name="card-travel" size={20} color={colors.primary} />
        </View>
        <View style={styles.tripInfo}>
          <Text
            numberOfLines={1}
            style={[styles.tripTitle, { color: colors.text }]}
          >
            {trip.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.tripMeta, { color: colors.textMuted }]}
          >
            {trip.destination} · {formatTripDateRange(trip)} ·{" "}
            {trip.days.length}天
          </Text>
        </View>
        {hasDays ? (
          <MaterialIcons
            name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={22}
            color={colors.textMuted}
          />
        ) : null}
      </Pressable>

      {isExpanded && hasDays ? (
        <View style={[styles.daysList, { borderTopColor: colors.border }]}>
          {trip.days.map((day) => (
            <DayRow
              day={day}
              key={day.id}
              onSelect={() => onSelectDay(day.id)}
              theme={theme}
            />
          ))}
        </View>
      ) : null}

      {isExpanded && !hasDays ? (
        <View style={styles.noDaysHint}>
          <Text style={[styles.noDaysText, { color: colors.textSubtle }]}>
            该行程暂无日程安排
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DayRow({
  day,
  onSelect,
  theme,
}: {
  day: TripDay;
  onSelect: () => void;
  theme: AppTheme;
}) {
  const { colors } = theme;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => [
        styles.dayRow,
        pressed && { backgroundColor: colors.surfacePressed },
      ]}
    >
      <View style={[styles.dayIndex, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.dayIndexText, { color: colors.primary }]}>
          {day.dayIndex}
        </Text>
      </View>
      <View style={styles.dayInfo}>
        <Text
          numberOfLines={1}
          style={[styles.dayTitle, { color: colors.text }]}
        >
          {day.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.dayMeta, { color: colors.textSubtle }]}
        >
          {day.items.length}个地点
        </Text>
      </View>
      <MaterialIcons
        name="add-circle-outline"
        size={22}
        color={colors.primary}
      />
    </Pressable>
  );
}

export function TripDayPickerSheet({
  onClose,
  onSelect,
  placeName,
  visible,
}: TripDayPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useAppTheme();
  const { colors, radius } = theme;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isActive = true;
    setLoading(true);

    const loadTrips = async () => {
      try {
        const allTrips = await getTrips();
        if (isActive) {
          setTrips(allTrips.filter(isActiveTrip));
        }
      } catch (error) {
        if (isActive) {
          tripDayPickerSheetLogger.warn(
            "legacy.warn",
            { args: ["Failed to load trips for day picker.", error] },
            "Legacy warning captured",
          );
          setTrips([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadTrips();

    return () => {
      isActive = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setExpandedTripId(undefined);
    }
  }, [visible]);

  const handleToggleTrip = (tripId: string) => {
    setExpandedTripId((current) => (current === tripId ? undefined : tripId));
  };

  const handleSelectDay = (tripId: string, dayId: string) => {
    onSelect(tripId, dayId);
    onClose();
  };

  const handleCreateTrip = () => {
    onClose();
    router.push("/trips/new");
  };

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭行程和天数选择"
      contentStyle={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
      onRequestClose={onClose}
      overlayColor={colors.overlay}
      preset="sheet"
      rootStyle={styles.overlay}
      visible={visible}
    >
      <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>
            选择行程和天数
          </Text>
          {placeName ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              将「{placeName}」添加到
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="关闭"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <MaterialIcons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.tripList}
        showsVerticalScrollIndicator={false}
        style={styles.tripScroller}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              正在加载行程
            </Text>
          </View>
        ) : null}

        {!isLoading && trips.length === 0 ? (
          <View style={styles.emptyBlock}>
            <MaterialIcons
              name="card-travel"
              size={32}
              color={colors.textSubtle}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              暂无行程
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              创建一个行程后，就能把地点添加到行程中了。
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleCreateTrip}
              style={({ pressed }) => [
                styles.createButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.sm,
                },
                pressed && { backgroundColor: colors.primaryPressed },
              ]}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>新建行程</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading &&
          trips.map((trip) => (
            <TripCard
              isExpanded={expandedTripId === trip.id}
              key={trip.id}
              onSelectDay={(dayId) => handleSelectDay(trip.id, dayId)}
              onToggle={() => handleToggleTrip(trip.id)}
              theme={theme}
              trip={trip}
            />
          ))}
      </ScrollView>
    </ModalTransition>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "75%",
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 6,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
  tripList: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tripScroller: {
    flex: 1,
  },
  tripCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  tripIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tripInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  tripMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  daysList: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dayIndex: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dayIndexText: {
    fontSize: 13,
    fontWeight: "700",
  },
  dayInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  dayMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  noDaysHint: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  noDaysText: {
    fontSize: 13,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 28,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyBlock: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 6,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
