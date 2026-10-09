import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";
import {
  countTripItems,
  resolveTripDayTitle,
  type Trip,
  type TripDay,
  type TripPlace,
} from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import type { AppTheme } from "@/shared/theme/theme";
import type { createStyles } from "../../trip-detail.styles";

export type RouteOverviewDay = {
  day: TripDay;
  dayDate?: string;
  dayPlaces: TripPlace[];
};

type RouteOverviewCardProps = {
  days: RouteOverviewDay[];
  onPlacePress: (placeId: string) => void;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  trip: Trip;
};

export function RouteOverviewCard({
  days,
  onPlacePress,
  styles,
  theme,
  trip,
}: RouteOverviewCardProps) {
  return (
    <View style={styles.routeOverviewCard}>
      <View style={styles.routeOverviewHeader}>
        <Text style={styles.sectionTitle}>路线总览</Text>
        <Text style={styles.sectionHint}>{countTripItems(trip)} 个地点</Text>
      </View>

      {days.length > 0 ? (
        <View style={styles.routeDayList}>
          {days.map(({ day, dayDate, dayPlaces }) => (
            <View key={day.id} style={styles.routeDayRow}>
              <View style={styles.routeDayHeader}>
                <Text style={styles.routeDayLabel}>
                  {resolveTripDayTitle(day)}
                </Text>
                <View style={styles.routeDayDivider} />
                <Text style={styles.routeDayMeta}>
                  {[dayDate, `${dayPlaces.length}个地点`]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <View style={styles.routeDayPills}>
                {dayPlaces.map((place, index) => (
                  <Fragment key={place.id}>
                    {index > 0 ? (
                      <Text style={styles.routeArrow}>→</Text>
                    ) : null}
                    <Pressable
                      accessibilityHint="查看地点详情"
                      accessibilityRole="button"
                      onPress={() => onPlacePress(place.id)}
                      style={({ pressed }) => [
                        styles.routePill,
                        pressed && [
                          styles.routePillPressed,
                          { backgroundColor: theme.colors.surfaceSubtle },
                        ],
                      ]}
                    >
                      <PlaceLogo
                        category={place.category}
                        iconKey={place.iconKey}
                        size={18}
                      />
                      <Text numberOfLines={1} style={styles.routePillText}>
                        {place.name}
                      </Text>
                    </Pressable>
                  </Fragment>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.routeOverviewEmpty}>
          <MaterialIcons name="map" size={28} color={theme.colors.textSubtle} />
          <Text style={styles.itemTitle}>还没有路线点</Text>
          <Text style={styles.mutedText}>安排地点后，这里会形成路线预览。</Text>
        </View>
      )}
    </View>
  );
}
