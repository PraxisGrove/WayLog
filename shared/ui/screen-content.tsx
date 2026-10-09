import { type PropsWithChildren, useMemo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type ScreenContentProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function useScreenContentStyle(): ViewStyle {
  const theme = useAppTheme();

  return useMemo(
    () => ({
      alignSelf: "center",
      width: "100%",
      maxWidth: theme.layout.maxContentWidth,
      paddingHorizontal: theme.layout.contentPadding,
    }),
    [theme],
  );
}

export function ScreenContent({ children, style }: ScreenContentProps) {
  const contentStyle = useScreenContentStyle();

  return <View style={[contentStyle, style]}>{children}</View>;
}
