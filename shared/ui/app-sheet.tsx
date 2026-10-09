import type { ReactNode } from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import { ModalTransition } from "@/shared/ui/modal-transition";
import { getRecipeViewStyle } from "@/shared/ui/recipe-style";

export type AppSheetVariant = keyof ComponentRecipes["sheet"];

type AppSheetProps = {
  children?: ReactNode;
  description?: string;
  dismissOnBackdropPress?: boolean;
  headerStyle?: StyleProp<ViewStyle>;
  isDismissDisabled?: boolean;
  onRequestClose?: () => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
  variant?: AppSheetVariant;
  visible?: boolean;
};

export function AppSheet({
  children,
  description,
  dismissOnBackdropPress = true,
  headerStyle,
  isDismissDisabled = false,
  onRequestClose,
  style,
  title,
  titleStyle,
  variant = "default",
  visible,
}: AppSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const recipe = theme.recipes.sheet[variant];

  const sheet = (
    <View
      style={[
        styles.sheet,
        getRecipeViewStyle(recipe),
        visible !== undefined && {
          paddingBottom: Math.max(insets.bottom, 16),
        },
        style,
      ]}
    >
      {title || description ? (
        <View style={[styles.header, headerStyle]}>
          {title ? (
            <Text
              style={[
                styles.title,
                { color: theme.tokens.colors.text },
                titleStyle,
              ]}
            >
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text
              style={[
                styles.description,
                { color: theme.tokens.colors.textMuted },
              ]}
            >
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  if (visible === undefined) {
    return sheet;
  }

  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭底部面板"
      contentStyle={[
        styles.sheetDock,
        {
          maxWidth: theme.tokens.layout.maxContentWidth,
          paddingHorizontal: theme.tokens.layout.contentPadding,
        },
      ]}
      dismissOnBackdropPress={dismissOnBackdropPress}
      isDismissDisabled={isDismissDisabled}
      keyboardAvoiding
      onRequestClose={onRequestClose}
      preset="sheet"
      rootStyle={styles.modalRoot}
      visible={visible}
    >
      {sheet}
    </ModalTransition>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  header: {
    gap: 3,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    minWidth: 0,
    gap: 16,
    padding: 18,
  },
  sheetDock: {
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
});
