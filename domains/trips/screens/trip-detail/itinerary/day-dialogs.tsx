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
import { resolveTripDayTitle, type Trip, type TripDay } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type DayDialogsProps = {
  activeDayAction?: TripDay;
  closeDayActions: () => void;
  deleteActiveDay: () => void | Promise<void>;
  editDayTitle: string;
  isConfirmingDayDelete: boolean;
  isEditingDay: boolean;
  saveEditedDay: () => void | Promise<void>;
  setConfirmingDayDelete: Dispatch<SetStateAction<boolean>>;
  setEditDayTitle: Dispatch<SetStateAction<string>>;
  startEditingDay: () => void;
  styles: TripDetailStyles;
  theme: AppTheme;
  trip?: Trip | null;
};

export function DayDialogs({
  activeDayAction,
  closeDayActions,
  deleteActiveDay,
  editDayTitle,
  isConfirmingDayDelete,
  isEditingDay,
  saveEditedDay,
  setConfirmingDayDelete,
  setEditDayTitle,
  startEditingDay,
  styles,
  theme,
  trip,
}: DayDialogsProps) {
  const activeDayTitle = activeDayAction
    ? resolveTripDayTitle(activeDayAction)
    : "";

  return (
    <>
      <Modal
        animationType="fade"
        onRequestClose={closeDayActions}
        transparent
        visible={
          Boolean(activeDayAction) && !isEditingDay && !isConfirmingDayDelete
        }
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            onPress={closeDayActions}
            style={styles.modalBackdrop}
          />
          {activeDayAction ? (
            <View style={styles.actionSheet}>
              <Text style={styles.sheetEyebrow}>每日行程</Text>
              <Text style={styles.sheetTitle}>{activeDayTitle}</Text>

              <View style={styles.sheetActionList}>
                <Pressable
                  accessibilityRole="button"
                  onPress={startEditingDay}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && styles.sheetActionPressed,
                  ]}
                >
                  <MaterialIcons
                    name="edit-calendar"
                    size={22}
                    color={theme.colors.primary}
                  />
                  <View style={styles.sheetActionCopy}>
                    <Text style={styles.sheetActionTitle}>编辑这一天</Text>
                    <Text style={styles.sheetActionDetail}>修改天数标题</Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={(trip?.days.length ?? 0) <= 1}
                  onPress={() => setConfirmingDayDelete(true)}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    styles.sheetActionDanger,
                    (trip?.days.length ?? 0) <= 1 && styles.sheetActionDisabled,
                    pressed &&
                      (trip?.days.length ?? 0) > 1 &&
                      styles.sheetActionDangerPressed,
                  ]}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={22}
                    color={theme.colors.danger}
                  />
                  <View style={styles.sheetActionCopy}>
                    <Text style={styles.destructiveActionTitle}>
                      删除这一天
                    </Text>
                    <Text style={styles.sheetActionDetail}>
                      {(trip?.days.length ?? 0) <= 1
                        ? "至少需要保留一天行程"
                        : activeDayAction.items.length > 0
                          ? `同时移除 ${activeDayAction.items.length} 个地点安排`
                          : "移除这个空白天数"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeDayActions}
        transparent
        visible={Boolean(activeDayAction) && isEditingDay}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            accessibilityRole="button"
            onPress={closeDayActions}
            style={styles.modalBackdrop}
          />
          <View style={styles.editSheet}>
            <Text style={styles.sheetEyebrow}>编辑这一天</Text>
            <Text style={styles.sheetTitle}>{activeDayTitle}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>天数标题</Text>
              <TextInput
                onChangeText={setEditDayTitle}
                placeholder="例如：第一天"
                style={styles.textInput}
                value={editDayTitle}
              />
            </View>

            <View style={styles.editActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeDayActions}
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
                  void saveEditedDay();
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

      <ConfirmDialog
        message={`确认删除”${activeDayTitle || "这一天"}”吗？${
          activeDayAction && activeDayAction.items.length > 0
            ? `这一天的 ${activeDayAction.items.length} 个地点也会一起移除。`
            : "这一天会从行程中移除。"
        }`}
        onCancel={() => setConfirmingDayDelete(false)}
        onConfirm={() => {
          void deleteActiveDay();
        }}
        title="删除这一天"
        visible={Boolean(activeDayAction) && isConfirmingDayDelete}
      />
    </>
  );
}
