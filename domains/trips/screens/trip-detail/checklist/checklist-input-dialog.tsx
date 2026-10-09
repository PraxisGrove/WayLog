import type { Dispatch, SetStateAction } from "react";
import { Text, TextInput, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { FormSheet } from "@/shared/ui/form-sheet";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type ChecklistInputDialogProps = {
  addCustomChecklistItem: () => void | Promise<void>;
  closeChecklistInput: () => void;
  customChecklistError: string;
  customChecklistTitle: string;
  isAddingChecklistItem: boolean;
  setCustomChecklistError: Dispatch<SetStateAction<string>>;
  setCustomChecklistTitle: Dispatch<SetStateAction<string>>;
  styles: TripDetailStyles;
  theme: AppTheme;
};

export function ChecklistInputDialog({
  addCustomChecklistItem,
  closeChecklistInput,
  customChecklistError,
  customChecklistTitle,
  isAddingChecklistItem,
  setCustomChecklistError,
  setCustomChecklistTitle,
  styles,
  theme,
}: ChecklistInputDialogProps) {
  return (
    <FormSheet
      confirmLabel="添加"
      isProcessing={false}
      onRequestClose={closeChecklistInput}
      onCancel={closeChecklistInput}
      onConfirm={() => {
        void addCustomChecklistItem();
      }}
      title="添加物品"
      visible={isAddingChecklistItem}
    >
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>物品名称</Text>
        <TextInput
          autoFocus
          onChangeText={(value) => {
            setCustomChecklistTitle(value);
            setCustomChecklistError("");
          }}
          placeholder="例如：护照"
          placeholderTextColor={theme.colors.placeholder}
          style={styles.textInput}
          value={customChecklistTitle}
        />
      </View>

      {customChecklistError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{customChecklistError}</Text>
        </View>
      ) : null}
    </FormSheet>
  );
}
