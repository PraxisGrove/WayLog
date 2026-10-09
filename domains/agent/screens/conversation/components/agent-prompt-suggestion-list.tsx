import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type PromptSuggestion = {
  description: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  text: string;
};

const promptSuggestions: PromptSuggestion[] = [
  {
    description: "说出目的地和天数，我会先搭一个可编辑草案",
    icon: "map",
    label: "先说要去的城市",
    text: "帮我规划云南 4 日游",
  },
  {
    description: "把地点、哪条行程、哪一天说清楚，我再去查真实地点",
    icon: "add-location-alt",
    label: "加地点要带行程和日期",
    text: "把云南大学加入云南三日第四天",
  },
  {
    description: "想移动、删除或改备注，先说动作和目标，我会列出影响范围",
    icon: "edit-calendar",
    label: "调整说清动作和目标",
    text: "删除云南三日第一天的一个地点",
  },
];

export function AgentPromptSuggestionList() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.welcomePrompts}>
      {promptSuggestions.map((suggestion) => (
        <View key={suggestion.text} style={styles.welcomePromptRow}>
          <View style={styles.welcomePromptIcon}>
            <MaterialIcons
              name={suggestion.icon}
              size={17}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.welcomePromptCopy}>
            <Text style={styles.welcomePromptLabel}>{suggestion.label}</Text>
            <Text style={styles.welcomePromptExample}>{suggestion.text}</Text>
            <Text numberOfLines={2} style={styles.welcomePromptText}>
              {suggestion.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    welcomePrompts: {
      gap: 10,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    welcomePromptRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 0,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
    },
    welcomePromptIcon: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: theme.colors.primarySoft,
    },
    welcomePromptCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    welcomePromptLabel: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    welcomePromptExample: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 19,
    },
    welcomePromptText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
  });
}
