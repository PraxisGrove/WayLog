import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { RefObject } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  formatDayTabDate,
  formatTripDayTitle,
  type Trip,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { OVERVIEW_PAGE_ID } from "../constants";
import type { createStyles } from "../trip-detail.styles";

type TripDetailDayTabsProps = {
  isOverviewSelected: boolean;
  onAddDay: () => void | Promise<void>;
  onContentWidthChange: (width: number) => void;
  onDayLayout: (dayId: string, event: LayoutChangeEvent) => void;
  onDayLongPress: (dayId: string) => void;
  onDayPress: (dayId: string) => void;
  onOverviewPress: () => void;
  onViewportWidthChange: (width: number) => void;
  scrollRef: RefObject<ScrollView | null>;
  selectedDayId?: string;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  trip: Trip;
};

export function TripDetailDayTabs({
  isOverviewSelected,
  onAddDay,
  onContentWidthChange,
  onDayLayout,
  onDayLongPress,
  onDayPress,
  onOverviewPress,
  onViewportWidthChange,
  scrollRef,
  selectedDayId,
  styles,
  theme,
  trip,
}: TripDetailDayTabsProps) {
  return (
    <View style={styles.dayTabsRow}>
      <ScrollView
        contentContainerStyle={styles.dayTabs}
        horizontal
        onContentSizeChange={onContentWidthChange}
        onLayout={(event) =>
          onViewportWidthChange(event.nativeEvent.layout.width)
        }
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={styles.dayTabsScroller}
      >
        <Pressable
          accessibilityRole="button"
          onLayout={(event) => onDayLayout(OVERVIEW_PAGE_ID, event)}
          onPress={onOverviewPress}
          style={({ pressed }) => [
            styles.dayTab,
            isOverviewSelected && styles.overviewDayTabSelected,
            pressed && [
              isOverviewSelected
                ? styles.overviewDayTabPressed
                : styles.dayTabPressed,
            ],
          ]}
        >
          <Text
            style={[
              styles.dayTabText,
              isOverviewSelected && styles.overviewDayTabTextSelected,
            ]}
          >
            总览
          </Text>
        </Pressable>

        {trip.days.map((day) => {
          const isSelected = !isOverviewSelected && day.id === selectedDayId;
          const dayTabDate = isSelected
            ? formatDayTabDate(trip, day)
            : undefined;
          const dayTabTitle = formatTripDayTitle(day.dayIndex);

          return (
            <Pressable
              accessibilityHint="长按可编辑或删除这一天"
              accessibilityRole="button"
              delayLongPress={350}
              key={day.id}
              onLayout={(event) => onDayLayout(day.id, event)}
              onLongPress={() => onDayLongPress(day.id)}
              onPress={() => onDayPress(day.id)}
              style={({ pressed }) => [
                styles.dayTab,
                isSelected && styles.dayTabSelected,
                pressed && [
                  styles.dayTabPressed,
                  { backgroundColor: theme.colors.surfaceSubtle },
                ],
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.dayTabText,
                  isSelected && styles.dayTabTextSelected,
                ]}
              >
                {dayTabTitle}
              </Text>
              {dayTabDate ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.dayTabDateText,
                    isSelected && styles.dayTabTextSelected,
                  ]}
                >
                  {dayTabDate}
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable
          accessibilityLabel="新增一天行程"
          accessibilityRole="button"
          onPress={() => {
            void onAddDay();
          }}
          style={({ pressed }) => [
            styles.addDayTab,
            pressed && [
              styles.dayTabPressed,
              { backgroundColor: theme.colors.surfaceSubtle },
            ],
          ]}
        >
          <MaterialIcons name="add" size={22} color={theme.colors.primary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
