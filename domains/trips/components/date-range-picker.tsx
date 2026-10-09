import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  compareDateKeys,
  createDateKey,
  formatDateKeyForDisplay,
  getInclusiveDateRangeDays,
  parseDateKey,
} from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ModalTransition } from "@/shared/ui/modal-transition";

type DateRangeValue = {
  endDate?: string;
  startDate?: string;
};

type DateRangePickerProps = DateRangeValue & {
  onClear: () => void;
  onClose: () => void;
  onConfirm: (value: Required<DateRangeValue>) => void;
  visible: boolean;
};

type CalendarCell =
  | {
      dateKey: string;
      day: number;
      key: string;
      type: "day";
    }
  | {
      key: string;
      type: "placeholder";
    };

type MonthModel = {
  cells: CalendarCell[];
  key: string;
  title: string;
};

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

function createMonthModels(year: number): MonthModel[] {
  return Array.from({ length: 12 }, (_, month) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const placeholders: CalendarCell[] = Array.from(
      { length: firstWeekday },
      (_, index) => ({
        key: `${monthKey}-placeholder-${index}`,
        type: "placeholder",
      }),
    );
    const days: CalendarCell[] = Array.from(
      { length: daysInMonth },
      (_, index) => {
        const day = index + 1;
        const dateKey = createDateKey(new Date(year, month, day));

        return {
          dateKey,
          day,
          key: dateKey,
          type: "day",
        };
      },
    );

    return {
      cells: [...placeholders, ...days],
      key: monthKey,
      title: `${year} 年 ${month + 1} 月`,
    };
  });
}

function getYearFromDateKey(dateKey?: string): number | undefined {
  const parts = dateKey ? parseDateKey(dateKey) : null;
  return parts?.year;
}

function getMonthIndexFromDateKey(dateKey?: string): number | undefined {
  const parts = dateKey ? parseDateKey(dateKey) : null;
  return parts ? parts.month - 1 : undefined;
}

function getMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function formatCompactDateKey(dateKey: string): string {
  const parts = parseDateKey(dateKey);

  return parts
    ? `${parts.month} 月 ${parts.day} 日`
    : formatDateKeyForDisplay(dateKey);
}

function formatCondensedDateKey(dateKey: string): string {
  const parts = parseDateKey(dateKey);

  return parts
    ? `${parts.month}月${parts.day}日`
    : formatDateKeyForDisplay(dateKey);
}

function formatNumericDateKey(dateKey: string): string {
  const parts = parseDateKey(dateKey);

  return parts
    ? `${parts.month}/${parts.day}`
    : formatDateKeyForDisplay(dateKey);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function interpolate(
  minimum: number,
  maximum: number,
  progress: number,
): number {
  return minimum + (maximum - minimum) * progress;
}

function getInitialVisibleYear(
  startDate?: string,
  endDate?: string,
  todayKey = createDateKey(),
): number {
  return (
    getYearFromDateKey(startDate) ??
    getYearFromDateKey(endDate) ??
    getYearFromDateKey(todayKey) ??
    new Date().getFullYear()
  );
}

function getInitialVisibleMonth(
  startDate?: string,
  endDate?: string,
  todayKey = createDateKey(),
): number {
  return (
    getMonthIndexFromDateKey(startDate) ??
    getMonthIndexFromDateKey(endDate) ??
    getMonthIndexFromDateKey(todayKey) ??
    0
  );
}

function isDateInRange(
  dateKey: string,
  startDate?: string,
  endDate?: string,
): boolean {
  if (!startDate || !endDate) {
    return false;
  }

  return (
    compareDateKeys(dateKey, startDate) > 0 &&
    compareDateKeys(dateKey, endDate) < 0
  );
}

export function DateRangePicker({
  endDate,
  onClear,
  onClose,
  onConfirm,
  startDate,
  visible,
}: DateRangePickerProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const theme = useAppTheme();
  const { colors, radius, shadow } = theme;
  const calendarContentWidth = Math.max(0, Math.min(windowWidth, 620) - 40);
  const rangeEndpointInset = Math.max(0, (calendarContentWidth / 7 - 44) / 2);
  const footerMetrics = useMemo(() => {
    const availableWidth = Math.max(0, Math.min(windowWidth, 620) - 40);
    const progress = clamp((availableWidth - 280) / 300, 0, 1);
    const gap = interpolate(6, 8, progress);
    const clearButtonSize = interpolate(38, 44, progress);
    const confirmButtonWidth = clamp(availableWidth * 0.29, 96, 126);

    return {
      clearButtonSize,
      clearIconSize: interpolate(18, 20, progress),
      confirmButtonHeight: interpolate(44, 48, progress),
      confirmButtonWidth,
      confirmFontSize: interpolate(14, 16, progress),
      confirmPadding: interpolate(14, 18, progress),
      estimatedSummaryWidth:
        availableWidth - clearButtonSize - confirmButtonWidth - gap * 2,
      footerGap: gap,
    };
  }, [windowWidth]);
  const [footerSummaryWidth, setFooterSummaryWidth] = useState(0);
  const summaryMetrics = useMemo(() => {
    const width = footerSummaryWidth || footerMetrics.estimatedSummaryWidth;
    const progress = clamp((width - 140) / 250, 0, 1);

    return {
      arrowIconSize: interpolate(13, 18, progress),
      badgeFontSize: interpolate(10, 13, progress),
      badgeHeight: interpolate(22, 28, progress),
      badgePadding: interpolate(5, 9, progress),
      dateFontSize: interpolate(11, 14, progress),
      dateLineHeight: interpolate(15, 19, progress),
      iconSize: interpolate(15, 22, progress),
      labelFontSize: interpolate(10, 13, progress),
      labelLineHeight: interpolate(14, 17, progress),
      dateFormat:
        width < 260 ? "numeric" : width < 360 ? "condensed" : "spaced",
      showIcons: width >= 220,
      showLabels: width >= 270,
      summaryGap: interpolate(3, 8, progress),
      summaryHeight: interpolate(44, 52, progress),
      summaryPadding: interpolate(8, 14, progress),
    };
  }, [footerMetrics.estimatedSummaryWidth, footerSummaryWidth]);
  const isCompactFooter = summaryMetrics.dateFormat === "numeric";
  const [todayKey, setTodayKey] = useState(createDateKey);
  const scrollViewRef = useRef<ScrollView>(null);
  const dayGridOffsetsRef = useRef<Record<string, number>>({});
  const dayLayoutsRef = useRef<Record<string, { height: number; y: number }>>(
    {},
  );
  const monthOffsetsRef = useRef<Record<string, number>>({});
  const [_monthLayoutVersion, setMonthLayoutVersion] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const scrollToMonthRef = useRef<
    (monthKey: string, animated?: boolean, dateKey?: string) => void
  >(() => {});
  const [targetDateKey, setTargetDateKey] = useState<string | undefined>(
    () => startDate ?? endDate ?? todayKey,
  );
  const [targetMonthIndex, setTargetMonthIndex] = useState(() =>
    getInitialVisibleMonth(startDate, endDate, todayKey),
  );
  const [visibleYear, setVisibleYear] = useState(() =>
    getInitialVisibleYear(startDate, endDate, todayKey),
  );
  const months = useMemo(() => createMonthModels(visibleYear), [visibleYear]);
  const [draftStartDate, setDraftStartDate] = useState<string | undefined>(
    startDate,
  );
  const [draftEndDate, setDraftEndDate] = useState<string | undefined>(endDate);
  const targetMonthKey = useMemo(
    () => getMonthKey(visibleYear, targetMonthIndex),
    [targetMonthIndex, visibleYear],
  );
  const confirmEndDate = draftEndDate ?? draftStartDate;
  const selectionHint =
    draftStartDate && !draftEndDate
      ? "再次点击日期可选择结束日，直接确定就是单日行程"
      : "选择后会自动同步行程天数";
  const startDateLabel = draftStartDate
    ? formatCompactDateKey(draftStartDate)
    : "选择出发日期";
  const endDateLabel = draftEndDate
    ? formatCompactDateKey(draftEndDate)
    : draftStartDate
      ? "待选择，可保存为单日"
      : "选择返程日期";
  const dayCount =
    draftStartDate && confirmEndDate
      ? getInclusiveDateRangeDays(draftStartDate, confirmEndDate)
      : undefined;
  const dayCountLabel = dayCount
    ? `${dayCount}${isCompactFooter ? "" : " "}天`
    : "未定";
  const footerStartDateLabel = draftStartDate
    ? summaryMetrics.dateFormat === "numeric"
      ? formatNumericDateKey(draftStartDate)
      : summaryMetrics.dateFormat === "condensed"
        ? formatCondensedDateKey(draftStartDate)
        : startDateLabel
    : isCompactFooter
      ? "出发"
      : startDateLabel;
  const footerEndDateLabel = draftEndDate
    ? summaryMetrics.dateFormat === "numeric"
      ? formatNumericDateKey(draftEndDate)
      : summaryMetrics.dateFormat === "condensed"
        ? formatCondensedDateKey(draftEndDate)
        : endDateLabel
    : isCompactFooter
      ? "返程"
      : endDateLabel;

  useEffect(() => {
    if (visible) {
      const nextTodayKey = createDateKey();

      setTodayKey(nextTodayKey);
      setDraftStartDate(startDate);
      setDraftEndDate(endDate);
      setTargetDateKey(startDate ?? endDate ?? nextTodayKey);
      setTargetMonthIndex(
        getInitialVisibleMonth(startDate, endDate, nextTodayKey),
      );
      setVisibleYear(getInitialVisibleYear(startDate, endDate, nextTodayKey));
    }
  }, [endDate, startDate, visible]);

  const scrollToMonth = useCallback(
    (monthKey: string, animated = false, dateKey?: string) => {
      const monthOffset = monthOffsetsRef.current[monthKey];

      if (monthOffset === undefined) {
        return;
      }

      const gridOffset = dayGridOffsetsRef.current[monthKey];
      const dayLayout = dateKey ? dayLayoutsRef.current[dateKey] : undefined;
      let targetOffset = monthOffset - 8;

      if (gridOffset !== undefined && dayLayout && scrollViewHeight > 0) {
        const dayTopOffset = monthOffset + gridOffset + dayLayout.y;
        const dayBottomOffset = dayTopOffset + dayLayout.height;
        const visibleBottomOffset = targetOffset + scrollViewHeight - 16;

        if (dayBottomOffset > visibleBottomOffset) {
          targetOffset = dayBottomOffset - scrollViewHeight + 16;
        } else if (dayTopOffset < targetOffset) {
          targetOffset = dayTopOffset - 16;
        }
      }

      scrollViewRef.current?.scrollTo({
        y: Math.max(targetOffset, 0),
        animated,
      });
    },
    [scrollViewHeight],
  );

  scrollToMonthRef.current = scrollToMonth;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timeoutId = setTimeout(
      () => scrollToMonthRef.current(targetMonthKey, false, targetDateKey),
      0,
    );

    return () => clearTimeout(timeoutId);
  }, [targetDateKey, targetMonthKey, visible]);

  const recordMonthLayout = useCallback(
    (monthKey: string, offsetY: number) => {
      if (monthOffsetsRef.current[monthKey] === offsetY) {
        return;
      }

      monthOffsetsRef.current[monthKey] = offsetY;
      if (monthKey === targetMonthKey) {
        setMonthLayoutVersion((version) => version + 1);
      }
    },
    [targetMonthKey],
  );

  const recordDayGridLayout = useCallback(
    (monthKey: string, offsetY: number) => {
      if (dayGridOffsetsRef.current[monthKey] === offsetY) {
        return;
      }

      dayGridOffsetsRef.current[monthKey] = offsetY;
      if (monthKey === targetMonthKey) {
        setMonthLayoutVersion((version) => version + 1);
      }
    },
    [targetMonthKey],
  );

  const recordDayLayout = useCallback(
    (dateKey: string, offsetY: number, height: number) => {
      const previousLayout = dayLayoutsRef.current[dateKey];

      if (previousLayout?.y === offsetY && previousLayout.height === height) {
        return;
      }

      dayLayoutsRef.current[dateKey] = { height, y: offsetY };
      if (dateKey === targetDateKey) {
        setMonthLayoutVersion((version) => version + 1);
      }
    },
    [targetDateKey],
  );

  const handleDatePress = (dateKey: string) => {
    if (!draftStartDate || draftEndDate) {
      setDraftStartDate(dateKey);
      setDraftEndDate(undefined);
      return;
    }

    if (compareDateKeys(dateKey, draftStartDate) < 0) {
      setDraftStartDate(dateKey);
      setDraftEndDate(undefined);
      return;
    }

    setDraftEndDate(dateKey);
  };

  const handleConfirm = () => {
    if (!draftStartDate) {
      return;
    }

    onConfirm({
      startDate: draftStartDate,
      endDate: draftEndDate ?? draftStartDate,
    });
  };

  const handleClear = () => {
    setDraftStartDate(undefined);
    setDraftEndDate(undefined);
    onClear();
  };

  const jumpToToday = () => {
    const nextTodayKey = createDateKey();
    const nextCurrentYear =
      getYearFromDateKey(nextTodayKey) ?? new Date().getFullYear();
    const nextCurrentMonthIndex = getMonthIndexFromDateKey(nextTodayKey) ?? 0;

    setTodayKey(nextTodayKey);
    setTargetDateKey(nextTodayKey);
    setTargetMonthIndex(nextCurrentMonthIndex);
    setVisibleYear(nextCurrentYear);

    if (visibleYear === nextCurrentYear) {
      setTimeout(
        () =>
          scrollToMonth(
            getMonthKey(nextCurrentYear, nextCurrentMonthIndex),
            true,
            nextTodayKey,
          ),
        0,
      );
    }
  };

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭日期选择"
      contentStyle={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingBottom: Math.max(insets.bottom, 16),
          ...shadow.sheet,
        },
      ]}
      onRequestClose={onClose}
      overlayColor={colors.overlay}
      preset="sheet"
      rootStyle={styles.modalRoot}
      visible={visible}
    >
      <View
        style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]}
      />
      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitleCopy}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            你想去多久？
          </Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
            {selectionHint}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="关闭"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceMuted },
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <MaterialIcons name="close" size={21} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.yearPager}>
        <Pressable
          accessibilityLabel="上一年"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            setTargetDateKey(undefined);
            setTargetMonthIndex(0);
            setVisibleYear((year) => year - 1);
          }}
          style={({ pressed }) => [
            styles.yearIconButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && { backgroundColor: colors.surfacePressed },
          ]}
        >
          <MaterialIcons
            name="chevron-left"
            size={23}
            color={colors.textMuted}
          />
        </Pressable>
        <Text style={[styles.yearTitle, { color: colors.text }]}>
          {visibleYear} 年
        </Text>
        <View style={styles.yearActions}>
          <Pressable
            accessibilityRole="button"
            onPress={jumpToToday}
            style={({ pressed }) => [
              styles.currentYearButton,
              { backgroundColor: colors.primarySoft },
              pressed && { backgroundColor: colors.surfacePressed },
            ]}
          >
            <MaterialIcons name="near-me" size={15} color={colors.primary} />
            <Text
              style={[styles.currentYearButtonText, { color: colors.primary }]}
            >
              今天
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="下一年"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setTargetDateKey(undefined);
              setTargetMonthIndex(0);
              setVisibleYear((year) => year + 1);
            }}
            style={({ pressed }) => [
              styles.yearIconButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
              pressed && { backgroundColor: colors.surfacePressed },
            ]}
          >
            <MaterialIcons
              name="chevron-right"
              size={23}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      <View style={[styles.weekRow, { borderBottomColor: colors.border }]}>
        {weekDays.map((weekday) => (
          <Text
            key={weekday}
            style={[styles.weekdayText, { color: colors.textMuted }]}
          >
            {weekday}
          </Text>
        ))}
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.monthList}
        onLayout={(event) =>
          setScrollViewHeight(event.nativeEvent.layout.height)
        }
        showsVerticalScrollIndicator={false}
      >
        {months.map((month) => (
          <View
            key={month.key}
            onLayout={(event) =>
              recordMonthLayout(month.key, event.nativeEvent.layout.y)
            }
            style={styles.monthBlock}
          >
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {month.title}
            </Text>
            <View
              onLayout={(event) =>
                recordDayGridLayout(month.key, event.nativeEvent.layout.y)
              }
              style={styles.dayGrid}
            >
              {month.cells.map((cell, cellIndex) => {
                if (cell.type === "placeholder") {
                  return <View key={cell.key} style={styles.dayCell} />;
                }

                const isStart = cell.dateKey === draftStartDate;
                const isEnd = cell.dateKey === draftEndDate;
                const isSingleDay =
                  isStart && confirmEndDate === draftStartDate;
                const isInRange = isDateInRange(
                  cell.dateKey,
                  draftStartDate,
                  confirmEndDate,
                );
                const isSelected = isStart || isEnd || isSingleDay;
                const isRangeSelected = isSelected || isInRange;
                const isPast = compareDateKeys(cell.dateKey, todayKey) < 0;
                const isToday = cell.dateKey === todayKey;
                const hasRange = Boolean(draftStartDate && draftEndDate);
                const isRangeTrackVisible =
                  hasRange && (isStart || isEnd || isInRange);
                const isRowStart = cellIndex % 7 === 0;
                const isRowEnd = cellIndex % 7 === 6;

                return (
                  <Pressable
                    accessibilityLabel={
                      isPast
                        ? `过去日期 ${cell.dateKey}`
                        : `选择 ${cell.dateKey}`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={cell.key}
                    onLayout={(event) =>
                      recordDayLayout(
                        cell.dateKey,
                        event.nativeEvent.layout.y,
                        event.nativeEvent.layout.height,
                      )
                    }
                    onPress={() => handleDatePress(cell.dateKey)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      pressed && { opacity: 0.72 },
                    ]}
                  >
                    {isRangeTrackVisible ? (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.rangeTrack,
                          { backgroundColor: colors.primary },
                          isStart && [
                            styles.rangeTrackStart,
                            { left: rangeEndpointInset },
                          ],
                          isEnd && [
                            styles.rangeTrackEnd,
                            { right: rangeEndpointInset },
                          ],
                          isRowStart && styles.rangeTrackRowStart,
                          isRowEnd && styles.rangeTrackRowEnd,
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.dayCircle,
                        isToday && !isRangeSelected
                          ? {
                              backgroundColor: colors.primarySoft,
                              borderColor: colors.primary,
                            }
                          : null,
                        isSelected && !isRangeTrackVisible
                          ? { backgroundColor: colors.primary }
                          : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          { color: colors.text },
                          isPast && !isRangeSelected
                            ? { color: colors.textSubtle }
                            : null,
                          isRangeSelected ? { color: colors.onPrimary } : null,
                          isToday && !isRangeSelected
                            ? { color: colors.primary }
                            : null,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {isStart ? (
                        <Text
                          style={[styles.dayTag, { color: colors.onPrimary }]}
                        >
                          {isSingleDay ? "单日" : "出发"}
                        </Text>
                      ) : null}
                      {isEnd && !isSingleDay ? (
                        <Text
                          style={[styles.dayTag, { color: colors.onPrimary }]}
                        >
                          返程
                        </Text>
                      ) : null}
                      {isToday && !isRangeSelected ? (
                        <Text
                          style={[styles.todayTag, { color: colors.primary }]}
                        >
                          今
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            gap: footerMetrics.footerGap,
          },
        ]}
      >
        <View
          onLayout={(event) =>
            setFooterSummaryWidth(event.nativeEvent.layout.width)
          }
          style={[
            styles.footerSummary,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radius.pill,
              gap: summaryMetrics.summaryGap,
              minHeight: summaryMetrics.summaryHeight,
              paddingHorizontal: summaryMetrics.summaryPadding,
            },
          ]}
        >
          <View style={styles.footerDateStop}>
            {summaryMetrics.showIcons ? (
              <MaterialIcons
                name="flight-takeoff"
                size={summaryMetrics.iconSize}
                color={colors.primary}
              />
            ) : null}
            {summaryMetrics.showLabels ? (
              <Text
                style={[
                  styles.footerDateLabel,
                  {
                    color: colors.textMuted,
                    fontSize: summaryMetrics.labelFontSize,
                    lineHeight: summaryMetrics.labelLineHeight,
                  },
                ]}
              >
                出发
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                styles.footerDateText,
                {
                  color: colors.text,
                  fontSize: summaryMetrics.dateFontSize,
                  lineHeight: summaryMetrics.dateLineHeight,
                },
              ]}
            >
              {footerStartDateLabel}
            </Text>
          </View>
          <MaterialIcons
            name="arrow-forward"
            size={summaryMetrics.arrowIconSize}
            color={colors.textSubtle}
          />
          <View style={styles.footerDateStop}>
            {summaryMetrics.showIcons ? (
              <MaterialIcons
                name="flight-land"
                size={summaryMetrics.iconSize}
                color={colors.primary}
              />
            ) : null}
            {summaryMetrics.showLabels ? (
              <Text
                style={[
                  styles.footerDateLabel,
                  {
                    color: colors.textMuted,
                    fontSize: summaryMetrics.labelFontSize,
                    lineHeight: summaryMetrics.labelLineHeight,
                  },
                ]}
              >
                返程
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                styles.footerDateText,
                {
                  color: draftEndDate ? colors.text : colors.textSubtle,
                  fontSize: summaryMetrics.dateFontSize,
                  lineHeight: summaryMetrics.dateLineHeight,
                },
              ]}
            >
              {footerEndDateLabel}
            </Text>
          </View>
          <View
            style={[
              styles.dayCountBadge,
              {
                backgroundColor: colors.primarySoft,
                borderRadius: summaryMetrics.badgeHeight / 2,
                minHeight: summaryMetrics.badgeHeight,
                paddingHorizontal: summaryMetrics.badgePadding,
              },
            ]}
          >
            <Text
              style={[
                styles.dayCountText,
                {
                  color: colors.primary,
                  fontSize: summaryMetrics.badgeFontSize,
                },
              ]}
            >
              {dayCountLabel}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="清除日期"
          accessibilityRole="button"
          disabled={!draftStartDate}
          hitSlop={6}
          onPress={handleClear}
          style={({ pressed }) => [
            styles.clearButton,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: footerMetrics.clearButtonSize / 2,
              height: footerMetrics.clearButtonSize,
              width: footerMetrics.clearButtonSize,
            },
            pressed && draftStartDate
              ? { backgroundColor: colors.surfacePressed }
              : null,
          ]}
        >
          <MaterialIcons
            name="close"
            size={footerMetrics.clearIconSize}
            color={draftStartDate ? colors.textMuted : colors.textSubtle}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!draftStartDate}
          onPress={handleConfirm}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              backgroundColor: draftStartDate
                ? colors.primary
                : colors.surfaceSubtle,
              borderRadius: radius.pill,
              minHeight: footerMetrics.confirmButtonHeight,
              minWidth: footerMetrics.confirmButtonWidth,
              paddingHorizontal: footerMetrics.confirmPadding,
            },
            pressed && draftStartDate
              ? { backgroundColor: colors.primaryPressed }
              : null,
          ]}
        >
          <Text
            style={[
              styles.confirmButtonText,
              {
                color: draftStartDate ? colors.onPrimary : colors.textSubtle,
                fontSize: footerMetrics.confirmFontSize,
              },
            ]}
          >
            保存日期
          </Text>
        </Pressable>
      </View>
    </ModalTransition>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 620,
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 16,
    paddingTop: 18,
  },
  sheetTitleCopy: {
    flex: 1,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  yearPager: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 10,
  },
  yearIconButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  yearTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "left",
  },
  yearActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentYearButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 19,
  },
  currentYearButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  weekRow: {
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  monthList: {
    gap: 24,
    paddingBottom: 20,
    paddingTop: 16,
  },
  monthBlock: {
    gap: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rangeTrack: {
    position: "absolute",
    top: 4,
    right: 0,
    bottom: 4,
    left: 0,
  },
  rangeTrackStart: {
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  rangeTrackEnd: {
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
  },
  rangeTrackRowStart: {
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  rangeTrackRowEnd: {
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
  },
  dayCircle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },
  dayTag: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 10,
  },
  todayTag: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  footerDateStop: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerDateLabel: {
    flexShrink: 0,
    fontWeight: "800",
  },
  footerDateText: {
    flexShrink: 1,
    minWidth: 0,
    fontWeight: "800",
  },
  dayCountBadge: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCountText: {
    fontWeight: "800",
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  confirmButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    fontWeight: "800",
  },
});
