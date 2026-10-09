import { StyleSheet } from "react-native";

import type { AppTheme } from "@/shared/theme/theme";
import { createAgentDialogStyles } from "./agent/agent-dialogs.styles";
import { createChecklistStyles } from "./checklist/checklist.styles";
import { createOverviewStyles } from "./components/overview/overview.styles";
import { createDialogStyles } from "./dialogs/dialog.styles";
import { createImmersiveStyles } from "./immersive/immersive.styles";
import { createLedgerStyles } from "./ledger/ledger.styles";
import { createRouteDialogStyles } from "./routes/route-dialogs.styles";

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surfaceMuted,
    },
    ...createImmersiveStyles(theme),
    ...createOverviewStyles(theme),
    ...createAgentDialogStyles(theme),
    ...createChecklistStyles(theme),
    ...createDialogStyles(theme),
    ...createLedgerStyles(theme),
    ...createRouteDialogStyles(theme),
    inlineError: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.dangerSoft,
      borderWidth: 1,
      borderColor: theme.colors.dangerBorder,
    },
    inlineErrorText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: "600",
    },
    overviewReturnButton: {
      minHeight: 34,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.primarySoft,
    },
    overviewReturnButtonPressed: {
      backgroundColor: theme.colors.surfacePressed,
    },
    overviewReturnText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    itemTitle: {
      flexShrink: 1,
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
