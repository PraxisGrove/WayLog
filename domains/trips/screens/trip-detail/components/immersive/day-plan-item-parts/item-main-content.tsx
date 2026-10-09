import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import type { TripDayItem, TripPlace } from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import { DayPlanItemTags } from "./item-tags";
import { RecommendationReason } from "./recommendation-reason";
import type { DayPlanItemStyles } from "./styles";

export function DayPlanItemMainContent({
  accessibilityHint,
  costLabel,
  dragEnabled,
  handleMainPress,
  handleTouchEnd,
  hasRecordedCost,
  isReasonExpanded,
  item,
  locationText,
  noteText,
  onCostPress,
  onTimePress,
  place,
  recommendationReason,
  setReasonExpanded,
  startDrag,
  styles,
  dragLongPressMs,
}: {
  accessibilityHint?: string;
  costLabel: string;
  dragEnabled: boolean;
  dragLongPressMs: number;
  handleMainPress: () => void;
  handleTouchEnd: () => void;
  hasRecordedCost: boolean;
  isReasonExpanded: boolean;
  item: TripDayItem;
  locationText: string;
  noteText?: string;
  onCostPress?: (event: GestureResponderEvent) => void;
  onTimePress: (event: GestureResponderEvent) => void;
  place?: TripPlace;
  recommendationReason?: string;
  setReasonExpanded: (updater: (current: boolean) => boolean) => void;
  startDrag: () => void;
  styles: DayPlanItemStyles;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.mainArea}>
      <PlaceLogo
        category={item.category ?? place?.category}
        iconKey={item.iconKey ?? place?.iconKey}
        size={36}
      />
      <View style={styles.copy}>
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityRole="button"
          delayLongPress={dragLongPressMs}
          onLongPress={dragEnabled ? startDrag : undefined}
          onPress={handleMainPress}
          onPressOut={dragEnabled ? handleTouchEnd : undefined}
          style={({ pressed }) => [
            styles.copyPressable,
            pressed && styles.copyPressed,
          ]}
        >
          <Text style={styles.title}>{item.title}</Text>
          {locationText ? (
            <View style={styles.addressRow}>
              <MaterialIcons
                color={theme.colors.textSubtle}
                name="place"
                size={12}
              />
              <Text numberOfLines={1} style={styles.addressText}>
                {locationText}
              </Text>
            </View>
          ) : null}
          {noteText ? (
            <View style={styles.noteRow}>
              <MaterialIcons
                color={theme.colors.textSubtle}
                name="sticky-note-2"
                size={12}
              />
              <Text numberOfLines={1} style={styles.noteText}>
                {noteText}
              </Text>
            </View>
          ) : null}
          {recommendationReason ? (
            <RecommendationReason
              isExpanded={isReasonExpanded}
              onToggle={() => setReasonExpanded((current) => !current)}
              reason={recommendationReason}
              styles={styles}
            />
          ) : null}
        </Pressable>
        <DayPlanItemTags
          costLabel={costLabel}
          hasRecordedCost={hasRecordedCost}
          item={item}
          onCostPress={onCostPress}
          onTimePress={onTimePress}
          styles={styles}
        />
      </View>
    </View>
  );
}
