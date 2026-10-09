import type { ViewStyle } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";

type AgentDialogStyleDefinitions = {
  localAgentSheet: ViewStyle;
};

export function createAgentDialogStyles(
  _theme: AppTheme,
): AgentDialogStyleDefinitions {
  return {
    localAgentSheet: {
      margin: 12,
    },
  };
}
