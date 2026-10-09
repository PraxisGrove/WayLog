import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  formatExpenseAmount,
  type TripExpenseEntry,
  type TripExpenseSummary,
} from "@/features/trips";
import { skinSlotAdapterIds } from "@/shared/theme/skin-slot-registry";
import type { createStyles } from "../../trip-detail.styles";

type ExpensePreviewCardProps = {
  adapterId?: string;
  currency?: string;
  entries: TripExpenseEntry[];
  onAddExpense: () => void;
  onOpenLedger: () => void;
  styles: ReturnType<typeof createStyles>;
  summary?: TripExpenseSummary;
  totalCost: number;
};

export function ExpensePreviewCard({
  adapterId,
  currency,
  entries,
  onAddExpense,
  onOpenLedger,
  styles,
  summary,
  totalCost,
}: ExpensePreviewCardProps) {
  const isWireframe =
    adapterId === skinSlotAdapterIds.tripDetailLedgerPreview.default;

  return (
    <View
      style={[
        styles.squareOverviewCard,
        styles.expenseSquareCard,
        isWireframe && styles.wireframeExpenseSquareCard,
      ]}
    >
      <Pressable
        accessibilityLabel="打开旅行账本"
        accessibilityRole="button"
        onPress={onOpenLedger}
        style={({ pressed }) => [
          styles.expensePreviewHeaderButton,
          pressed && styles.squareOverviewHeaderPressed,
        ]}
      >
        <View style={styles.expensePreviewTitleWrap}>
          <Text
            style={[
              styles.expensePreviewTitle,
              isWireframe && styles.wireframeExpensePreviewTitle,
            ]}
          >
            旅行账本
          </Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              styles.expensePreviewTotal,
              isWireframe && styles.wireframeExpensePreviewTotal,
            ]}
          >
            {formatExpenseAmount(summary?.totalAmount ?? totalCost, currency)}
          </Text>
        </View>
        <Text
          style={[
            styles.expensePreviewCount,
            isWireframe && styles.wireframeExpensePreviewCount,
          ]}
        >
          {summary?.recordedCount ?? 0} 条
        </Text>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.expensePreviewLinesContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.expensePreviewLines}
      >
        {entries.map((entry) => (
          <View
            key={entry.id}
            style={[
              styles.expensePreviewRow,
              isWireframe && styles.wireframeExpensePreviewRow,
            ]}
          >
            <View
              style={[
                styles.expensePreviewDot,
                isWireframe && styles.wireframeExpensePreviewDot,
              ]}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.expensePreviewName,
                isWireframe && styles.wireframeExpensePreviewName,
              ]}
            >
              {entry.placeName ?? entry.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.expensePreviewAmount,
                isWireframe && styles.wireframeExpensePreviewAmount,
              ]}
            >
              {formatExpenseAmount(entry.amount, entry.currency ?? currency)}
            </Text>
          </View>
        ))}
        {entries.length === 0 ? (
          <Text style={styles.expensePreviewEmpty}>还没有开销记录</Text>
        ) : null}
      </ScrollView>
      <View style={styles.expensePreviewFooter}>
        <Pressable
          accessibilityLabel="新增一笔行程开销"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAddExpense}
          style={({ pressed }) => [
            styles.expensePreviewAddButton,
            isWireframe && styles.wireframeExpensePreviewAddButton,
            pressed && styles.expensePreviewAddButtonPressed,
            isWireframe &&
              pressed &&
              styles.wireframeExpensePreviewAddButtonPressed,
          ]}
        >
          <MaterialIcons
            name="account-balance-wallet"
            size={15}
            color={isWireframe ? "#111111" : "#ecfbff"}
          />
          <Text
            style={[
              styles.expensePreviewAddText,
              isWireframe && styles.wireframeExpensePreviewAddText,
            ]}
          >
            记账
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
