import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Dispatch, SetStateAction } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  formatExpenseAmount,
  type Trip,
  type TripDay,
  type TripDayItem,
  type TripExpense,
  type TripExpenseCategory,
  tripExpenseCategoryIcons,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type ExpensePlaceOption = {
  day: TripDay;
  item: TripDayItem;
  placeId: string;
  placeName: string;
};

type LedgerDialogsProps = {
  activeExpenseAction?: TripExpense;
  budgetAmount: string;
  budgetError: string;
  clearBudget: () => void | Promise<void>;
  closeBudgetInput: () => void;
  closeExpenseActions: () => void;
  closeExpenseInput: () => void;
  deleteActiveExpense: () => void | Promise<void>;
  expenseAmount: string;
  expenseCategory: TripExpenseCategory;
  expenseDayId: string;
  expenseError: string;
  expenseNote: string;
  expensePlaceId: string;
  expensePlaceOptions: ExpensePlaceOption[];
  expenseTitle: string;
  isAddingExpense: boolean;
  isConfirmingExpenseDelete: boolean;
  isEditingBudget: boolean;
  orderedExpenseCategories: TripExpenseCategory[];
  saveBudget: () => void | Promise<void>;
  saveExpense: () => void | Promise<void>;
  setBudgetAmount: Dispatch<SetStateAction<string>>;
  setBudgetError: Dispatch<SetStateAction<string>>;
  setConfirmingExpenseDelete: Dispatch<SetStateAction<boolean>>;
  setExpenseAmount: Dispatch<SetStateAction<string>>;
  setExpenseCategory: Dispatch<SetStateAction<TripExpenseCategory>>;
  setExpenseDayId: Dispatch<SetStateAction<string>>;
  setExpenseError: Dispatch<SetStateAction<string>>;
  setExpenseNote: Dispatch<SetStateAction<string>>;
  setExpensePlaceId: Dispatch<SetStateAction<string>>;
  setExpenseTitle: Dispatch<SetStateAction<string>>;
  startEditingExpense: () => void;
  styles: TripDetailStyles;
  theme: AppTheme;
  trip?: Trip | null;
};

export function LedgerDialogs({
  activeExpenseAction,
  budgetAmount,
  budgetError,
  clearBudget,
  closeBudgetInput,
  closeExpenseActions,
  closeExpenseInput,
  deleteActiveExpense,
  expenseAmount,
  expenseCategory,
  expenseDayId,
  expenseError,
  expenseNote,
  expensePlaceId,
  expensePlaceOptions,
  expenseTitle,
  isAddingExpense,
  isConfirmingExpenseDelete,
  isEditingBudget,
  orderedExpenseCategories,
  saveBudget,
  saveExpense,
  setBudgetAmount,
  setBudgetError,
  setConfirmingExpenseDelete,
  setExpenseAmount,
  setExpenseCategory,
  setExpenseDayId,
  setExpenseError,
  setExpenseNote,
  setExpensePlaceId,
  setExpenseTitle,
  startEditingExpense,
  styles,
  theme,
  trip,
}: LedgerDialogsProps) {
  return (
    <>
      <ActionSheet
        description={
          activeExpenseAction
            ? formatExpenseAmount(
                activeExpenseAction.amount,
                activeExpenseAction.currency,
              )
            : undefined
        }
        items={[
          {
            description: activeExpenseAction
              ? formatExpenseAmount(
                  activeExpenseAction.amount,
                  activeExpenseAction.currency,
                )
              : undefined,
            icon: "edit",
            id: "edit",
            label: "编辑开销",
            onPress: startEditingExpense,
          },
          {
            description: "从旅行账本中移除这条记录",
            icon: "delete-outline",
            id: "delete",
            label: "删除开销",
            onPress: () => setConfirmingExpenseDelete(true),
            tone: "danger",
          },
        ]}
        onCancel={closeExpenseActions}
        onRequestClose={closeExpenseActions}
        title={activeExpenseAction?.title ?? "独立记账"}
        visible={
          Boolean(activeExpenseAction) &&
          !isAddingExpense &&
          !isConfirmingExpenseDelete
        }
      />

      <ConfirmDialog
        message={`确认删除”${activeExpenseAction?.title ?? "这条开销"}”吗？这条记录会从旅行账本中移除。`}
        onCancel={() => setConfirmingExpenseDelete(false)}
        onConfirm={() => {
          void deleteActiveExpense();
        }}
        title="删除开销"
        visible={Boolean(activeExpenseAction) && isConfirmingExpenseDelete}
      />

      <Modal
        animationType="fade"
        onRequestClose={closeBudgetInput}
        transparent
        visible={isEditingBudget}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            accessibilityRole="button"
            onPress={closeBudgetInput}
            style={styles.modalBackdrop}
          />
          <View style={styles.editSheet}>
            <Text style={styles.sheetEyebrow}>旅行账本</Text>
            <Text style={styles.sheetTitle}>编辑预算</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>总预算</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setBudgetAmount(value);
                  setBudgetError("");
                }}
                placeholder="例如：3000"
                style={styles.textInput}
                value={budgetAmount}
              />
            </View>

            {budgetError ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{budgetError}</Text>
              </View>
            ) : null}

            <View style={styles.editActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeBudgetInput}
                style={({ pressed }) => [
                  styles.secondaryActionButton,
                  { backgroundColor: theme.colors.surface },
                  pressed && [
                    styles.secondaryActionButtonPressed,
                    { backgroundColor: theme.colors.surfaceSubtle },
                  ],
                ]}
              >
                <Text style={styles.secondaryActionText}>取消</Text>
              </Pressable>
              {trip?.budget?.amount !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void clearBudget();
                  }}
                  style={({ pressed }) => [
                    styles.dangerOutlineButton,
                    pressed && styles.dangerOutlineButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dangerOutlineText,
                      { color: theme.colors.danger },
                    ]}
                  >
                    清除
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void saveBudget();
                }}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && styles.primaryActionButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryActionText,
                    { color: theme.colors.surface },
                  ]}
                >
                  保存
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeExpenseInput}
        transparent
        visible={isAddingExpense}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            accessibilityRole="button"
            onPress={closeExpenseInput}
            style={styles.modalBackdrop}
          />
          <View style={styles.editSheet}>
            <Text style={styles.sheetEyebrow}>旅行账本</Text>
            <Text style={styles.sheetTitle}>
              {activeExpenseAction ? "编辑开销" : "记一笔"}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>账单类型</Text>
              <View style={styles.expenseCategorySelector}>
                {orderedExpenseCategories.map((category) => {
                  const isSelected = category === expenseCategory;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={category}
                      onPress={() => setExpenseCategory(category)}
                      style={({ pressed }) => [
                        styles.expenseCategoryOption,
                        isSelected && styles.expenseCategoryOptionSelected,
                        pressed && [
                          styles.expenseCategoryOptionPressed,
                          { backgroundColor: theme.colors.surfaceSubtle },
                        ],
                      ]}
                    >
                      <MaterialIcons
                        name={
                          tripExpenseCategoryIcons[
                            category
                          ] as keyof typeof MaterialIcons.glyphMap
                        }
                        size={17}
                        color={
                          isSelected
                            ? theme.colors.success
                            : theme.colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.expenseCategoryOptionText,
                          { color: theme.colors.textMuted },
                          isSelected &&
                            styles.expenseCategoryOptionTextSelected,
                          isSelected && { color: theme.colors.success },
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>金额</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setExpenseAmount(value);
                  setExpenseError("");
                }}
                placeholder="例如：128"
                style={styles.textInput}
                value={expenseAmount}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>名称</Text>
              <TextInput
                onChangeText={setExpenseTitle}
                placeholder="例如：机场大巴 / 酒店押金 / 午餐"
                style={styles.textInput}
                value={expenseTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>关联日期</Text>
              <View style={styles.expenseDaySelector}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setExpenseDayId("");
                    setExpensePlaceId("");
                  }}
                  style={({ pressed }) => [
                    styles.expenseDayOption,
                    { backgroundColor: theme.colors.surface },
                    !expenseDayId && styles.expenseDayOptionSelected,
                    pressed && [
                      styles.expenseDayOptionPressed,
                      { backgroundColor: theme.colors.surfaceSubtle },
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.expenseDayOptionText,
                      { color: theme.colors.textMuted },
                      !expenseDayId && styles.expenseDayOptionTextSelected,
                      !expenseDayId && { color: theme.colors.primary },
                    ]}
                  >
                    不关联
                  </Text>
                </Pressable>
                {trip?.days.map((day) => {
                  const isSelected = expenseDayId === day.id;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={day.id}
                      onPress={() => {
                        setExpenseDayId(day.id);
                      }}
                      style={({ pressed }) => [
                        styles.expenseDayOption,
                        { backgroundColor: theme.colors.surface },
                        isSelected && styles.expenseDayOptionSelected,
                        pressed && [
                          styles.expenseDayOptionPressed,
                          { backgroundColor: theme.colors.surfaceSubtle },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.expenseDayOptionText,
                          { color: theme.colors.textMuted },
                          isSelected && styles.expenseDayOptionTextSelected,
                          isSelected && { color: theme.colors.primary },
                        ]}
                      >
                        第{day.dayIndex}天
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>关联地点</Text>
              <View style={styles.expensePlaceSelector}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpensePlaceId("")}
                  style={({ pressed }) => [
                    styles.expensePlaceOption,
                    !expensePlaceId && styles.expensePlaceOptionSelected,
                    pressed && styles.expensePlaceOptionPressed,
                  ]}
                >
                  <MaterialIcons
                    name="location-off"
                    size={16}
                    color={
                      !expensePlaceId
                        ? theme.colors.primary
                        : theme.colors.textMuted
                    }
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.expensePlaceOptionText,
                      !expensePlaceId && styles.expensePlaceOptionTextSelected,
                    ]}
                  >
                    不绑定地点
                  </Text>
                </Pressable>
                {expensePlaceOptions.map((option) => {
                  const isSelected = expensePlaceId === option.placeId;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={`${option.day.id}-${option.item.id}-${option.placeId}`}
                      onPress={() => setExpensePlaceId(option.placeId)}
                      style={({ pressed }) => [
                        styles.expensePlaceOption,
                        isSelected && styles.expensePlaceOptionSelected,
                        pressed && styles.expensePlaceOptionPressed,
                      ]}
                    >
                      <MaterialIcons
                        name="place"
                        size={16}
                        color={
                          isSelected
                            ? theme.colors.primary
                            : theme.colors.textMuted
                        }
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.expensePlaceOptionText,
                          isSelected && styles.expensePlaceOptionTextSelected,
                        ]}
                      >
                        {option.placeName}
                      </Text>
                      {!expenseDayId ? (
                        <Text style={styles.expensePlaceDayBadge}>
                          D{option.day.dayIndex}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {expensePlaceOptions.length === 0 ? (
                <Text style={styles.expensePlaceHint}>
                  当前日期还没有可绑定的地点
                </Text>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>账单备注</Text>
              <TextInput
                multiline
                onChangeText={setExpenseNote}
                placeholder="付款人、分账说明或临时提醒"
                style={[styles.textInput, styles.textArea]}
                value={expenseNote}
              />
            </View>

            {expenseError ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{expenseError}</Text>
              </View>
            ) : null}

            <View style={styles.editActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeExpenseInput}
                style={({ pressed }) => [
                  styles.secondaryActionButton,
                  { backgroundColor: theme.colors.surface },
                  pressed && [
                    styles.secondaryActionButtonPressed,
                    { backgroundColor: theme.colors.surfaceSubtle },
                  ],
                ]}
              >
                <Text style={styles.secondaryActionText}>取消</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void saveExpense();
                }}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  { backgroundColor: theme.colors.primary },
                  pressed && styles.primaryActionButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryActionText,
                    { color: theme.colors.surface },
                  ]}
                >
                  {activeExpenseAction ? "保存" : "记录"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
