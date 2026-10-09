import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import {
  getRecipeTextStyle,
  getRecipeViewStyle,
} from "@/shared/ui/recipe-style";

export type AppFeedbackTone = keyof ComponentRecipes["feedback"];

type AppFeedbackProps = {
  actionLabel?: string;
  message: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
  tone?: AppFeedbackTone;
};

const toneIconName: Record<
  AppFeedbackTone,
  keyof typeof MaterialIcons.glyphMap
> = {
  danger: "error-outline",
  info: "info-outline",
  success: "check-circle-outline",
  warning: "warning",
};

export function AppFeedback({
  actionLabel,
  message,
  onActionPress,
  style,
  title,
  tone = "info",
}: AppFeedbackProps) {
  const theme = useTheme();
  const recipe = theme.recipes.feedback[tone];
  const contentColor = recipe.color ?? theme.tokens.colors.text;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.feedback, getRecipeViewStyle(recipe), style]}
    >
      <MaterialIcons name={toneIconName[tone]} size={18} color={contentColor} />
      <View style={styles.copy}>
        {title ? (
          <Text
            style={[
              styles.title,
              getRecipeTextStyle(recipe, theme.tokens.colors.text),
            ]}
          >
            {title}
          </Text>
        ) : null}
        <Text
          style={[styles.message, { color: theme.tokens.colors.textMuted }]}
        >
          {message}
        </Text>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={styles.action}
        >
          <Text style={[styles.actionText, { color: contentColor }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignSelf: "flex-start",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  feedback: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
});
