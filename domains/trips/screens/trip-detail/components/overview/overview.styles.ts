import type { AppTheme } from "@/shared/theme/theme";
import {
  type ChecklistPreviewStyleDefinitions,
  createChecklistPreviewStyles,
} from "./checklist-preview.styles";
import {
  createLedgerPreviewStyles,
  type LedgerPreviewStyleDefinitions,
} from "./ledger-preview.styles";
import {
  createOverviewShellStyles,
  type OverviewShellStyleDefinitions,
} from "./overview-shell.styles";
import {
  createRouteOverviewStyles,
  type RouteOverviewStyleDefinitions,
} from "./route-overview.styles";
import {
  createSummaryCardStyles,
  type SummaryCardStyleDefinitions,
} from "./summary-card.styles";
import {
  createTripNotebookPreviewStyles,
  type TripNotebookPreviewStyleDefinitions,
} from "./trip-notebook-preview.styles";

export type OverviewStyleDefinitions = OverviewShellStyleDefinitions &
  SummaryCardStyleDefinitions &
  LedgerPreviewStyleDefinitions &
  ChecklistPreviewStyleDefinitions &
  TripNotebookPreviewStyleDefinitions &
  RouteOverviewStyleDefinitions;

export function createOverviewStyles(
  theme: AppTheme,
): OverviewStyleDefinitions {
  return {
    ...createOverviewShellStyles(theme),
    ...createSummaryCardStyles(theme),
    ...createLedgerPreviewStyles(theme),
    ...createChecklistPreviewStyles(theme),
    ...createTripNotebookPreviewStyles(theme),
    ...createRouteOverviewStyles(theme),
  };
}
