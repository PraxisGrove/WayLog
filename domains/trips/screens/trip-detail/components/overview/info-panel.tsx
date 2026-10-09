import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type InfoPanelProps = {
  emptyText: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: {
    id: string;
    title: string;
    detail?: string;
  }[];
  title: string;
};

export function InfoPanel({ emptyText, icon, items, title }: InfoPanelProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.infoPanel}>
      <View style={styles.infoPanelHeader}>
        <MaterialIcons name={icon} size={18} color={theme.colors.primary} />
        <Text style={styles.infoPanelTitle}>{title}</Text>
      </View>
      {items.length > 0 ? (
        items.map((item) => (
          <View key={item.id} style={styles.infoItem}>
            <Text style={styles.infoItemTitle}>{item.title}</Text>
            {item.detail ? (
              <Text style={styles.infoItemDetail}>{item.detail}</Text>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.mutedText}>{emptyText}</Text>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    infoPanel: {
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    infoPanelHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    infoPanelTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    infoItem: {
      gap: 1,
    },
    infoItemTitle: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    infoItemDetail: {
      color: theme.colors.textSubtle,
      fontSize: 12,
      lineHeight: 16,
    },
    mutedText: {
      color: theme.colors.textSubtle,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
