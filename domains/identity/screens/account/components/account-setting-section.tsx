import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getProfileGlassCardStyle,
  type ProfileGlassSurfaceTone,
} from "@/domains/identity/components/profile-glass-card";
import { useAppTheme } from "@/shared/theme/use-app-theme";

export function AccountSettingSection({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title: string;
  tone: ProfileGlassSurfaceTone;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.settingSectionCard,
        styles.profileGlassCard,
        getProfileGlassCardStyle(tone),
      ]}
    >
      <Text style={[styles.settingSectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

export function AccountSettingRow({
  accentColor,
  description,
  icon,
  isLast,
  onPress,
  status,
  title,
  tone,
}: {
  accentColor?: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  isLast?: boolean;
  onPress?: () => void;
  status?: string;
  title: string;
  tone: ProfileGlassSurfaceTone;
}) {
  const theme = useAppTheme();

  const renderIcon = () => {
    if (icon === "chat") {
      return <FontAwesome name="wechat" size={24} color="#07C160" />;
    }

    return (
      <MaterialIcons
        name={icon}
        size={24}
        color={accentColor ?? theme.colors.text}
      />
    );
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingListRow,
          pressed && onPress
            ? { backgroundColor: tone.pressedBackgroundColor }
            : null,
        ]}
      >
        <View
          style={[
            styles.quickActionIcon,
            { backgroundColor: theme.colors.primarySoft },
          ]}
        >
          {renderIcon()}
        </View>
        <View style={styles.settingCopy}>
          <Text
            style={[
              styles.itemTitle,
              { color: accentColor ?? theme.colors.text },
            ]}
          >
            {title}
          </Text>
          <Text style={[styles.mutedText, { color: theme.colors.textMuted }]}>
            {description}
          </Text>
        </View>
        <View style={styles.settingStatusWrap}>
          {status ? (
            <Text
              style={[
                styles.settingStatusText,
                { color: accentColor ?? theme.colors.textMuted },
              ]}
            >
              {status}
            </Text>
          ) : null}
          {onPress ? (
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={theme.colors.textSubtle}
            />
          ) : null}
        </View>
      </Pressable>
      {!isLast ? (
        <View
          style={[
            styles.settingDivider,
            { backgroundColor: theme.colors.border },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  profileGlassCard: {
    borderWidth: 0,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  settingSectionCard: {
    overflow: "hidden",
    paddingVertical: 12,
    borderRadius: 18,
  },
  settingSectionTitle: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  settingListRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  quickActionIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  settingCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  settingStatusWrap: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 4,
  },
  settingStatusText: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "right",
  },
  settingDivider: {
    height: 1,
    marginLeft: 86,
    opacity: 0.72,
  },
});
