import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import {
  ProfileGlassCard,
  type ProfileGlassSurfaceTone,
} from "@/domains/identity/components/profile-glass-card";
import { profileQuickActions } from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";

export type ProfileQuickActionRoute =
  (typeof profileQuickActions)[number]["route"];

export type ProfileQuickActionCardProps = {
  isCompact: boolean;
  onNavigate: (route: ProfileQuickActionRoute) => void;
  quickActionBarHeight: number;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
  tone: ProfileGlassSurfaceTone;
};

export function ProfileQuickActionCard({
  isCompact,
  onNavigate,
  quickActionBarHeight,
  styles,
  theme,
  tone,
}: ProfileQuickActionCardProps) {
  return (
    <ProfileGlassCard
      tone={tone}
      style={[
        styles.quickActionCard,
        styles.profileGlassCard,
        {
          height: quickActionBarHeight,
          paddingHorizontal: isCompact ? 6 : 8,
        },
      ]}
    >
      {profileQuickActions.map((action) => (
        <Pressable
          accessibilityHint={getQuickActionAccessibilityHint(action.route)}
          accessibilityRole="button"
          key={action.title}
          onPress={() => onNavigate(action.route)}
          style={({ pressed }) => [
            styles.quickActionItem,
            {
              gap: isCompact ? 6 : 8,
              paddingHorizontal: isCompact ? 4 : 6,
            },
            pressed && { backgroundColor: theme.colors.primarySoft },
          ]}
        >
          <View
            style={[
              styles.quickActionIcon,
              {
                width: isCompact ? 36 : 40,
                height: isCompact ? 36 : 40,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primarySoft,
              },
            ]}
          >
            <MaterialIcons
              name={action.icon}
              size={isCompact ? 20 : 21}
              color={theme.colors.primary}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.quickActionTitle,
              {
                color: theme.colors.text,
                fontSize: isCompact ? 12 : 13,
              },
            ]}
          >
            {action.title}
          </Text>
        </Pressable>
      ))}
    </ProfileGlassCard>
  );
}

function getQuickActionAccessibilityHint(route: ProfileQuickActionRoute) {
  if (route === "footprints") {
    return "足迹地图功能将在后续版本开放";
  }

  if (route === "travelJournal") {
    return "旅行手账功能将在后续版本开放";
  }

  return undefined;
}
