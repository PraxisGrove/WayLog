import { Text, View } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";

export type ProfileTripStatItem = {
  label: string;
  value: string;
};

export type ProfileTripStatsProps = {
  items: ProfileTripStatItem[];
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
};

export function ProfileTripStats({
  items,
  styles,
  theme,
}: ProfileTripStatsProps) {
  return (
    <View style={styles.profileStats}>
      {items.map((item) => (
        <View key={item.label} style={styles.profileStatItem}>
          <Text numberOfLines={1} style={styles.profileStatLabel}>
            {item.label}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.profileStatValue, { color: theme.colors.text }]}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
