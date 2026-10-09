import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

type EmptyStateProps = {
  actionLabel?: string;
  description: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
};

export function EmptyState({
  actionLabel,
  description,
  icon,
  onActionPress,
  style,
  title,
}: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.root, style]}>
      {icon ? (
        <MaterialIcons name={icon} size={28} color={theme.colors.textSubtle} />
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.description, { color: theme.colors.textMuted }]}>
          {description}
        </Text>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.sm,
            },
            pressed && { backgroundColor: theme.colors.primaryPressed },
          ]}
        >
          <Text style={[styles.actionText, { color: theme.colors.onPrimary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "flex-start",
    gap: 10,
  },
  copy: {
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
