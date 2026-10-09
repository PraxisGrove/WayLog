import { forwardRef } from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import type { ComponentRecipes } from "@/shared/theme/types";
import { useTheme } from "@/shared/theme/use-app-theme";
import {
  getRecipeInputStyle,
  getRecipeTextStyle,
} from "@/shared/ui/recipe-style";

export type AppInputVariant = keyof ComponentRecipes["input"];

type AppInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  errorText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
  variant?: AppInputVariant;
};

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  {
    containerStyle,
    editable = true,
    errorText,
    inputStyle,
    label,
    placeholderTextColor,
    style,
    variant = errorText ? "error" : "default",
    ...props
  },
  ref,
) {
  const theme = useTheme();
  const recipe = theme.recipes.input[variant];

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: theme.tokens.colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        editable={editable}
        placeholderTextColor={
          placeholderTextColor ?? theme.tokens.colors.placeholder
        }
        style={[
          styles.input,
          getRecipeInputStyle(recipe),
          getRecipeTextStyle(recipe, theme.tokens.colors.text),
          !editable ? styles.disabled : null,
          style,
          inputStyle,
        ]}
        {...props}
      />
      {errorText ? (
        <Text style={[styles.errorText, { color: theme.tokens.colors.danger }]}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    gap: 7,
  },
  disabled: {
    opacity: 0.56,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  input: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
});
