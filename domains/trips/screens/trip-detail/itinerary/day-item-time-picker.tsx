import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDayItemTime, getDayItemTimeParts } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ModalTransition } from "@/shared/ui/modal-transition";

type DayItemTimeButtonProps = {
  accessibilityLabel?: string;
  onPress: (event: GestureResponderEvent) => void;
  time?: string;
};

type DayItemTimeFieldProps = {
  accessibilityLabel?: string;
  onClear?: () => void;
  onPress: (event: GestureResponderEvent) => void;
  placeholder?: string;
  time?: string;
};

type DayItemTimePickerProps = {
  itemTitle?: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
  value?: string;
  visible: boolean;
};

type TimePickerColumnProps = {
  label: string;
  onSelect: (value: number) => void;
  selectedValue: number;
  theme: AppTheme;
  values: number[];
};

const TIME_PICKER_ITEM_HEIGHT = 44;
const TIME_PICKER_VISIBLE_ITEMS = 5;
const timePickerHours = Array.from({ length: 24 }, (_, index) => index);
const timePickerMinutes = Array.from({ length: 60 }, (_, index) => index);

export function DayItemTimeButton({
  accessibilityLabel,
  onPress,
  time,
}: DayItemTimeButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? "设置时间"}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.timeButton,
        pressed && { backgroundColor: theme.colors.primarySoft },
      ]}
    >
      <Text style={[styles.timeText, { color: theme.colors.primary }]}>
        {time ?? "--:--"}
      </Text>
    </Pressable>
  );
}

export function DayItemTimeField({
  accessibilityLabel,
  onClear,
  onPress,
  placeholder = "选择时间",
  time,
}: DayItemTimeFieldProps) {
  const theme = useAppTheme();
  const { colors, radius } = theme;

  return (
    <View
      style={[
        styles.timeField,
        {
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          borderRadius: radius.sm,
        },
      ]}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel ?? "设置时间"}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.timeFieldValueButton,
          pressed && { backgroundColor: colors.surfacePressed },
        ]}
      >
        <MaterialIcons
          name="schedule"
          size={18}
          color={time ? colors.primary : colors.textSubtle}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.timeFieldText,
            { color: colors.text },
            !time && { color: colors.textSubtle, fontWeight: "600" },
          ]}
        >
          {time ?? placeholder}
        </Text>
      </Pressable>
      {time && onClear ? (
        <Pressable
          accessibilityLabel="清除时间"
          accessibilityRole="button"
          hitSlop={4}
          onPress={onClear}
          style={({ pressed }) => [
            styles.timeFieldClearButton,
            { borderLeftColor: colors.border },
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <MaterialIcons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function DayItemTimePicker({
  itemTitle,
  onClose,
  onConfirm,
  value,
  visible,
}: DayItemTimePickerProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { colors, radius } = theme;
  const initialTimeParts = getDayItemTimeParts(value);
  const [hour, setHour] = useState(initialTimeParts.hour);
  const [minute, setMinute] = useState(initialTimeParts.minute);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextTimeParts = getDayItemTimeParts(value);
    setHour(nextTimeParts.hour);
    setMinute(nextTimeParts.minute);
  }, [value, visible]);

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭时间选择器"
      contentStyle={[
        styles.timePickerSheet,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingBottom: Math.max(insets.bottom, 16),
          shadowColor: colors.text,
        },
      ]}
      keyboardAvoiding
      onRequestClose={onClose}
      preset="sheet"
      rootStyle={styles.modalOverlay}
      visible={visible}
    >
      <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

      <View
        style={[styles.timePickerToolbar, { borderBottomColor: colors.border }]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.timePickerToolbarButton,
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <Text
            style={[styles.timePickerCancelText, { color: colors.textMuted }]}
          >
            取消
          </Text>
        </Pressable>
        <View style={styles.timePickerTitleBlock}>
          <Text style={[styles.timePickerToolbarTitle, { color: colors.text }]}>
            设置时间
          </Text>
          {itemTitle ? (
            <Text
              numberOfLines={1}
              style={[styles.timePickerPlaceTitle, { color: colors.textMuted }]}
            >
              {itemTitle}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onConfirm(formatDayItemTime(hour, minute))}
          style={({ pressed }) => [
            styles.timePickerToolbarButton,
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <Text style={[styles.timePickerSaveText, { color: colors.primary }]}>
            保存
          </Text>
        </Pressable>
      </View>

      <View style={styles.timePickerBody}>
        <View
          pointerEvents="none"
          style={[
            styles.timePickerSelectionBand,
            { backgroundColor: colors.surfaceMuted },
          ]}
        />
        <TimePickerColumn
          label="时"
          onSelect={setHour}
          selectedValue={hour}
          theme={theme}
          values={timePickerHours}
        />
        <Text style={[styles.timePickerColon, { color: colors.text }]}>:</Text>
        <TimePickerColumn
          label="分"
          onSelect={setMinute}
          selectedValue={minute}
          theme={theme}
          values={timePickerMinutes}
        />
      </View>
    </ModalTransition>
  );
}

function TimePickerColumn({
  label,
  onSelect,
  selectedValue,
  theme,
  values,
}: TimePickerColumnProps) {
  const { colors } = theme;
  const scrollRef = useRef<ScrollView | null>(null);
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  useEffect(() => {
    scrollRef.current?.scrollTo({
      y: selectedIndex * TIME_PICKER_ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  const selectValueAtOffset = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.min(
      values.length - 1,
      Math.max(
        0,
        Math.round(event.nativeEvent.contentOffset.y / TIME_PICKER_ITEM_HEIGHT),
      ),
    );
    const nextValue = values[nextIndex];

    if (nextValue !== selectedValue) {
      onSelect(nextValue);
    }

    scrollRef.current?.scrollTo({
      y: nextIndex * TIME_PICKER_ITEM_HEIGHT,
      animated: true,
    });
  };

  const selectValue = (nextValue: number, index: number) => {
    onSelect(nextValue);
    scrollRef.current?.scrollTo({
      y: index * TIME_PICKER_ITEM_HEIGHT,
      animated: true,
    });
  };

  return (
    <View style={styles.timePickerColumn}>
      <View style={styles.timePickerWheel}>
        <ScrollView
          contentContainerStyle={styles.timePickerWheelContent}
          decelerationRate="fast"
          onMomentumScrollEnd={selectValueAtOffset}
          onScrollEndDrag={selectValueAtOffset}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={TIME_PICKER_ITEM_HEIGHT}
        >
          {values.map((nextValue, index) => {
            const isSelected = nextValue === selectedValue;

            return (
              <Pressable
                accessibilityLabel={`${label}${nextValue.toString().padStart(2, "0")}`}
                accessibilityRole="button"
                key={nextValue}
                onPress={() => selectValue(nextValue, index)}
                style={[
                  styles.timePickerOption,
                  isSelected && styles.timePickerOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.timePickerOptionText,
                    { color: colors.textSubtle },
                    isSelected && [
                      styles.timePickerOptionTextSelected,
                      { color: colors.text },
                    ],
                  ]}
                >
                  {nextValue.toString().padStart(2, "0")}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Text
        pointerEvents="none"
        style={[styles.timePickerColumnLabel, { color: colors.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timeButton: {
    alignItems: "flex-end",
    justifyContent: "center",
    width: 82,
    minHeight: 62,
    flexShrink: 0,
    paddingRight: 10,
    borderRadius: 8,
  },
  timeText: {
    width: 62,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
  },
  timeField: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderWidth: 1,
  },
  timeFieldValueButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeFieldClearButton: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
  },
  timeFieldText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  timePickerSheet: {
    gap: 14,
    paddingTop: 8,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  timePickerToolbar: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  timePickerToolbarButton: {
    minWidth: 54,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  timePickerCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  timePickerSaveText: {
    fontSize: 16,
    fontWeight: "700",
  },
  timePickerTitleBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
  },
  timePickerToolbarTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  timePickerPlaceTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  timePickerBody: {
    minHeight: TIME_PICKER_ITEM_HEIGHT * TIME_PICKER_VISIBLE_ITEMS,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 18,
    paddingHorizontal: 10,
  },
  timePickerSelectionBand: {
    position: "absolute",
    left: 10,
    right: 10,
    top: TIME_PICKER_ITEM_HEIGHT * 2,
    height: TIME_PICKER_ITEM_HEIGHT,
    borderRadius: 8,
  },
  timePickerColumn: {
    flex: 1,
    height: TIME_PICKER_ITEM_HEIGHT * TIME_PICKER_VISIBLE_ITEMS,
  },
  timePickerColumnLabel: {
    position: "absolute",
    right: 18,
    top: TIME_PICKER_ITEM_HEIGHT * 2 + 11,
    zIndex: 2,
    fontSize: 15,
    fontWeight: "700",
  },
  timePickerWheel: {
    height: TIME_PICKER_ITEM_HEIGHT * TIME_PICKER_VISIBLE_ITEMS,
    overflow: "hidden",
  },
  timePickerWheelContent: {
    paddingVertical: TIME_PICKER_ITEM_HEIGHT * 2,
  },
  timePickerOption: {
    height: TIME_PICKER_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  timePickerOptionSelected: {
    zIndex: 1,
  },
  timePickerOptionText: {
    fontSize: 18,
    fontWeight: "600",
  },
  timePickerOptionTextSelected: {
    fontSize: 22,
    fontWeight: "700",
  },
  timePickerColon: {
    width: 20,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
});
