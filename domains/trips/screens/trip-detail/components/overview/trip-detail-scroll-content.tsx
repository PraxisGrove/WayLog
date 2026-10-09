import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { Trip } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { BackButton } from "@/shared/ui/back-button";
import type { createStyles } from "../../trip-detail.styles";
import { TripDetailOverviewContent } from "./trip-detail-overview-content";

type TripDetailScrollContentProps = {
  actionError?: string;
  bottomInset: number;
  dayTabsContent: ReactNode;
  error?: string;
  isDayRouteLoading: boolean;
  isDraggingSelectedDayItem: boolean;
  isLoading: boolean;
  isOverviewSelected: boolean;
  onBackPress: () => void;
  onOverviewPress: () => void;
  overviewProps?: ComponentProps<typeof TripDetailOverviewContent>;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  topInset: number;
  trip?: Trip | null;
};

export function TripDetailScrollContent({
  actionError,
  bottomInset,
  dayTabsContent,
  error,
  isDayRouteLoading,
  isDraggingSelectedDayItem,
  isLoading,
  isOverviewSelected,
  onBackPress,
  onOverviewPress,
  overviewProps,
  styles,
  theme,
  topInset,
  trip,
}: TripDetailScrollContentProps) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.overviewScrollContent,
        {
          paddingBottom: 32 + bottomInset,
          paddingTop: Math.max(20, topInset + 12),
        },
      ]}
      scrollEnabled={!isDraggingSelectedDayItem}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.overviewTripToolbar}>
        <BackButton
          accessibilityLabel="返回行程列表"
          onPress={onBackPress}
          style={styles.overviewBackButton}
        />
        <View style={styles.overviewTripToolbarCopy}>
          <Text style={styles.sectionTitle}>行程安排</Text>
        </View>
        {isDayRouteLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : null}
        {!isOverviewSelected && trip ? (
          <Pressable
            accessibilityHint="切换到行程总览页"
            accessibilityLabel="回到行程总览"
            accessibilityRole="button"
            onPress={onOverviewPress}
            style={({ pressed }) => [
              styles.overviewReturnButton,
              pressed && [
                styles.overviewReturnButtonPressed,
                { backgroundColor: theme.colors.primarySoft },
              ],
            ]}
          >
            <Text style={styles.overviewReturnText}>回到总览</Text>
          </Pressable>
        ) : null}
      </View>

      {actionError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{actionError}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={[styles.overviewBaseCard, styles.overviewLoadingCard]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.mutedText}>正在读取行程详情</Text>
        </View>
      ) : error || !trip ? (
        <View style={styles.overviewBaseCard}>
          <Text style={styles.overviewErrorTitle}>加载失败</Text>
          <Text style={styles.mutedText}>{error || "没有找到这趟行程"}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onBackPress}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>返回行程列表</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {dayTabsContent}

          <View style={styles.overviewContentStage}>
            {isOverviewSelected && overviewProps ? (
              <TripDetailOverviewContent {...overviewProps} />
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
