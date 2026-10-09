import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Modal, Pressable, Text, View } from "react-native";
import {
  formatRouteModeMetric,
  getTripRouteModeLabel,
  isRouteModePending,
  type TripDayRouteSegment,
  type TripRouteMode,
  type TripRoutePreference,
  type TripRouteSegmentResult,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { routeModeIconMap, routePreferredModeOptions } from "../route-options";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type RouteDialogsProps = {
  activeRouteSegment?: TripDayRouteSegment;
  activeRouteSegmentMode: TripRouteMode;
  activeRouteSegmentResult?: TripRouteSegmentResult;
  activeRouteUserMessage?: string;
  closeRoutePreferenceEditor: () => void;
  closeRouteSegmentActions: () => void;
  isActiveRouteSegmentModePending: boolean;
  isEditingRoutePreference: boolean;
  routeModePendingCounts: Record<string, number>;
  routeModePendingIntents: Record<string, boolean>;
  routeNavigationError: string;
  routePreference: TripRoutePreference;
  routePreferenceError: string;
  selectRouteSegmentMode: (segmentId: string, mode: TripRouteMode) => void;
  startActiveRouteNavigation: () => void | Promise<void>;
  openRoutePreferenceEditor: () => void;
  styles: TripDetailStyles;
  theme: AppTheme;
  updateRoutePreference: (nextPreference: TripRoutePreference) => void;
};

export function RouteDialogs({
  activeRouteSegment,
  activeRouteSegmentMode,
  activeRouteSegmentResult,
  activeRouteUserMessage,
  closeRoutePreferenceEditor,
  closeRouteSegmentActions,
  isActiveRouteSegmentModePending,
  isEditingRoutePreference,
  routeModePendingCounts,
  routeModePendingIntents,
  routeNavigationError,
  routePreference,
  routePreferenceError,
  selectRouteSegmentMode,
  startActiveRouteNavigation,
  openRoutePreferenceEditor,
  styles,
  theme,
  updateRoutePreference,
}: RouteDialogsProps) {
  return (
    <>
      <Modal
        animationType="fade"
        onRequestClose={closeRouteSegmentActions}
        transparent
        visible={Boolean(activeRouteSegment) && !isEditingRoutePreference}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            onPress={closeRouteSegmentActions}
            style={styles.modalBackdrop}
          />
          {activeRouteSegment ? (
            <View style={styles.routeActionSheet}>
              <View style={styles.sheetGrabber} />
              <View style={styles.routeSheetHeader}>
                <View style={styles.routeSheetTitleRow}>
                  <Text
                    style={[
                      styles.routeSheetTitle,
                      { color: theme.colors.text },
                    ]}
                  >
                    交通信息
                  </Text>
                  <Pressable
                    accessibilityLabel="交通偏好"
                    accessibilityRole="button"
                    onPress={openRoutePreferenceEditor}
                    style={({ pressed }) => [
                      styles.routePreferenceChip,
                      pressed && [
                        styles.routePreferenceChipPressed,
                        { backgroundColor: theme.colors.surfaceSubtle },
                      ],
                    ]}
                  >
                    <MaterialIcons
                      name="tune"
                      size={15}
                      color={theme.colors.textMuted}
                    />
                    <Text style={styles.routePreferenceText}>偏好</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityLabel="关闭交通信息"
                  accessibilityRole="button"
                  onPress={closeRouteSegmentActions}
                  style={({ pressed }) => [
                    styles.routeSheetCloseButton,
                    pressed && styles.routeSheetCloseButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="check"
                    size={24}
                    color={theme.colors.text}
                  />
                </Pressable>
              </View>

              <View style={styles.routeEndpointsPanel}>
                <View style={styles.routeEndpointRail}>
                  <View style={styles.routeEndpointDot} />
                  <View style={styles.routeEndpointLine} />
                  <View
                    style={[
                      styles.routeEndpointDot,
                      styles.routeEndpointDotEnd,
                    ]}
                  />
                </View>
                <View style={styles.routeEndpointCopy}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.routeEndpointText,
                      { color: theme.colors.text },
                    ]}
                  >
                    {activeRouteSegment.snapshot.fromLabel}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.routeEndpointText,
                      { color: theme.colors.text },
                    ]}
                  >
                    {activeRouteSegment.snapshot.toLabel}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.routeModeSectionTitle,
                  { color: theme.colors.text },
                ]}
              >
                选择交通方式
              </Text>
              <View style={styles.routeModeList}>
                {(
                  [
                    "walking",
                    "cycling",
                    "transit",
                    "driving",
                  ] as TripRouteMode[]
                ).map((mode) => {
                  const option =
                    activeRouteSegmentResult?.entry.modeOptions.find(
                      (item) => item.mode === mode,
                    );
                  const isSelected = activeRouteSegmentMode === mode;
                  const isPending = isRouteModePending(
                    routeModePendingCounts,
                    routeModePendingIntents,
                    activeRouteSegment.id,
                    mode,
                  );

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={mode}
                      onPress={() =>
                        selectRouteSegmentMode(activeRouteSegment.id, mode)
                      }
                      style={({ pressed }) => [
                        styles.routeModeOption,
                        isSelected && styles.routeModeOptionSelected,
                        pressed && styles.routeModeOptionPressed,
                        pressed && {
                          backgroundColor: theme.colors.surfaceSubtle,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={routeModeIconMap[mode]}
                        size={24}
                        color={
                          isSelected
                            ? theme.colors.text
                            : theme.colors.textSubtle
                        }
                      />
                      <Text
                        style={[
                          styles.routeModeLabel,
                          isSelected && styles.routeModeLabelSelected,
                          isSelected && { color: theme.colors.text },
                        ]}
                      >
                        {getTripRouteModeLabel(mode)}
                      </Text>
                      <Text
                        style={[
                          styles.routeModeMetric,
                          { color: theme.colors.textMuted },
                          isSelected && styles.routeModeMetricSelected,
                          isSelected && { color: theme.colors.text },
                        ]}
                      >
                        {formatRouteModeMetric(option, isSelected, isPending)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {routeNavigationError ? (
                <View style={styles.routeSheetError}>
                  <Text style={styles.inlineErrorText}>
                    {routeNavigationError}
                  </Text>
                </View>
              ) : null}

              {!routeNavigationError && activeRouteUserMessage ? (
                <View
                  style={
                    isActiveRouteSegmentModePending
                      ? styles.routeSheetNotice
                      : styles.routeSheetError
                  }
                >
                  <Text
                    style={
                      isActiveRouteSegmentModePending
                        ? styles.routeSheetNoticeText
                        : styles.inlineErrorText
                    }
                  >
                    {activeRouteUserMessage}
                  </Text>
                </View>
              ) : null}

              <View style={styles.routeSheetFooter}>
                <View style={styles.routeDepartCopy}>
                  <Text
                    style={[
                      styles.routeDepartLabel,
                      { color: theme.colors.textSubtle },
                    ]}
                  >
                    现在出发
                  </Text>
                  <Text
                    style={[
                      styles.routeDepartTime,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {new Date().toTimeString().slice(0, 5)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void startActiveRouteNavigation();
                  }}
                  style={({ pressed }) => [
                    styles.routePrimaryButton,
                    pressed && styles.routePrimaryButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="near-me"
                    size={21}
                    color={theme.colors.onPrimary}
                  />
                  <Text
                    style={[
                      styles.routePrimaryButtonText,
                      { color: theme.colors.onPrimary },
                    ]}
                  >
                    {getTripRouteModeLabel(activeRouteSegmentMode)}导航
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeRoutePreferenceEditor}
        transparent
        visible={Boolean(activeRouteSegment) && isEditingRoutePreference}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            onPress={closeRoutePreferenceEditor}
            style={styles.modalBackdrop}
          />
          <View style={styles.routeActionSheet}>
            <View style={styles.sheetGrabber} />
            <View style={styles.routeSheetHeader}>
              <View style={styles.routeSheetTitleRow}>
                <Text
                  style={[styles.routeSheetTitle, { color: theme.colors.text }]}
                >
                  交通偏好
                </Text>
              </View>
              <Pressable
                accessibilityLabel="完成交通偏好设置"
                accessibilityRole="button"
                onPress={closeRoutePreferenceEditor}
                style={({ pressed }) => [
                  styles.routeSheetCloseButton,
                  pressed && styles.routeSheetCloseButtonPressed,
                ]}
              >
                <MaterialIcons
                  name="check"
                  size={24}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>

            <Text
              style={[
                styles.routeModeSectionTitle,
                { color: theme.colors.text },
              ]}
            >
              默认方式
            </Text>
            <View style={styles.routePreferenceModeGrid}>
              {routePreferredModeOptions.map((option) => {
                const isSelected =
                  routePreference.preferredMode === option.value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() =>
                      updateRoutePreference({
                        ...routePreference,
                        preferredMode: option.value,
                      })
                    }
                    style={({ pressed }) => [
                      styles.routePreferenceModeOption,
                      isSelected && styles.routePreferenceModeOptionSelected,
                      pressed && [
                        styles.routePreferenceModeOptionPressed,
                        { backgroundColor: theme.colors.surfaceSubtle },
                      ],
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={20}
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.routePreferenceModeText,
                        isSelected && styles.routePreferenceModeTextSelected,
                        isSelected && { color: theme.colors.primary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.routeModeSectionTitle,
                { color: theme.colors.text },
              ]}
            >
              估算路线
            </Text>
            <View style={styles.routePreferenceToggleGroup}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  updateRoutePreference({
                    ...routePreference,
                    allowEstimatedRoutes: true,
                  })
                }
                style={({ pressed }) => [
                  styles.routePreferenceToggle,
                  routePreference.allowEstimatedRoutes &&
                    styles.routePreferenceToggleSelected,
                  pressed && [
                    styles.routePreferenceModeOptionPressed,
                    { backgroundColor: theme.colors.surfaceSubtle },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.routePreferenceToggleText,
                    routePreference.allowEstimatedRoutes &&
                      styles.routePreferenceModeTextSelected,
                    routePreference.allowEstimatedRoutes && {
                      color: theme.colors.primary,
                    },
                  ]}
                >
                  允许
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  updateRoutePreference({
                    ...routePreference,
                    allowEstimatedRoutes: false,
                  })
                }
                style={({ pressed }) => [
                  styles.routePreferenceToggle,
                  !routePreference.allowEstimatedRoutes &&
                    styles.routePreferenceToggleSelected,
                  pressed && [
                    styles.routePreferenceModeOptionPressed,
                    { backgroundColor: theme.colors.surfaceSubtle },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.routePreferenceToggleText,
                    !routePreference.allowEstimatedRoutes &&
                      styles.routePreferenceModeTextSelected,
                    !routePreference.allowEstimatedRoutes && {
                      color: theme.colors.primary,
                    },
                  ]}
                >
                  避免
                </Text>
              </Pressable>
            </View>

            {routePreferenceError ? (
              <View style={styles.routeSheetError}>
                <Text style={styles.inlineErrorText}>
                  {routePreferenceError}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
