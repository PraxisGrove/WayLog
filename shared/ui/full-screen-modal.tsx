import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/shared/theme/use-app-theme";
import { ScreenHeader } from "./screen-header";

type FullScreenModalProps = {
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  isKeyboardAvoiding?: boolean;
  onRequestClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
};

export function FullScreenModal({
  children,
  contentStyle,
  isKeyboardAvoiding = true,
  onRequestClose,
  subtitle,
  title,
  visible,
}: FullScreenModalProps) {
  const theme = useTheme();
  const content = (
    <>
      <ScreenHeader
        onBack={onRequestClose}
        subtitle={subtitle}
        style={[
          styles.header,
          { paddingHorizontal: theme.tokens.layout.contentPadding },
        ]}
        title={title}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      visible={visible}
    >
      <SafeAreaView
        style={[
          styles.root,
          { backgroundColor: theme.tokens.colors.background },
        ]}
      >
        {isKeyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardRoot}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexShrink: 0,
  },
  keyboardRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
});
