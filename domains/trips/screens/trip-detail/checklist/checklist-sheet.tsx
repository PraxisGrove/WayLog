import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Dispatch, SetStateAction } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Trip, TripChecklistItem } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type ChecklistSheetProps = {
  cancelEditingChecklistItem: () => void;
  checklistModalAnim: Animated.Value;
  closeChecklistNotebook: () => void;
  completedChecklistCount: number;
  deleteChecklistItem: (itemId: string) => void | Promise<void>;
  deleteSelectedChecklistItems: () => void | Promise<void>;
  editingChecklistError: string;
  editingChecklistItemId?: string;
  editingChecklistTitle: string;
  isChecklistManageMode: boolean;
  isChecklistNotebookOpen: boolean;
  isConfirmingChecklistDelete: boolean;
  moveChecklistItem: (
    itemId: string,
    direction: "down" | "up",
  ) => void | Promise<void>;
  openChecklistInput: () => void;
  saveEditingChecklistItem: () => void | Promise<void>;
  selectedChecklistItemIds: string[];
  setChecklistManageMode: Dispatch<SetStateAction<boolean>>;
  setConfirmingChecklistDelete: Dispatch<SetStateAction<boolean>>;
  setEditingChecklistError: Dispatch<SetStateAction<string>>;
  setEditingChecklistTitle: Dispatch<SetStateAction<string>>;
  setSelectedChecklistItemIds: Dispatch<SetStateAction<string[]>>;
  startEditingChecklistItem: (item: TripChecklistItem) => void;
  styles: TripDetailStyles;
  theme: AppTheme;
  toggleChecklistItem: (itemId: string) => void | Promise<void>;
  toggleChecklistSelection: (itemId: string) => void;
  trip: Trip | null;
};

export function ChecklistSheet({
  cancelEditingChecklistItem,
  checklistModalAnim,
  closeChecklistNotebook,
  completedChecklistCount,
  deleteChecklistItem,
  deleteSelectedChecklistItems,
  editingChecklistError,
  editingChecklistItemId,
  editingChecklistTitle,
  isChecklistManageMode,
  isChecklistNotebookOpen,
  isConfirmingChecklistDelete,
  moveChecklistItem,
  openChecklistInput,
  saveEditingChecklistItem,
  selectedChecklistItemIds,
  setChecklistManageMode,
  setConfirmingChecklistDelete,
  setEditingChecklistError,
  setEditingChecklistTitle,
  setSelectedChecklistItemIds,
  startEditingChecklistItem,
  styles,
  theme,
  toggleChecklistItem,
  toggleChecklistSelection,
  trip,
}: ChecklistSheetProps) {
  return (
    <>
      <Modal
        animationType="none"
        onRequestClose={closeChecklistNotebook}
        transparent
        visible={isChecklistNotebookOpen}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.animatedModalBackdrop,
              {
                opacity: checklistModalAnim,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={closeChecklistNotebook}
              style={styles.modalBackdrop}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.notebookModal,
              {
                opacity: checklistModalAnim,
                transform: [
                  {
                    translateY: checklistModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0],
                    }),
                  },
                  {
                    scale: checklistModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.notebookModalBinding} />
            <View style={styles.notebookModalHeader}>
              <View style={styles.notebookModalTitleWrap}>
                <Text style={styles.notebookModalEyebrow}>CHECKLIST</Text>
                <Text style={styles.notebookModalTitle}>出行清单</Text>
                <Text style={styles.notebookModalMeta}>
                  已完成 {completedChecklistCount} /{" "}
                  {trip?.checklistItems.length ?? 0}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="关闭出行清单"
                accessibilityRole="button"
                onPress={closeChecklistNotebook}
                style={({ pressed }) => [
                  styles.notebookIconButton,
                  pressed && styles.notebookIconButtonPressed,
                ]}
              >
                <MaterialIcons
                  name="close"
                  size={22}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.notebookToolbar}>
              <Pressable
                accessibilityRole="button"
                onPress={openChecklistInput}
                style={({ pressed }) => [
                  styles.notebookToolbarButton,
                  pressed && styles.notebookToolbarButtonPressed,
                ]}
              >
                <MaterialIcons
                  name="add"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.notebookToolbarText}>添加</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setChecklistManageMode((isManaging) => !isManaging);
                  setSelectedChecklistItemIds([]);
                  setConfirmingChecklistDelete(false);
                  cancelEditingChecklistItem();
                }}
                style={({ pressed }) => [
                  styles.notebookToolbarButton,
                  isChecklistManageMode && styles.notebookToolbarButtonActive,
                  pressed && styles.notebookToolbarButtonPressed,
                ]}
              >
                <MaterialIcons
                  name={isChecklistManageMode ? "done" : "edit-note"}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.notebookToolbarText}>
                  {isChecklistManageMode ? "完成" : "管理"}
                </Text>
              </Pressable>
              {isChecklistManageMode ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={selectedChecklistItemIds.length === 0}
                  onPress={() => setConfirmingChecklistDelete(true)}
                  style={({ pressed }) => [
                    styles.notebookToolbarButton,
                    styles.notebookToolbarDanger,
                    selectedChecklistItemIds.length === 0 &&
                      styles.notebookToolbarDisabled,
                    pressed &&
                      selectedChecklistItemIds.length > 0 &&
                      styles.notebookToolbarButtonPressed,
                  ]}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={18}
                    color={theme.colors.danger}
                  />
                  <Text style={styles.notebookToolbarDangerText}>
                    删除 {selectedChecklistItemIds.length || ""}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {editingChecklistItemId ? (
              <View style={styles.notebookEditBox}>
                <Text style={styles.inputLabel}>编辑物品</Text>
                <TextInput
                  autoFocus
                  onChangeText={(value) => {
                    setEditingChecklistTitle(value);
                    setEditingChecklistError("");
                  }}
                  placeholder="物品名称"
                  style={styles.textInput}
                  value={editingChecklistTitle}
                />
                {editingChecklistError ? (
                  <Text style={styles.notebookInlineError}>
                    {editingChecklistError}
                  </Text>
                ) : null}
                <View style={styles.notebookEditActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={cancelEditingChecklistItem}
                    style={({ pressed }) => [
                      styles.secondaryActionButton,
                      pressed && styles.secondaryActionButtonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryActionText}>取消</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void saveEditingChecklistItem();
                    }}
                    style={({ pressed }) => [
                      styles.primaryActionButton,
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
            ) : null}

            <ScrollView
              contentContainerStyle={styles.notebookListContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.notebookList}
            >
              {trip?.checklistItems.length ? (
                trip.checklistItems.map((item, index) => {
                  const isSelected = selectedChecklistItemIds.includes(item.id);

                  return (
                    <View key={item.id} style={styles.notebookLineWrap}>
                      <Pressable
                        accessibilityRole={
                          isChecklistManageMode ? "button" : "checkbox"
                        }
                        accessibilityState={
                          isChecklistManageMode
                            ? { selected: isSelected }
                            : { checked: item.isCompleted }
                        }
                        onPress={() => {
                          if (isChecklistManageMode) {
                            toggleChecklistSelection(item.id);
                            return;
                          }

                          void toggleChecklistItem(item.id);
                        }}
                        style={({ pressed }) => [
                          styles.notebookChecklistRow,
                          item.isCompleted && styles.notebookChecklistRowDone,
                          isSelected && styles.notebookChecklistRowSelected,
                          pressed && styles.notebookChecklistRowPressed,
                        ]}
                      >
                        <MaterialIcons
                          name={
                            isChecklistManageMode
                              ? isSelected
                                ? "check-circle"
                                : "radio-button-unchecked"
                              : item.isCompleted
                                ? "check-box"
                                : "check-box-outline-blank"
                          }
                          size={21}
                          color={
                            isChecklistManageMode && isSelected
                              ? theme.colors.danger
                              : item.isCompleted
                                ? theme.colors.primary
                                : theme.colors.textSubtle
                          }
                        />
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.notebookChecklistTitle,
                            item.isCompleted &&
                              styles.notebookChecklistTitleDone,
                          ]}
                        >
                          {item.title}
                        </Text>
                      </Pressable>

                      {isChecklistManageMode ? (
                        <View style={styles.notebookRowActions}>
                          <Pressable
                            accessibilityLabel={`编辑${item.title}`}
                            accessibilityRole="button"
                            onPress={() => startEditingChecklistItem(item)}
                            style={({ pressed }) => [
                              styles.notebookRowActionButton,
                              pressed && styles.notebookIconButtonPressed,
                            ]}
                          >
                            <MaterialIcons
                              name="edit"
                              size={18}
                              color={theme.colors.primary}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`上移${item.title}`}
                            accessibilityRole="button"
                            disabled={index === 0}
                            onPress={() => {
                              void moveChecklistItem(item.id, "up");
                            }}
                            style={({ pressed }) => [
                              styles.notebookRowActionButton,
                              index === 0 && styles.notebookRowActionDisabled,
                              pressed &&
                                index > 0 &&
                                styles.notebookIconButtonPressed,
                            ]}
                          >
                            <MaterialIcons
                              name="keyboard-arrow-up"
                              size={20}
                              color={
                                index === 0
                                  ? theme.colors.textSubtle
                                  : theme.colors.textMuted
                              }
                            />
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`下移${item.title}`}
                            accessibilityRole="button"
                            disabled={
                              index === (trip?.checklistItems.length ?? 0) - 1
                            }
                            onPress={() => {
                              void moveChecklistItem(item.id, "down");
                            }}
                            style={({ pressed }) => [
                              styles.notebookRowActionButton,
                              index ===
                                (trip?.checklistItems.length ?? 0) - 1 &&
                                styles.notebookRowActionDisabled,
                              pressed &&
                                index <
                                  (trip?.checklistItems.length ?? 0) - 1 &&
                                styles.notebookIconButtonPressed,
                            ]}
                          >
                            <MaterialIcons
                              name="keyboard-arrow-down"
                              size={20}
                              color={
                                index === (trip?.checklistItems.length ?? 0) - 1
                                  ? theme.colors.textSubtle
                                  : theme.colors.textMuted
                              }
                            />
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`删除${item.title}`}
                            accessibilityRole="button"
                            onPress={() => {
                              void deleteChecklistItem(item.id);
                            }}
                            style={({ pressed }) => [
                              styles.notebookRowActionButton,
                              pressed && styles.notebookIconButtonPressed,
                            ]}
                          >
                            <MaterialIcons
                              name="delete-outline"
                              size={18}
                              color={theme.colors.danger}
                            />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <View style={styles.notebookEmpty}>
                  <MaterialIcons
                    name="checklist"
                    size={30}
                    color={theme.colors.textSubtle}
                  />
                  <Text style={styles.notebookEmptyTitle}>还没有清单物品</Text>
                  <Text style={styles.notebookEmptyText}>
                    添加证件、衣物、充电器等出行前要确认的事项。
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ConfirmDialog
        message={`确认删除选中的 ${selectedChecklistItemIds.length} 个清单项吗？`}
        onCancel={() => setConfirmingChecklistDelete(false)}
        onConfirm={() => {
          void deleteSelectedChecklistItems();
        }}
        title="删除清单项"
        visible={isConfirmingChecklistDelete}
      />
    </>
  );
}
