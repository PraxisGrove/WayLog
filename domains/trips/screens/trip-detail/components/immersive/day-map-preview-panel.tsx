import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getPlaceForTripDayItem,
  type Trip,
  type TripDay,
  type TripDayItem,
  type TripDayRouteSegment,
  type TripPlace,
} from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

export type DayMapPreviewPanelProps = {
  activeItem?: TripDayItem;
  cardGap: number;
  cardHeight: number;
  cardWidth: number;
  isCarouselReady: boolean;
  items: TripDayItem[];
  nextSegment?: TripDayRouteSegment;
  nextSegmentText: string;
  onItemPress: (
    item: TripDayItem,
    place: TripPlace | undefined,
    dayId: string,
  ) => void;
  onLayoutWidth: (width: number) => void;
  onRouteSegmentPress: (segment: TripDayRouteSegment) => void;
  onScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  paddingBottom: number;
  previousSegment?: TripDayRouteSegment;
  previousSegmentText: string;
  scrollRef: React.RefObject<ScrollView | null>;
  selectedDay: TripDay;
  trip: Trip;
};

export function DayMapPreviewPanel({
  activeItem,
  cardGap,
  cardHeight,
  cardWidth,
  isCarouselReady,
  items,
  nextSegment,
  nextSegmentText,
  onItemPress,
  onLayoutWidth,
  onRouteSegmentPress,
  onScrollEnd,
  paddingBottom,
  previousSegment,
  previousSegmentText,
  scrollRef,
  selectedDay,
  trip,
}: DayMapPreviewPanelProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme, cardHeight);
  const activeIndex = activeItem
    ? items.findIndex((item) => item.id === activeItem.id)
    : -1;

  return (
    <View
      onLayout={(event) => onLayoutWidth(event.nativeEvent.layout.width)}
      style={[styles.dayMapPreviewPanel, { paddingBottom }]}
    >
      {items.length > 0 ? (
        isCarouselReady ? (
          <>
            <ScrollView
              contentContainerStyle={[
                styles.dayMapPreviewCarouselContent,
                { gap: cardGap },
              ]}
              decelerationRate="fast"
              disableIntervalMomentum
              horizontal
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onMomentumScrollEnd={onScrollEnd}
              onScrollEndDrag={onScrollEnd}
              ref={scrollRef}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={cardWidth > 0 ? cardWidth + cardGap : undefined}
              style={styles.dayMapPreviewCarousel}
            >
              {items.map((item) => {
                const place = getPlaceForTripDayItem(trip, item);
                const isActivePreviewItem = activeItem?.id === item.id;

                return (
                  <Pressable
                    accessibilityLabel={`查看${item.title}详情`}
                    accessibilityRole="button"
                    key={item.id}
                    onPress={() => onItemPress(item, place, selectedDay.id)}
                    style={({ pressed }) => [
                      styles.dayMapPreviewCard,
                      cardWidth > 0 ? { width: cardWidth } : null,
                      isActivePreviewItem && styles.dayMapPreviewCardActive,
                      pressed && styles.dayMapPreviewCardPressed,
                    ]}
                  >
                    <PlaceLogo
                      category={place?.category ?? item.category}
                      iconKey={place?.iconKey ?? item.iconKey}
                      size={40}
                    />
                    <View style={styles.dayMapPreviewCopy}>
                      <View style={styles.dayMapPreviewTitleRow}>
                        <Text
                          numberOfLines={1}
                          style={styles.dayMapPreviewTitle}
                        >
                          {item.title}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={styles.dayMapPreviewMeta}>
                        {[
                          item.time,
                          place?.area,
                          item.category ?? place?.category,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "地点信息待补充"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.dayMapPreviewRouteRow}>
              {previousSegment ? (
                <Pressable
                  accessibilityHint="查看上一段路线详情"
                  accessibilityRole="button"
                  onPress={() => onRouteSegmentPress(previousSegment)}
                  style={({ pressed }) => [
                    styles.dayMapPreviewRouteSegment,
                    pressed && [
                      styles.dayMapPreviewRouteSegmentPressed,
                      { backgroundColor: theme.colors.surfaceSubtle },
                    ],
                  ]}
                >
                  <Text numberOfLines={1} style={styles.dayMapPreviewRouteText}>
                    {previousSegmentText}
                  </Text>
                </Pressable>
              ) : (
                <Text numberOfLines={1} style={styles.dayMapPreviewRouteText}>
                  {previousSegmentText}
                </Text>
              )}
              <View style={styles.dayMapPreviewRouteBadge}>
                <Text style={styles.dayMapPreviewRouteBadgeText}>
                  {Math.max(0, activeIndex) + 1}
                </Text>
              </View>
              {nextSegment ? (
                <Pressable
                  accessibilityHint="查看下一段路线详情"
                  accessibilityRole="button"
                  onPress={() => onRouteSegmentPress(nextSegment)}
                  style={({ pressed }) => [
                    styles.dayMapPreviewRouteSegment,
                    pressed && [
                      styles.dayMapPreviewRouteSegmentPressed,
                      { backgroundColor: theme.colors.surfaceSubtle },
                    ],
                  ]}
                >
                  <Text numberOfLines={1} style={styles.dayMapPreviewRouteText}>
                    {nextSegmentText}
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={18}
                    color={theme.colors.textSubtle}
                  />
                </Pressable>
              ) : (
                <Text numberOfLines={1} style={styles.dayMapPreviewRouteText}>
                  {nextSegmentText}
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.dayMapPreviewEmpty}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )
      ) : (
        <View style={styles.dayMapPreviewEmpty}>
          <MaterialIcons
            name="event-note"
            size={24}
            color={theme.colors.textSubtle}
          />
          <Text style={styles.mutedText}>
            这一天还没有地点，先添加一个地点后再查看地图预览。
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme, cardHeight: number) {
  return StyleSheet.create({
    dayMapPreviewPanel: {
      flex: 1,
      minHeight: 0,
      gap: 10,
      paddingTop: 2,
      paddingBottom: 6,
    },
    dayMapPreviewCarousel: {
      height: cardHeight,
      flexGrow: 0,
      flexShrink: 0,
      overflow: "visible",
    },
    dayMapPreviewCarouselContent: {
      alignItems: "flex-start",
    },
    dayMapPreviewCard: {
      height: cardHeight,
      minHeight: cardHeight,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
    },
    dayMapPreviewCardActive: {
      backgroundColor: theme.colors.primarySoft,
    },
    dayMapPreviewCardPressed: {
      backgroundColor: theme.colors.primarySoft,
    },
    dayMapPreviewCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    dayMapPreviewTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dayMapPreviewTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    dayMapPreviewMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "500",
    },
    dayMapPreviewRouteRow: {
      height: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
    },
    dayMapPreviewRouteSegment: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    dayMapPreviewRouteSegmentPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    dayMapPreviewRouteText: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    dayMapPreviewRouteBadge: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: theme.colors.primary,
    },
    dayMapPreviewRouteBadgeText: {
      color: theme.colors.surface,
      fontSize: 11,
      fontWeight: "700",
    },
    dayMapPreviewEmpty: {
      flex: 1,
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
