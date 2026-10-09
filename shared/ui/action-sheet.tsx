import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { AppButton } from "./app-button";
import { AppSheet, type AppSheetVariant } from "./app-sheet";

export type ActionSheetItem = {
  description?: string;
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  id: string;
  label: string;
  onPress: () => void;
  tone?: "danger" | "default" | "primary";
};

type ActionSheetProps = {
  cancelLabel?: string;
  description?: string;
  items: ActionSheetItem[];
  onCancel: () => void;
  onRequestClose?: () => void;
  title: string;
  variant?: AppSheetVariant;
  visible: boolean;
};

export function ActionSheet({
  cancelLabel = "取消",
  description,
  items,
  onCancel,
  onRequestClose,
  title,
  variant,
  visible,
}: ActionSheetProps) {
  const theme = useAppTheme();
  const handleRequestClose = onRequestClose ?? onCancel;

  return (
    <AppSheet
      onRequestClose={handleRequestClose}
      title={title}
      description={description}
      variant={variant}
      visible={visible}
    >
      <View style={styles.actions}>
        {items.map((item) => (
          <AppButton
            accessibilityLabel={item.label}
            disabled={item.disabled}
            icon={
              item.icon ? (
                <MaterialIcons
                  name={item.icon}
                  size={18}
                  color={
                    item.tone === "danger"
                      ? theme.colors.danger
                      : item.tone === "primary"
                        ? theme.colors.onPrimary
                        : theme.colors.text
                  }
                />
              ) : undefined
            }
            key={item.id}
            onPress={item.onPress}
            style={styles.actionButton}
            variant={
              item.tone === "danger"
                ? "danger"
                : item.tone === "primary"
                  ? "primary"
                  : "secondary"
            }
          >
            <View style={styles.actionCopy}>
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color:
                      item.tone === "primary"
                        ? theme.colors.onPrimary
                        : item.tone === "danger"
                          ? theme.colors.danger
                          : theme.colors.text,
                  },
                ]}
              >
                {item.label}
              </Text>
              {item.description ? (
                <Text
                  style={[
                    styles.actionDescription,
                    {
                      color:
                        item.tone === "primary"
                          ? theme.colors.onPrimary
                          : theme.colors.textMuted,
                    },
                  ]}
                >
                  {item.description}
                </Text>
              ) : null}
            </View>
          </AppButton>
        ))}
      </View>
      <AppButton onPress={onCancel} title={cancelLabel} variant="ghost" />
      {items.length === 0 ? (
        <Text accessibilityRole="text" style={styles.emptyText}>
          暂无可用操作
        </Text>
      ) : null}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    justifyContent: "flex-start",
    borderWidth: 0,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionDescription: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
});
