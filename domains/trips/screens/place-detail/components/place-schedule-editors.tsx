import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";

type ScheduleNoteEditorProps = {
  hasChanges: boolean;
  isSaving: boolean;
  label: string;
  onChangeText: (value: string) => void;
  onSave: () => void;
  value: string;
};

type ScheduleCostEditorProps = {
  error?: string;
  hasChanges: boolean;
  isSaving: boolean;
  label: string;
  onCancel: () => void;
  onChangeText: (value: string) => void;
  onSave: () => Promise<boolean>;
  savedValue: string;
  value: string;
};
export function ScheduleCostEditor({
  error,
  hasChanges,
  isSaving,
  label,
  onCancel,
  onChangeText,
  onSave,
  savedValue,
  styles,
  value,
}: ScheduleCostEditorProps & {
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  const [isEditing, setIsEditing] = useState(false);
  const isDisabled = !hasChanges || isSaving;
  const actionLabel = hasChanges
    ? "继续编辑"
    : savedValue === "待记录"
      ? "记录"
      : "修改";

  const handleCancel = () => {
    onCancel();
    setIsEditing(false);
  };

  const handleSave = async () => {
    const didSave = await onSave();

    if (didSave) {
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <Pressable
        accessibilityHint="点击后输入这次地点花费"
        accessibilityLabel={`${label}，${savedValue}`}
        accessibilityRole="button"
        onPress={() => setIsEditing(true)}
        style={({ pressed }) => [
          styles.detailRow,
          styles.costCollapsedRow,
          pressed && styles.costCollapsedRowPressed,
        ]}
      >
        <View style={styles.detailIcon}>
          <MaterialIcons
            name="payments"
            size={18}
            color={theme.colors.success}
          />
        </View>
        <View style={styles.detailCopy}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{savedValue}</Text>
        </View>
        <View style={styles.costCollapsedAction}>
          {hasChanges ? (
            <Text style={styles.noteUnsavedText}>未保存</Text>
          ) : null}
          <View style={styles.costCollapsedActionLine}>
            <Text style={styles.costCollapsedActionText}>{actionLabel}</Text>
            <MaterialIcons
              name="chevron-right"
              size={18}
              color={theme.colors.primary}
            />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <MaterialIcons name="payments" size={18} color={theme.colors.success} />
      </View>
      <View style={styles.detailCopy}>
        <View style={styles.costInlineHeader}>
          <View style={styles.costInlineTitle}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{savedValue}</Text>
          </View>
          {hasChanges ? (
            <Text style={styles.noteUnsavedText}>未保存</Text>
          ) : null}
        </View>
        <View style={styles.costInlineRow}>
          <Text style={styles.costPrefix}>¥</Text>
          <TextInput
            accessibilityLabel={label}
            keyboardType="decimal-pad"
            onChangeText={onChangeText}
            placeholder="例如：128"
            style={styles.costInlineInput}
            value={value}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.costInlineSaveButton,
              isDisabled && styles.costInlineSaveButtonDisabled,
              pressed && !isDisabled ? styles.noteSaveButtonPressed : null,
            ]}
          >
            <Text
              style={[
                styles.costInlineSaveButtonText,
                isDisabled && styles.noteSaveButtonTextDisabled,
              ]}
            >
              {isSaving ? "保存中" : "保存"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.costInlineCancelButton,
              pressed && !isSaving ? styles.noteSaveButtonPressed : null,
            ]}
          >
            <Text style={styles.costInlineCancelButtonText}>取消</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.costErrorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

export function ScheduleNoteEditor({
  hasChanges,
  isSaving,
  label,
  onChangeText,
  onSave,
  styles,
  value,
}: ScheduleNoteEditorProps & {
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  const isDisabled = !hasChanges || isSaving;

  return (
    <View style={styles.noteBlock}>
      <View style={styles.noteHeader}>
        <Text style={styles.detailLabel}>{label}</Text>
        {hasChanges ? <Text style={styles.noteUnsavedText}>未保存</Text> : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        multiline
        onChangeText={onChangeText}
        placeholder="记录当天提醒、地址细节或现场要做的事"
        style={styles.noteInput}
        textAlignVertical="top"
        value={value}
      />
      <View style={styles.noteActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={onSave}
          style={({ pressed }) => [
            styles.noteSaveButton,
            isDisabled && styles.noteSaveButtonDisabled,
            pressed && !isDisabled ? styles.noteSaveButtonPressed : null,
          ]}
        >
          <MaterialIcons
            name="save"
            size={16}
            color={
              isDisabled ? theme.colors.disabledText : theme.colors.onPrimary
            }
          />
          <Text
            style={[
              styles.noteSaveButtonText,
              isDisabled && styles.noteSaveButtonTextDisabled,
            ]}
          >
            {isSaving ? "保存中" : "保存"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
