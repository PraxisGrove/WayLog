import type { ReactNode } from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import { ModalTransition } from "@/shared/ui/modal-transition";
import { getRecipeViewStyle } from "@/shared/ui/recipe-style";

export type AppDialogVariant = keyof ComponentRecipes["dialog"];

type AppDialogProps = {
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  description?: string;
  dismissOnBackdropPress?: boolean;
  isDismissDisabled?: boolean;
  onRequestClose?: () => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
  variant?: AppDialogVariant;
  visible: boolean;
};

export function AppDialog({
  children,
  contentStyle,
  description,
  dismissOnBackdropPress = true,
  isDismissDisabled = false,
  onRequestClose,
  style,
  title,
  variant = "default",
  visible,
}: AppDialogProps) {
  const theme = useTheme();
  const recipe = theme.recipes.dialog[variant];

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭弹窗"
      contentStyle={[styles.dialog, getRecipeViewStyle(recipe), style]}
      dismissOnBackdropPress={dismissOnBackdropPress}
      isDismissDisabled={isDismissDisabled}
      onRequestClose={onRequestClose}
      preset="dialog"
      rootStyle={styles.root}
      visible={visible}
    >
      {title ? (
        <Text style={[styles.title, { color: theme.tokens.colors.text }]}>
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text
          style={[styles.description, { color: theme.tokens.colors.textMuted }]}
        >
          {description}
        </Text>
      ) : null}
      {children ? (
        <View style={[styles.content, contentStyle]}>{children}</View>
      ) : null}
    </ModalTransition>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    gap: 14,
    padding: 24,
  },
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
});
