import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TripDay } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { DAY_MAP_PREVIEW_CONTEXT_HEADER_ESTIMATED_HEIGHT } from "../../immersive/constants";

type DayMapPreviewHeaderProps = {
  itemCount: number;
  onExpandPress: () => void;
  selectedDay: TripDay;
};

export function DayMapPreviewHeader({
  itemCount,
  onExpandPress,
  selectedDay,
}: DayMapPreviewHeaderProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.dayHeader}>
      <View style={styles.dayTitleBlock}>
        <Text style={styles.eyebrow}>当日路线</Text>
        <View style={styles.dayTitleRow}>
          <Text numberOfLines={1} style={styles.dayTitle}>
            {selectedDay.title}
          </Text>
          <Text numberOfLines={1} style={styles.dayMeta}>
            {itemCount} 个地点
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityHint="切换到完整行程列表"
        accessibilityLabel="展开当天完整日程"
        accessibilityRole="button"
        onPress={onExpandPress}
        style={({ pressed }) => [
          styles.expandButton,
          pressed && styles.expandButtonPressed,
        ]}
      >
        <MaterialIcons
          name="keyboard-arrow-up"
          size={20}
          color={theme.colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    dayHeader: {
      minHeight: DAY_MAP_PREVIEW_CONTEXT_HEADER_ESTIMATED_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    dayTitleBlock: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    eyebrow: {
      color: theme.colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
    },
    dayTitleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    dayTitle: {
      flexShrink: 1,
      color: theme.colors.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800",
    },
    dayMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    expandButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceSubtle,
    },
    expandButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
  });
}
