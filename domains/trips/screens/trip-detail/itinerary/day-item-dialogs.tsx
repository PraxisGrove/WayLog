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
  type TripPlace,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import type { createStyles } from "../trip-detail.styles";
import { DayItemTimeField, DayItemTimePicker } from "./day-item-time-picker";

type TripDetailStyles = ReturnType<typeof createStyles>;

type ActiveDayItemAction = {
  day: TripDay;
  item: TripDayItem;
  place?: TripPlace;
};

type DayItemDialogsProps = {
  activeDayItemAction?: ActiveDayItemAction;
  closeDayItemActions: () => void;
  deleteActiveDayItem: () => void | Promise<void>;
  editPlaceCost: string;
  editPlaceCostError: string;
  editPlaceName: string;
  editPlaceNote: string;
  editPlaceTime: string;
  editPlaceTimeError: string;
  isConfirmingDayItemDelete: boolean;
  isEditingDayItem: boolean;
  isEditingDayItemTime: boolean;
  isPickingDayItemFormTime: boolean;
  openDayItemTimeEditor: (
    dayId: string,
    itemId: string,
    currentTime?: string,
  ) => void;
  saveEditedDayItem: () => void | Promise<void>;
  saveEditedDayItemTime: (time: string) => void | Promise<void>;
  setConfirmingDayItemDelete: Dispatch<SetStateAction<boolean>>;
  setEditPlaceCost: Dispatch<SetStateAction<string>>;
  setEditPlaceCostError: Dispatch<SetStateAction<string>>;
  setEditPlaceName: Dispatch<SetStateAction<string>>;
  setEditPlaceNote: Dispatch<SetStateAction<string>>;
  setEditPlaceTime: Dispatch<SetStateAction<string>>;
  setEditPlaceTimeError: Dispatch<SetStateAction<string>>;
  setPickingDayItemFormTime: Dispatch<SetStateAction<boolean>>;
  startEditingDayItem: () => void;
  styles: TripDetailStyles;
  theme: AppTheme;
  trip?: Trip | null;
};

export function DayItemDialogs({
  activeDayItemAction,
  closeDayItemActions,
  deleteActiveDayItem,
  editPlaceCost,
  editPlaceCostError,
  editPlaceName,
  editPlaceNote,
  editPlaceTime,
  editPlaceTimeError,
  isConfirmingDayItemDelete,
  isEditingDayItem,
  isEditingDayItemTime,
  isPickingDayItemFormTime,
  openDayItemTimeEditor,
  saveEditedDayItem,
  saveEditedDayItemTime,
  setConfirmingDayItemDelete,
  setEditPlaceCost,
  setEditPlaceCostError,
  setEditPlaceName,
  setEditPlaceNote,
  setEditPlaceTime,
  setEditPlaceTimeError,
  setPickingDayItemFormTime,
  startEditingDayItem,
  styles,
  theme,
  trip,
}: DayItemDialogsProps) {
  return (
    <>
      <ActionSheet
        description={activeDayItemAction?.day.title}
        items={[
          {
            description: activeDayItemAction?.item.time ?? "--:--",
            icon: "schedule",
            id: "time",
            label: "设置时间",
            onPress: () => {
              if (!activeDayItemAction) {
                return;
              }
              openDayItemTimeEditor(
                activeDayItemAction.day.id,
                activeDayItemAction.item.id,
                activeDayItemAction.item.time,
              );
            },
          },
          {
            description: activeDayItemAction
              ? formatExpenseAmount(
                  activeDayItemAction.item.cost,
                  trip?.currency,
                )
              : undefined,
            icon: "payments",
            id: "cost",
            label: "记录花费",
            onPress: startEditingDayItem,
          },
          {
            description: "修改名称、时间、花费和备注",
            icon: "edit",
            id: "edit",
            label: "编辑地点",
            onPress: startEditingDayItem,
          },
          {
            description: "从这一天移除这条地点记录",
            icon: "delete-outline",
            id: "delete",
            label: "删除地点",
            onPress: () => setConfirmingDayItemDelete(true),
            tone: "danger",
          },
        ]}
        onCancel={closeDayItemActions}
        onRequestClose={closeDayItemActions}
        title={activeDayItemAction?.item.title ?? "地点操作"}
        visible={
          Boolean(activeDayItemAction) &&
          !isEditingDayItem &&
          !isEditingDayItemTime &&
          !isConfirmingDayItemDelete
        }
      />

      <ConfirmDialog
        message={`确认删除”${activeDayItemAction?.item.title ?? "这个地点"}”吗？这条地点记录会从这一天移除。`}
        onCancel={() => setConfirmingDayItemDelete(false)}
        onConfirm={() => {
          void deleteActiveDayItem();
        }}
        title="删除地点"
        visible={Boolean(activeDayItemAction) && isConfirmingDayItemDelete}
      />

      <DayItemTimePicker
        itemTitle={activeDayItemAction?.item.title}
        onClose={closeDayItemActions}
        onConfirm={(time) => {
          void saveEditedDayItemTime(time);
        }}
        value={activeDayItemAction?.item.time}
        visible={
          Boolean(activeDayItemAction) &&
          isEditingDayItemTime &&
          !isPickingDayItemFormTime
        }
      />

      <Modal
        animationType="fade"
        onRequestClose={closeDayItemActions}
        transparent
        visible={Boolean(activeDayItemAction) && isEditingDayItem}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable
            accessibilityRole="button"
            onPress={closeDayItemActions}
            style={styles.modalBackdrop}
          />
          <View style={styles.editSheet}>
            <Text style={styles.sheetEyebrow}>编辑地点</Text>
            <Text style={styles.sheetTitle}>
              {activeDayItemAction?.day.title}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>地点名称</Text>
              <TextInput
                onChangeText={setEditPlaceName}
                placeholder="例如：钟楼"
                style={styles.textInput}
                value={editPlaceName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>时间</Text>
              <DayItemTimeField
                accessibilityLabel="设置地点时间"
                onClear={() => {
                  setEditPlaceTime("");
                  setEditPlaceTimeError("");
                }}
                onPress={() => setPickingDayItemFormTime(true)}
                placeholder="选择时间"
                time={editPlaceTime || undefined}
              />
            </View>

            {editPlaceTimeError ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{editPlaceTimeError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>本次花费</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setEditPlaceCost(value);
                  setEditPlaceCostError("");
                }}
                placeholder="例如：28"
                style={styles.textInput}
                value={editPlaceCost}
              />
            </View>

            {editPlaceCostError ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{editPlaceCostError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>备注</Text>
              <TextInput
                multiline
                onChangeText={setEditPlaceNote}
                placeholder="地址、提醒或现场要做的事"
                style={[styles.textInput, styles.textArea]}
                value={editPlaceNote}
              />
            </View>

            <View style={styles.editActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeDayItemActions}
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
                  void saveEditedDayItem();
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
      <DayItemTimePicker
        itemTitle={editPlaceName}
        onClose={() => setPickingDayItemFormTime(false)}
        onConfirm={(time) => {
          setEditPlaceTime(time);
          setEditPlaceTimeError("");
          setPickingDayItemFormTime(false);
        }}
        value={editPlaceTime}
        visible={
          Boolean(activeDayItemAction) &&
          isEditingDayItem &&
          isPickingDayItemFormTime
        }
      />
    </>
  );
}
