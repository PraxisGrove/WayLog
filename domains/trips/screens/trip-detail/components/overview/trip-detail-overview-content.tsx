import type { ComponentProps } from "react";
import { View } from "react-native";

import type { Trip } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useSkinSlot } from "@/shared/theme/use-app-theme";
import type {
  TripDetailOverviewLayout,
  TripDetailOverviewModuleId,
} from "../../detail-layout-preset";
import type { createStyles } from "../../trip-detail.styles";
import { ChecklistPreviewCard } from "./checklist-preview-card";
import { ExpensePreviewCard } from "./expense-preview-card";
import { RouteOverviewCard } from "./route-overview-card";
import { TravelInfoSection } from "./travel-info-section";
import { TripNotebookPreviewCard } from "./trip-notebook-preview-card";
import { TripOverviewSummaryCard } from "./trip-overview-summary-card";

type ChecklistPreviewCardProps = ComponentProps<typeof ChecklistPreviewCard>;
type ExpensePreviewCardProps = ComponentProps<typeof ExpensePreviewCard>;
type RouteOverviewCardProps = ComponentProps<typeof RouteOverviewCard>;

export type TripDetailOverviewContentProps = {
  checklist: {
    completedChecklistCount: number;
    handleNotebookPreviewTouchCancel: ChecklistPreviewCardProps["onTouchCancel"];
    handleNotebookPreviewTouchEnd: ChecklistPreviewCardProps["onTouchEnd"];
    handleNotebookPreviewTouchMove: ChecklistPreviewCardProps["onTouchMove"];
    handleNotebookPreviewTouchStart: ChecklistPreviewCardProps["onTouchStart"];
    openChecklistNotebook: () => void;
  };
  ledger: {
    expensePreviewEntries: ExpensePreviewCardProps["entries"];
    expenseSummary: ExpensePreviewCardProps["summary"];
    openExpenseInput: () => void;
    openExpenseLedger: () => void;
    tripTotalCost: number;
  };
  layout: TripDetailOverviewLayout;
  noteLineCount: number;
  onAddMemoPress: () => void;
  onEditPress: () => void;
  onOpenAgentPress: () => void;
  onOpenTripNotebook: () => void;
  onPlacePress: RouteOverviewCardProps["onPlacePress"];
  routeOverviewDays: RouteOverviewCardProps["days"];
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  trip: Trip;
  tripNotebookPreviewLines: string[];
};

export function TripDetailOverviewContent({
  checklist,
  layout,
  ledger,
  noteLineCount,
  onAddMemoPress,
  onEditPress,
  onOpenAgentPress,
  onOpenTripNotebook,
  onPlacePress,
  routeOverviewDays,
  styles,
  theme,
  trip,
  tripNotebookPreviewLines,
}: TripDetailOverviewContentProps) {
  const checklistPreviewSlot = useSkinSlot("tripDetail.checklistPreview");
  const ledgerPreviewSlot = useSkinSlot("tripDetail.ledgerPreview");

  const renderOverviewModule = (moduleId: TripDetailOverviewModuleId) => {
    switch (moduleId) {
      case "summary":
        return (
          <TripOverviewSummaryCard
            onEditPress={onEditPress}
            onOpenAgentPress={onOpenAgentPress}
            styles={styles}
            theme={theme}
            totalCost={ledger.tripTotalCost}
            trip={trip}
          />
        );
      case "quickStats":
        return (
          <View style={styles.overviewSquareGrid}>
            <ExpensePreviewCard
              adapterId={ledgerPreviewSlot.adapterId}
              currency={trip.currency}
              entries={ledger.expensePreviewEntries}
              onAddExpense={ledger.openExpenseInput}
              onOpenLedger={ledger.openExpenseLedger}
              styles={styles}
              summary={ledger.expenseSummary}
              totalCost={ledger.tripTotalCost}
            />

            <ChecklistPreviewCard
              adapterId={checklistPreviewSlot.adapterId}
              completedCount={checklist.completedChecklistCount}
              items={trip.checklistItems}
              onOpenChecklist={checklist.openChecklistNotebook}
              onTouchCancel={checklist.handleNotebookPreviewTouchCancel}
              onTouchEnd={checklist.handleNotebookPreviewTouchEnd}
              onTouchMove={checklist.handleNotebookPreviewTouchMove}
              onTouchStart={checklist.handleNotebookPreviewTouchStart}
              styles={styles}
              theme={theme}
            />
          </View>
        );
      case "notebook":
        return (
          <TripNotebookPreviewCard
            noteLineCount={noteLineCount}
            onPress={onOpenTripNotebook}
            previewLines={tripNotebookPreviewLines}
            styles={styles}
          />
        );
      case "route":
        return (
          <RouteOverviewCard
            days={routeOverviewDays}
            onPlacePress={onPlacePress}
            styles={styles}
            theme={theme}
            trip={trip}
          />
        );
      case "travelInfo":
        return (
          <TravelInfoSection
            onAddMemoPress={onAddMemoPress}
            styles={styles}
            theme={theme}
            trip={trip}
          />
        );
    }
  };

  return (
    <View style={styles.overviewPage}>
      {layout.moduleOrder.map((moduleId) => (
        <View key={moduleId}>{renderOverviewModule(moduleId)}</View>
      ))}
    </View>
  );
}
