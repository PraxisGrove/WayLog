import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  formatDayTabDate,
  formatExpenseAmount,
  formatExpenseEntryMeta,
  formatExpenseEntryNote,
  type Trip,
  type TripDay,
  type TripExpenseCategory,
  type TripExpenseEntry,
  type TripExpenseSummary,
  tripExpenseCategoryIcons,
} from "@/features/trips";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type ExpenseLedgerDay = {
  day: TripDay;
  entries: TripExpenseEntry[];
  totalAmount: number;
};

type ExpenseLedgerSheetProps = {
  activeExpenseCategoryFilter?: TripExpenseCategory;
  closeExpenseLedger: () => void;
  expandedExpenseDayIds: Record<string, boolean>;
  expenseBudgetProgress?: number;
  expenseBudgetStatusText: string;
  expenseLedgerDays: ExpenseLedgerDay[];
  expenseLedgerModalAnim: Animated.Value;
  expenseSummary?: TripExpenseSummary;
  filteredExpenseEntries: TripExpenseEntry[];
  isExpenseLedgerOpen: boolean;
  openBudgetInput: () => void;
  openExpenseEntry: (entry: TripExpenseEntry) => void;
  openExpenseInput: () => void;
  setActiveExpenseCategoryFilter: (
    category: TripExpenseCategory | undefined,
  ) => void;
  styles: TripDetailStyles;
  toggleExpenseCategoryFilter: (category: TripExpenseCategory) => void;
  toggleExpenseDay: (dayId: string) => void;
  trip: Trip | null;
  tripTotalCost: number;
  unassignedExpenseEntries: TripExpenseEntry[];
  unassignedExpenseTotal: number;
};

export function ExpenseLedgerSheet({
  activeExpenseCategoryFilter,
  closeExpenseLedger,
  expandedExpenseDayIds,
  expenseBudgetProgress,
  expenseBudgetStatusText,
  expenseLedgerDays,
  expenseLedgerModalAnim,
  expenseSummary,
  filteredExpenseEntries,
  isExpenseLedgerOpen,
  openBudgetInput,
  openExpenseEntry,
  openExpenseInput,
  setActiveExpenseCategoryFilter,
  styles,
  toggleExpenseCategoryFilter,
  toggleExpenseDay,
  trip,
  tripTotalCost,
  unassignedExpenseEntries,
  unassignedExpenseTotal,
}: ExpenseLedgerSheetProps) {
  return (
    <Modal
      animationType="none"
      onRequestClose={closeExpenseLedger}
      transparent
      visible={isExpenseLedgerOpen}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.animatedModalBackdrop,
            {
              opacity: expenseLedgerModalAnim,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={closeExpenseLedger}
            style={styles.modalBackdrop}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.expenseLedgerModal,
            {
              opacity: expenseLedgerModalAnim,
              transform: [
                {
                  translateY: expenseLedgerModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
                {
                  scale: expenseLedgerModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.expenseLedgerModalHeader}>
            <View style={styles.expenseLedgerModalTitleWrap}>
              <View style={styles.expenseLedgerTitleRow}>
                <Text style={styles.expenseLedgerModalEyebrow}>LEDGER</Text>
                <Text style={styles.expenseLedgerModalMeta}>
                  {expenseSummary?.recordedCount ?? 0} 条记录
                </Text>
              </View>
              <View style={styles.expenseLedgerHeadingLine}>
                <Text style={styles.expenseLedgerModalTitle}>旅行账本</Text>
                <View style={styles.expenseLedgerBalancePill}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.expenseLedgerBalanceText,
                      expenseSummary?.remainingAmount !== undefined &&
                      expenseSummary.remainingAmount < 0
                        ? styles.expenseLedgerBalanceTextOver
                        : null,
                    ]}
                  >
                    {expenseBudgetStatusText}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              accessibilityLabel="关闭旅行账本"
              accessibilityRole="button"
              onPress={closeExpenseLedger}
              style={({ pressed }) => [
                styles.expenseLedgerIconButton,
                pressed && styles.expenseLedgerIconButtonPressed,
              ]}
            >
              <MaterialIcons name="close" size={22} color="#236779" />
            </Pressable>
          </View>

          <View style={styles.expenseLedgerSummaryCard}>
            <View style={styles.expenseLedgerSummaryTop}>
              <View style={styles.expenseLedgerTotalBlock}>
                <Text style={styles.expenseLedgerHeroLabel}>总花费</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.expenseLedgerHeroAmount}
                >
                  {formatExpenseAmount(
                    expenseSummary?.totalAmount ?? tripTotalCost,
                    trip?.currency,
                  )}
                </Text>
              </View>
              <View style={styles.expenseLedgerMetricGroup}>
                <View style={styles.expenseLedgerMiniMetric}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={styles.expenseLedgerMiniMetricValue}
                  >
                    {expenseSummary?.budgetAmount
                      ? formatExpenseAmount(
                          expenseSummary.budgetAmount,
                          trip?.currency,
                        )
                      : "未设置"}
                  </Text>
                  <Text style={styles.expenseLedgerMiniMetricLabel}>预算</Text>
                </View>
              </View>
            </View>
            <View style={styles.expenseLedgerSummaryBottom}>
              <View style={styles.expenseLedgerBudgetCompact}>
                <View style={styles.expenseLedgerBudgetTrack}>
                  <View
                    style={[
                      styles.expenseLedgerBudgetFill,
                      expenseSummary?.remainingAmount !== undefined &&
                      expenseSummary.remainingAmount < 0
                        ? styles.expenseLedgerBudgetFillOver
                        : null,
                      { width: `${expenseBudgetProgress ?? 0}%` },
                    ]}
                  />
                </View>
                <Text numberOfLines={1} style={styles.expenseLedgerBudgetMeta}>
                  {expenseSummary?.budgetAmount
                    ? `已用 ${expenseBudgetProgress ?? 0}%`
                    : "未设置预算"}
                </Text>
              </View>
              <View style={styles.expenseLedgerToolbar}>
                <Pressable
                  accessibilityRole="button"
                  onPress={openBudgetInput}
                  style={({ pressed }) => [
                    styles.expenseLedgerToolbarButton,
                    styles.expenseLedgerSecondaryToolbarButton,
                    pressed && styles.expenseLedgerToolbarButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="account-balance-wallet"
                    size={17}
                    color="#007892"
                  />
                  <Text style={styles.expenseLedgerToolbarText}>预算</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openExpenseInput()}
                  style={({ pressed }) => [
                    styles.expenseLedgerToolbarButton,
                    styles.expenseLedgerPrimaryToolbarButton,
                    pressed && styles.expenseLedgerToolbarButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="add-circle-outline"
                    size={19}
                    color="#ecfbff"
                  />
                  <Text
                    style={[
                      styles.expenseLedgerToolbarText,
                      styles.expenseLedgerPrimaryToolbarText,
                    ]}
                  >
                    记一笔
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.expenseLedgerListContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.expenseLedgerList}
          >
            {expenseSummary && expenseSummary.categorySummaries.length > 0 ? (
              <View style={styles.expenseLedgerCategoryGrid}>
                {expenseSummary.categorySummaries.map((summary) => (
                  <Pressable
                    accessibilityLabel={`${activeExpenseCategoryFilter === summary.category ? "取消筛选" : "筛选"}${summary.category}开销`}
                    accessibilityRole="button"
                    key={summary.category}
                    onPress={() =>
                      toggleExpenseCategoryFilter(summary.category)
                    }
                    style={({ pressed }) => [
                      styles.expenseLedgerCategoryPill,
                      activeExpenseCategoryFilter === summary.category &&
                        styles.expenseLedgerCategoryPillActive,
                      pressed && styles.expenseLedgerCategoryPillPressed,
                    ]}
                  >
                    <MaterialIcons
                      name={
                        tripExpenseCategoryIcons[
                          summary.category
                        ] as keyof typeof MaterialIcons.glyphMap
                      }
                      size={16}
                      color={
                        activeExpenseCategoryFilter === summary.category
                          ? "#ecfbff"
                          : "#007892"
                      }
                    />
                    <Text
                      style={[
                        styles.expenseLedgerCategoryText,
                        activeExpenseCategoryFilter === summary.category &&
                          styles.expenseLedgerCategoryTextActive,
                      ]}
                    >
                      {summary.category}
                    </Text>
                    <Text
                      style={[
                        styles.expenseLedgerCategoryAmount,
                        activeExpenseCategoryFilter === summary.category &&
                          styles.expenseLedgerCategoryTextActive,
                      ]}
                    >
                      {formatExpenseAmount(summary.amount, trip?.currency)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {activeExpenseCategoryFilter ? (
              <View style={styles.expenseLedgerFilterNotice}>
                <Text style={styles.expenseLedgerFilterNoticeText}>
                  正在查看 {activeExpenseCategoryFilter} ·{" "}
                  {filteredExpenseEntries.length} 条
                </Text>
                <Pressable
                  accessibilityLabel="取消账本分类筛选"
                  accessibilityRole="button"
                  onPress={() => setActiveExpenseCategoryFilter(undefined)}
                  style={({ pressed }) => [
                    styles.expenseLedgerFilterClearButton,
                    pressed && styles.expenseLedgerToolbarButtonPressed,
                  ]}
                >
                  <Text style={styles.expenseLedgerFilterClearText}>全部</Text>
                </Pressable>
              </View>
            ) : null}

            {expenseLedgerDays.map(
              ({ day, entries: dayEntries, totalAmount }) => {
                const isDayExpanded = Boolean(expandedExpenseDayIds[day.id]);
                const dayDate = trip ? formatDayTabDate(trip, day) : undefined;

                return (
                  <View key={day.id} style={styles.expenseLedgerDayGroup}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => toggleExpenseDay(day.id)}
                      style={({ pressed }) => [
                        styles.expenseLedgerDayRow,
                        pressed && styles.expenseLedgerDayRowPressed,
                      ]}
                    >
                      <View style={styles.expenseLedgerDayCopy}>
                        <Text style={styles.expenseLedgerDayTitle}>
                          {day.title}
                        </Text>
                        <Text style={styles.expenseLedgerDayMeta}>
                          {[dayDate, `${day.items.length} 个地点`]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                      <View style={styles.expenseLedgerDayAmountWrap}>
                        <Text style={styles.expenseLedgerDayAmount}>
                          {formatExpenseAmount(totalAmount, trip?.currency)}
                        </Text>
                        <MaterialIcons
                          name={isDayExpanded ? "expand-less" : "expand-more"}
                          size={21}
                          color="#4a8795"
                        />
                      </View>
                    </Pressable>

                    {isDayExpanded ? (
                      <View style={styles.expenseLedgerItemList}>
                        {dayEntries.length > 0 ? (
                          dayEntries.map((entry) => {
                            const entryNote = formatExpenseEntryNote(entry);

                            return (
                              <Pressable
                                accessibilityHint={
                                  entry.source === "expense"
                                    ? "打开开销编辑和删除操作"
                                    : "编辑这条行程地点的费用"
                                }
                                accessibilityRole="button"
                                key={entry.id}
                                onPress={() => openExpenseEntry(entry)}
                                style={({ pressed }) => [
                                  styles.expenseLedgerItemRow,
                                  pressed && styles.expenseLedgerItemRowPressed,
                                ]}
                              >
                                <View style={styles.expenseLedgerItemIcon}>
                                  <MaterialIcons
                                    name={
                                      tripExpenseCategoryIcons[
                                        entry.category
                                      ] as keyof typeof MaterialIcons.glyphMap
                                    }
                                    size={15}
                                    color="#007892"
                                  />
                                </View>
                                <View style={styles.expenseLedgerItemCopy}>
                                  <Text
                                    numberOfLines={1}
                                    style={styles.expenseLedgerItemTitle}
                                  >
                                    {entry.title}
                                  </Text>
                                  <Text style={styles.expenseLedgerItemMeta}>
                                    {formatExpenseEntryMeta(entry)}
                                  </Text>
                                  {entryNote ? (
                                    <Text
                                      numberOfLines={2}
                                      style={styles.expenseLedgerItemNote}
                                    >
                                      {entryNote}
                                    </Text>
                                  ) : null}
                                </View>
                                <Text style={styles.expenseLedgerItemAmount}>
                                  {formatExpenseAmount(
                                    entry.amount,
                                    entry.currency ?? trip?.currency,
                                  )}
                                </Text>
                              </Pressable>
                            );
                          })
                        ) : (
                          <Text style={styles.expenseLedgerEmptyTextInline}>
                            这一天还没有开销记录
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              },
            )}

            {expenseSummary && filteredExpenseEntries.length === 0 ? (
              <View style={styles.expenseLedgerEmpty}>
                <MaterialIcons name="receipt-long" size={30} color="#8db7bf" />
                <Text style={styles.expenseLedgerEmptyTitle}>
                  {activeExpenseCategoryFilter
                    ? `${activeExpenseCategoryFilter}暂无记录`
                    : "还没有账本记录"}
                </Text>
                <Text style={styles.expenseLedgerEmptyText}>
                  {activeExpenseCategoryFilter
                    ? "换个分类看看，或者新增一笔当前分类的开销。"
                    : "记录交通、住宿、餐饮，或在地点里填写本次花费。"}
                </Text>
              </View>
            ) : null}

            {unassignedExpenseEntries.length > 0 ? (
              <View style={styles.expenseLedgerDayGroup}>
                <View style={styles.expenseLedgerDayRow}>
                  <View style={styles.expenseLedgerDayCopy}>
                    <Text style={styles.expenseLedgerDayTitle}>未关联日期</Text>
                    <Text style={styles.expenseLedgerDayMeta}>
                      交通、住宿或行前预付款
                    </Text>
                  </View>
                  <View style={styles.expenseLedgerDayAmountWrap}>
                    <Text style={styles.expenseLedgerDayAmount}>
                      {formatExpenseAmount(
                        unassignedExpenseTotal,
                        trip?.currency,
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.expenseLedgerItemList}>
                  {unassignedExpenseEntries.map((entry) => {
                    const entryNote = formatExpenseEntryNote(entry);

                    return (
                      <Pressable
                        accessibilityHint={
                          entry.source === "expense"
                            ? "打开开销编辑和删除操作"
                            : "编辑这条行程地点的费用"
                        }
                        accessibilityRole="button"
                        key={entry.id}
                        onPress={() => openExpenseEntry(entry)}
                        style={({ pressed }) => [
                          styles.expenseLedgerItemRow,
                          pressed && styles.expenseLedgerItemRowPressed,
                        ]}
                      >
                        <View style={styles.expenseLedgerItemIcon}>
                          <MaterialIcons
                            name={
                              tripExpenseCategoryIcons[
                                entry.category
                              ] as keyof typeof MaterialIcons.glyphMap
                            }
                            size={15}
                            color="#007892"
                          />
                        </View>
                        <View style={styles.expenseLedgerItemCopy}>
                          <Text
                            numberOfLines={1}
                            style={styles.expenseLedgerItemTitle}
                          >
                            {entry.title}
                          </Text>
                          <Text style={styles.expenseLedgerItemMeta}>
                            {formatExpenseEntryMeta(entry)}
                          </Text>
                          {entryNote ? (
                            <Text
                              numberOfLines={2}
                              style={styles.expenseLedgerItemNote}
                            >
                              {entryNote}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.expenseLedgerItemAmount}>
                          {formatExpenseAmount(
                            entry.amount,
                            entry.currency ?? trip?.currency,
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
