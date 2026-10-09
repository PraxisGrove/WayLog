import type { Dispatch, SetStateAction } from "react";
import { Text, TextInput, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { FormSheet } from "@/shared/ui/form-sheet";
import type { createStyles } from "../trip-detail.styles";

type TripDetailStyles = ReturnType<typeof createStyles>;

type MemoInputDialogProps = {
  addCustomMemo: () => void | Promise<void>;
  closeMemoInput: () => void;
  customMemoDetail: string;
  customMemoError: string;
  customMemoTitle: string;
  isAddingMemo: boolean;
  setCustomMemoDetail: Dispatch<SetStateAction<string>>;
  setCustomMemoError: Dispatch<SetStateAction<string>>;
  setCustomMemoTitle: Dispatch<SetStateAction<string>>;
  styles: TripDetailStyles;
  theme: AppTheme;
};

export function MemoInputDialog({
  addCustomMemo,
  closeMemoInput,
  customMemoDetail,
  customMemoError,
  customMemoTitle,
  isAddingMemo,
  setCustomMemoDetail,
  setCustomMemoError,
  setCustomMemoTitle,
  styles,
  theme,
}: MemoInputDialogProps) {
  return (
    <FormSheet
      confirmLabel="添加"
      onRequestClose={closeMemoInput}
      onCancel={closeMemoInput}
      onConfirm={() => {
        void addCustomMemo();
      }}
      title="添加备忘"
      visible={isAddingMemo}
    >
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>标题</Text>
        <TextInput
          autoFocus
          onChangeText={(value) => {
            setCustomMemoTitle(value);
            setCustomMemoError("");
          }}
          placeholder="例如：证件 / 航班 / 注意事项"
          placeholderTextColor={theme.colors.placeholder}
          style={styles.textInput}
          value={customMemoTitle}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>内容</Text>
        <TextInput
          multiline
          onChangeText={(value) => {
            setCustomMemoDetail(value);
            setCustomMemoError("");
          }}
          placeholder="例如：护照放随身包，航班起飞前 2 小时到机场"
          placeholderTextColor={theme.colors.placeholder}
          style={[styles.textInput, styles.textArea]}
          value={customMemoDetail}
        />
      </View>

      {customMemoError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{customMemoError}</Text>
        </View>
      ) : null}
    </FormSheet>
  );
}
