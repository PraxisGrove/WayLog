import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AgentConversationSummary } from "@/features/agent";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ModalTransition } from "@/shared/ui/modal-transition";

import { formatAgentConversationSummaryMeta } from "../utils";

type AgentConversationHistoryDrawerProps = {
  activeConversationId?: string;
  isDisabled: boolean;
  onClose: () => void;
  onCreateConversation: () => void;
  onDeleteConversation: (summary: AgentConversationSummary) => void;
  onRenameConversation: (
    summary: AgentConversationSummary,
    title: string,
  ) => void;
  onSelect: (summary: AgentConversationSummary) => void;
  summaries: AgentConversationSummary[];
  visible: boolean;
};

const SWIPE_OPEN_OFFSET_X = 42;
const SWIPE_CLOSE_OFFSET_X = 96;
const SWIPE_VERTICAL_FAIL_OFFSET_Y = 8;
const SWIPE_OPEN_THRESHOLD = 58;
const SWIPE_PRESS_SUPPRESS_DISTANCE_X = 24;
const SWIPE_PRESS_SUPPRESS_MS = 650;

export function AgentConversationHistoryDrawer({
  activeConversationId,
  isDisabled,
  onClose,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  onSelect,
  summaries,
  visible,
}: AgentConversationHistoryDrawerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [actionTarget, setActionTarget] = useState<AgentConversationSummary>();
  const [deleteTarget, setDeleteTarget] = useState<AgentConversationSummary>();
  const [editingTarget, setEditingTarget] =
    useState<AgentConversationSummary>();
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (visible) {
      return;
    }

    setActionTarget(undefined);
    setDeleteTarget(undefined);
    setEditingTarget(undefined);
  }, [visible]);

  const openActionMenu = (summary: AgentConversationSummary) => {
    if (isDisabled) {
      return;
    }

    setActionTarget(summary);
  };

  const openRenameDialog = (summary: AgentConversationSummary) => {
    setActionTarget(undefined);
    setEditingTarget(summary);
    setEditingTitle(summary.title);
  };

  const openDeleteDialog = (summary: AgentConversationSummary) => {
    setActionTarget(undefined);
    setDeleteTarget(summary);
  };

  const closeActionMenu = () => {
    setActionTarget(undefined);
  };

  const closeRenameDialog = () => {
    setEditingTarget(undefined);
    setEditingTitle("");
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(undefined);
  };

  const submitRename = () => {
    const title = editingTitle.trim();

    if (!editingTarget || !title) {
      return;
    }

    onRenameConversation(editingTarget, title);
    closeRenameDialog();
  };

  const submitDelete = () => {
    if (!deleteTarget) {
      return;
    }

    onDeleteConversation(deleteTarget);
    closeDeleteDialog();
  };

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭对话列表"
      contentStyle={styles.drawerMotion}
      drawerOffset={420}
      onRequestClose={onClose}
      overlayColor={theme.colors.overlay}
      overlayChildren={
        <>
          <ConversationActionSheet
            onClose={closeActionMenu}
            onDelete={openDeleteDialog}
            onRename={openRenameDialog}
            summary={actionTarget}
            theme={theme}
          />
          <ConversationRenameDialog
            onCancel={closeRenameDialog}
            onChangeTitle={setEditingTitle}
            onSubmit={submitRename}
            summary={editingTarget}
            theme={theme}
            title={editingTitle}
          />
          <ConversationDeleteDialog
            onCancel={closeDeleteDialog}
            onSubmit={submitDelete}
            summary={deleteTarget}
            theme={theme}
          />
        </>
      }
      preset="drawer"
      rootStyle={styles.modalRoot}
      visible={visible}
    >
      <SafeAreaView style={styles.drawerSafeArea}>
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>对话列表</Text>
            <Pressable
              accessibilityLabel="关闭对话列表"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={theme.colors.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="新建对话"
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={onCreateConversation}
            style={({ pressed }) => [
              styles.newConversationButton,
              pressed && !isDisabled && styles.newConversationButtonPressed,
              isDisabled && styles.rowDisabled,
            ]}
          >
            <MaterialIcons
              name="add-circle-outline"
              size={20}
              color={theme.colors.onPrimary}
            />
            <Text style={styles.newConversationText}>新建对话</Text>
          </Pressable>

          {summaries.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {summaries.map((summary) => {
                const isActive = summary.id === activeConversationId;

                return (
                  <ConversationRow
                    isActive={isActive}
                    isDisabled={isDisabled}
                    key={summary.id}
                    onDelete={openDeleteDialog}
                    onLongPress={openActionMenu}
                    onPress={onSelect}
                    onRename={openRenameDialog}
                    styles={styles}
                    summary={summary}
                    theme={theme}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="forum"
                size={24}
                color={theme.colors.textSubtle}
              />
              <Text style={styles.emptyTitle}>还没有历史对话</Text>
              <Text style={styles.emptyText}>
                新建一次对话后，这里会保留本机历史记录。
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ModalTransition>
  );
}

type ConversationRowProps = {
  isActive: boolean;
  isDisabled: boolean;
  onDelete: (summary: AgentConversationSummary) => void;
  onLongPress: (summary: AgentConversationSummary) => void;
  onPress: (summary: AgentConversationSummary) => void;
  onRename: (summary: AgentConversationSummary) => void;
  styles: ReturnType<typeof createStyles>;
  summary: AgentConversationSummary;
  theme: AppTheme;
};

function ConversationRow({
  isActive,
  isDisabled,
  onDelete,
  onLongPress,
  onPress,
  onRename,
  styles,
  summary,
  theme,
}: ConversationRowProps) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const suppressPressUntilRef = useRef(0);

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  const suppressNextPress = () => {
    suppressPressUntilRef.current = Date.now() + SWIPE_PRESS_SUPPRESS_MS;
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    pressStartRef.current = {
      x: event.nativeEvent.pageX ?? 0,
      y: event.nativeEvent.pageY ?? 0,
    };
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    const moveX = Math.abs(
      (event.nativeEvent.pageX ?? 0) - pressStartRef.current.x,
    );
    const moveY = Math.abs(
      (event.nativeEvent.pageY ?? 0) - pressStartRef.current.y,
    );

    if (moveX > SWIPE_PRESS_SUPPRESS_DISTANCE_X && moveX > moveY) {
      suppressNextPress();
    }
  };

  const handlePress = () => {
    if (Date.now() < suppressPressUntilRef.current) {
      return;
    }

    onPress(summary);
  };

  const handleLongPress = () => {
    if (isDisabled) {
      return;
    }

    onLongPress(summary);
  };

  const renderSwipeActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => {
    const actionAnimatedStyle = {
      opacity: progress.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, 0.45, 1],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [28, 0],
            extrapolate: "clamp",
          }),
        },
      ],
    };

    return (
      <Animated.View style={[styles.swipeActions, actionAnimatedStyle]}>
        <Pressable
          accessibilityLabel={`重命名对话：${summary.title}`}
          accessibilityRole="button"
          onPress={() => {
            closeSwipeable();
            onRename(summary);
          }}
          style={({ pressed }) => [
            styles.swipeAction,
            styles.swipeRenameAction,
            pressed && styles.swipeActionPressed,
          ]}
        >
          <MaterialIcons name="edit" size={18} color={theme.colors.primary} />
          <Text style={[styles.swipeActionText, styles.swipeRenameActionText]}>
            编辑
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`删除对话：${summary.title}`}
          accessibilityRole="button"
          onPress={() => {
            closeSwipeable();
            onDelete(summary);
          }}
          style={({ pressed }) => [
            styles.swipeAction,
            styles.swipeDeleteAction,
            pressed && styles.swipeActionPressed,
          ]}
        >
          <MaterialIcons
            name="delete-outline"
            size={18}
            color={theme.colors.danger}
          />
          <Text style={[styles.swipeActionText, styles.swipeDeleteActionText]}>
            删除
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      dragOffsetFromLeftEdge={SWIPE_CLOSE_OFFSET_X}
      dragOffsetFromRightEdge={SWIPE_OPEN_OFFSET_X}
      enabled={!isDisabled}
      failOffsetY={[
        -SWIPE_VERTICAL_FAIL_OFFSET_Y,
        SWIPE_VERTICAL_FAIL_OFFSET_Y,
      ]}
      friction={1.18}
      onSwipeableOpenStartDrag={suppressNextPress}
      onSwipeableWillOpen={suppressNextPress}
      overshootFriction={12}
      overshootRight={false}
      renderRightActions={renderSwipeActions}
      rightThreshold={SWIPE_OPEN_THRESHOLD}
    >
      <Pressable
        accessibilityHint="点击继续对话，向左滑动或长按可编辑和删除"
        accessibilityLabel={`继续对话：${summary.title}`}
        accessibilityRole="button"
        disabled={isDisabled}
        onLongPress={handleLongPress}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.row,
          isActive && styles.rowActive,
          pressed && !isDisabled && styles.rowPressed,
          isDisabled && styles.rowDisabled,
        ]}
      >
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {summary.title}
          </Text>
          <Text numberOfLines={2} style={styles.rowPreview}>
            {summary.lastMessagePreview ?? "还没有消息"}
          </Text>
          <Text style={styles.rowMeta}>
            {formatAgentConversationSummaryMeta(summary)}
          </Text>
        </View>
        {isActive ? (
          <MaterialIcons
            name="check-circle"
            size={18}
            color={theme.colors.primary}
          />
        ) : null}
      </Pressable>
    </Swipeable>
  );
}

type ConversationActionSheetProps = {
  onClose: () => void;
  onDelete: (summary: AgentConversationSummary) => void;
  onRename: (summary: AgentConversationSummary) => void;
  summary?: AgentConversationSummary;
  theme: AppTheme;
};

function ConversationActionSheet({
  onClose,
  onDelete,
  onRename,
  summary,
  theme,
}: ConversationActionSheetProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!summary) {
    return null;
  }

  return (
    <View style={styles.dialogOverlay}>
      <Pressable
        accessibilityLabel="关闭对话操作"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.dialogBackdrop}
      />
      <View style={styles.actionSheet}>
        <Text numberOfLines={1} style={styles.actionSheetTitle}>
          {summary.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onRename(summary)}
          style={({ pressed }) => [
            styles.actionSheetButton,
            pressed && styles.actionSheetButtonPressed,
          ]}
        >
          <MaterialIcons name="edit" size={19} color={theme.colors.primary} />
          <Text style={styles.actionSheetButtonText}>重命名</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDelete(summary)}
          style={({ pressed }) => [
            styles.actionSheetButton,
            pressed && styles.actionSheetButtonPressed,
          ]}
        >
          <MaterialIcons
            name="delete-outline"
            size={19}
            color={theme.colors.danger}
          />
          <Text style={[styles.actionSheetButtonText, styles.dangerText]}>
            删除
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type ConversationRenameDialogProps = {
  onCancel: () => void;
  onChangeTitle: (title: string) => void;
  onSubmit: () => void;
  summary?: AgentConversationSummary;
  theme: AppTheme;
  title: string;
};

function ConversationRenameDialog({
  onCancel,
  onChangeTitle,
  onSubmit,
  summary,
  theme,
  title,
}: ConversationRenameDialogProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const canSubmit = title.trim().length > 0;

  if (!summary) {
    return null;
  }

  return (
    <View style={styles.dialogOverlay}>
      <Pressable
        accessibilityLabel="取消重命名"
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.dialogBackdrop}
      />
      <View style={styles.dialogCard}>
        <Text style={styles.dialogTitle}>重命名对话</Text>
        <TextInput
          autoFocus
          maxLength={40}
          onChangeText={onChangeTitle}
          onSubmitEditing={onSubmit}
          placeholder="输入对话标题"
          placeholderTextColor={theme.colors.textSubtle}
          returnKeyType="done"
          style={styles.titleInput}
          value={title}
        />
        <View style={styles.dialogActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [
              styles.dialogSecondaryButton,
              pressed && styles.dialogButtonPressed,
            ]}
          >
            <Text style={styles.dialogSecondaryButtonText}>取消</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.dialogPrimaryButton,
              pressed && canSubmit && styles.dialogButtonPressed,
              !canSubmit && styles.dialogButtonDisabled,
            ]}
          >
            <Text style={styles.dialogPrimaryButtonText}>保存</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type ConversationDeleteDialogProps = {
  onCancel: () => void;
  onSubmit: () => void;
  summary?: AgentConversationSummary;
  theme: AppTheme;
};

function ConversationDeleteDialog({
  onCancel,
  onSubmit,
  summary,
  theme,
}: ConversationDeleteDialogProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!summary) {
    return null;
  }

  return (
    <View style={styles.dialogOverlay}>
      <Pressable
        accessibilityLabel="取消删除对话"
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.dialogBackdrop}
      />
      <View style={styles.dialogCard}>
        <Text style={styles.dialogTitle}>删除对话</Text>
        <Text style={styles.dialogText}>
          确认删除「{summary.title}」吗？删除后不可恢复。
        </Text>
        <View style={styles.dialogActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [
              styles.dialogSecondaryButton,
              pressed && styles.dialogButtonPressed,
            ]}
          >
            <Text style={styles.dialogSecondaryButtonText}>取消</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.dialogDangerButton,
              pressed && styles.dialogButtonPressed,
            ]}
          >
            <Text style={styles.dialogPrimaryButtonText}>删除</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    drawer: {
      width: "100%",
      maxWidth: 380,
      height: "100%",
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 14,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
    drawerHeader: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    drawerMotion: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      width: "90%",
      maxWidth: 380,
    },
    drawerSafeArea: {
      flex: 1,
      alignItems: "flex-end",
    },
    drawerTitle: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.textSubtle,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 36,
    },
    actionSheet: {
      position: "absolute",
      right: 14,
      bottom: 18,
      width: "90%",
      maxWidth: 380,
      gap: 6,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.floating,
    },
    actionSheetButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      borderRadius: theme.radius.md,
    },
    actionSheetButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    actionSheetButtonText: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    actionSheetTitle: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      color: theme.colors.textSubtle,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    dangerText: {
      color: theme.colors.danger,
    },
    dialogActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    dialogBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(0, 0, 0, 0.34)"
          : "rgba(32, 28, 24, 0.16)",
    },
    dialogButtonDisabled: {
      opacity: 0.52,
    },
    dialogButtonPressed: {
      opacity: 0.8,
    },
    dialogCard: {
      position: "absolute",
      right: 18,
      top: "28%",
      width: "90%",
      maxWidth: 380,
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      ...theme.shadow.floating,
    },
    dialogDangerButton: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.danger,
    },
    dialogOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
    },
    dialogPrimaryButton: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    dialogPrimaryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 17,
    },
    dialogSecondaryButton: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    dialogSecondaryButtonText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 17,
    },
    dialogText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 19,
    },
    dialogTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 21,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surfaceMuted,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
      textAlign: "center",
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20,
      textAlign: "center",
    },
    iconButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceMuted,
    },
    iconButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    list: {
      gap: 8,
      paddingBottom: 18,
    },
    modalRoot: {
      flex: 1,
      position: "relative",
    },
    newConversationButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    newConversationButtonPressed: {
      backgroundColor: theme.colors.primaryPressed,
    },
    newConversationText: {
      color: theme.colors.onPrimary,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    row: {
      minHeight: 74,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
    },
    rowActive: {
      borderColor: theme.colors.primaryBorder,
      backgroundColor: theme.colors.primarySoft,
    },
    rowCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    rowDisabled: {
      opacity: 0.58,
    },
    rowMeta: {
      color: theme.colors.textSubtle,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 15,
    },
    rowPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    rowPreview: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    rowTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 18,
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
    },
    swipeAction: {
      width: 62,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: theme.radius.md,
    },
    swipeActionPressed: {
      opacity: 0.78,
    },
    swipeActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 6,
      overflow: "hidden",
      paddingLeft: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.md,
      backgroundColor: "transparent",
    },
    swipeActionText: {
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 14,
    },
    swipeDeleteAction: {
      backgroundColor: theme.colors.dangerSoft,
    },
    swipeDeleteActionText: {
      color: theme.colors.danger,
    },
    swipeRenameAction: {
      backgroundColor: theme.colors.primarySoft,
    },
    swipeRenameActionText: {
      color: theme.colors.primary,
    },
    titleInput: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceMuted,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
      lineHeight: 20,
    },
  });
}
