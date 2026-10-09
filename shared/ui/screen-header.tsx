import type { ReactNode } from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

import { BACK_BUTTON_SIDE_WIDTH, BackButton } from "./back-button";

type ScreenHeaderProps = {
  accessibilityLabel?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  showBackButton?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({
  accessibilityLabel = "返回",
  onBack,
  rightSlot,
  showBackButton = true,
  style,
  subtitle,
  title,
}: ScreenHeaderProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.root, style]}>
      {showBackButton && onBack ? (
        <BackButton
          accessibilityLabel={accessibilityLabel}
          onPress={onBack}
          style={styles.backButton}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
      <View pointerEvents="none" style={styles.copy}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.textMuted }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.colors.textSubtle }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? (
        <View style={styles.rightSlot}>{rightSlot}</View>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: -4,
    width: BACK_BUTTON_SIDE_WIDTH,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 1,
  },
  placeholder: {
    width: BACK_BUTTON_SIDE_WIDTH,
    height: 34,
  },
  rightSlot: {
    minWidth: BACK_BUTTON_SIDE_WIDTH,
    minHeight: 34,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  root: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
});
