import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatExpenseAmount,
  getPlaceForTripDayItem,
  type Trip,
  type TripDayItem,
} from "@/features/trips";
import type { TripWeatherDayForecast } from "@/features/weather";
import { PlaceLogo } from "@/shared/places/place-logo";
import { useAppTheme } from "@/shared/theme/use-app-theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CONTAINER_PADDING = 12;
const PILL_GAP = 6;
const ARROW_WIDTH = 20;
const PILL_MAX_WIDTH =
  (SCREEN_WIDTH - CONTAINER_PADDING * 2 - PILL_GAP - ARROW_WIDTH) / 2;

type TodayRoutePillsProps = {
  onItemPress: (item: TripDayItem) => void;
  items: TripDayItem[];
  trip: Trip;
  weather?: TripWeatherDayForecast;
};

function getCurrentItemIndex(items: TripDayItem[]): number {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let currentIndex = -1;

  for (let i = 0; i < items.length; i++) {
    const time = items[i]?.time;
    if (!time) continue;

    const [hours, minutes] = time.split(":").map(Number);
    const itemMinutes = (hours ?? 0) * 60 + (minutes ?? 0);

    if (itemMinutes <= currentMinutes) {
      currentIndex = i;
    }
  }

  return currentIndex;
}

export function TodayRoutePills({
  items,
  trip,
  onItemPress,
}: TodayRoutePillsProps) {
  const theme = useAppTheme();

  const currentIndex = useMemo(() => getCurrentItemIndex(items), [items]);

  const stats = useMemo(() => {
    const totalCost = items.reduce((sum, item) => {
      if (typeof item.cost === "number" && item.cost > 0) {
        return sum + item.cost;
      }
      return sum;
    }, 0);

    const lastTimedItem = [...items].reverse().find((item) => item.time);

    return {
      cost: totalCost,
      endTime: lastTimedItem?.time,
      placeCount: items.length,
    };
  }, [items]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceSubtle,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.overviewBar}>
        <View style={styles.overviewItem}>
          <MaterialIcons
            name="place"
            size={14}
            color={theme.colors.textMuted}
          />
          <Text
            style={[styles.overviewText, { color: theme.colors.textMuted }]}
          >
            {stats.placeCount}个地点
          </Text>
        </View>

        <Text
          style={[styles.overviewDivider, { color: theme.colors.textSubtle }]}
        >
          ·
        </Text>

        <View style={styles.overviewItem}>
          <MaterialIcons
            name="payments"
            size={14}
            color={theme.colors.textMuted}
          />
          <Text
            style={[styles.overviewText, { color: theme.colors.textMuted }]}
          >
            {stats.cost > 0
              ? `已花费 ${formatExpenseAmount(stats.cost)}`
              : "暂无花费"}
          </Text>
        </View>

        <Text
          style={[styles.overviewDivider, { color: theme.colors.textSubtle }]}
        >
          ·
        </Text>

        <View style={styles.overviewItem}>
          <MaterialIcons
            name="schedule"
            size={14}
            color={theme.colors.textMuted}
          />
          <Text
            style={[styles.overviewText, { color: theme.colors.textMuted }]}
          >
            {stats.endTime ? `预计${stats.endTime}结束` : "时间待定"}
          </Text>
        </View>
      </View>

      <View style={styles.pillsContainer}>
        {items.map((item, index) => {
          const place = getPlaceForTripDayItem(trip, item);
          const isActive = index === currentIndex;
          const isDone = currentIndex >= 0 && index < currentIndex;

          return (
            <View key={item.id} style={styles.pillGroup}>
              {index > 0 ? (
                <MaterialIcons
                  name="arrow-forward"
                  size={14}
                  color={theme.colors.textSubtle}
                  style={styles.arrow}
                />
              ) : null}

              <Pressable
                accessibilityLabel={`${item.title}${item.time ? ` ${item.time}` : ""}`}
                accessibilityRole="button"
                onPress={() => onItemPress(item)}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: isActive
                      ? theme.colors.primary
                      : isDone
                        ? theme.colors.surfaceMuted
                        : theme.colors.primarySoft,
                    borderColor: isActive
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                  pressed && styles.pillPressed,
                ]}
              >
                <PlaceLogo
                  category={item.category ?? place?.category}
                  iconKey={item.iconKey ?? place?.iconKey}
                  size={18}
                />

                <Text
                  numberOfLines={1}
                  style={[
                    styles.pillName,
                    {
                      color: isActive
                        ? theme.colors.onPrimary
                        : isDone
                          ? theme.colors.textSubtle
                          : theme.colors.text,
                    },
                    isDone && styles.pillNameDone,
                  ]}
                >
                  {item.placeName ?? item.title}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  overviewBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  overviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  overviewText: {
    fontSize: 12,
    fontWeight: "600",
  },
  overviewDivider: {
    fontSize: 12,
    fontWeight: "400",
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  weatherText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pillGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  arrow: {
    marginHorizontal: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: PILL_MAX_WIDTH,
  },
  pillPressed: {
    opacity: 0.85,
  },
  pillName: {
    fontSize: 13,
    fontWeight: "600",
  },
  pillNameDone: {
    textDecorationLine: "line-through",
  },
});
