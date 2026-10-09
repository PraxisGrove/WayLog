import type { ComponentProps } from "react";
import type { Trip, TripExpenseEntry } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { ChecklistInputDialog } from "../checklist/checklist-input-dialog";
import { ChecklistSheet } from "../checklist/checklist-sheet";
import { DayDialogs } from "../itinerary/day-dialogs";
import { DayItemDialogs } from "../itinerary/day-item-dialogs";
import { ExpenseLedgerSheet } from "../ledger/expense-ledger-sheet";
import { LedgerDialogs } from "../ledger/ledger-dialogs";
import { MemoInputDialog } from "../memos/memo-input-dialog";
import { PoiSheets } from "../poi/poi-sheets";
import { RouteDialogs } from "../routes/route-dialogs";
import type { createStyles } from "../trip-detail.styles";
import { TripNotebookModal } from "./trip-notebook-modal";

export type TripDetailDialogHostProps = {
  checklist: Omit<
    ComponentProps<typeof ChecklistSheet>,
    "styles" | "theme" | "trip"
  > &
    Omit<ComponentProps<typeof ChecklistInputDialog>, "styles" | "theme">;
  itinerary: Omit<
    ComponentProps<typeof DayDialogs>,
    "styles" | "theme" | "trip"
  > &
    Omit<ComponentProps<typeof DayItemDialogs>, "styles" | "theme" | "trip"> &
    ComponentProps<typeof PoiSheets>;
  ledger: Omit<
    ComponentProps<typeof ExpenseLedgerSheet>,
    "openExpenseEntry" | "styles" | "trip"
  > &
    Omit<ComponentProps<typeof LedgerDialogs>, "styles" | "theme" | "trip">;
  onExpenseEntryPress: (entry: TripExpenseEntry) => void;
  route: Omit<ComponentProps<typeof RouteDialogs>, "styles" | "theme">;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  trip: Trip | null;
  tripInfo: Omit<ComponentProps<typeof MemoInputDialog>, "styles" | "theme"> &
    Pick<
      ComponentProps<typeof TripNotebookModal>,
      "onRequestClose" | "onSave" | "visible"
    >;
  tripPoiNoteLines: ComponentProps<typeof TripNotebookModal>["poiNoteLines"];
};

export function TripDetailDialogHost({
  checklist,
  itinerary,
  ledger,
  onExpenseEntryPress,
  route,
  styles,
  theme,
  trip,
  tripInfo,
  tripPoiNoteLines,
}: TripDetailDialogHostProps) {
  return (
    <>
      <PoiSheets
        activePlaceSearchCenter={itinerary.activePlaceSearchCenter}
        activePlaceSearchDay={itinerary.activePlaceSearchDay}
        activePlaceSearchRegionText={itinerary.activePlaceSearchRegionText}
        addPlaceToActiveDay={itinerary.addPlaceToActiveDay}
        setActivePlaceSearchDayId={itinerary.setActivePlaceSearchDayId}
      />
      <RouteDialogs {...route} styles={styles} theme={theme} />
      <DayDialogs
        activeDayAction={itinerary.activeDayAction}
        closeDayActions={itinerary.closeDayActions}
        deleteActiveDay={itinerary.deleteActiveDay}
        editDayTitle={itinerary.editDayTitle}
        isConfirmingDayDelete={itinerary.isConfirmingDayDelete}
        isEditingDay={itinerary.isEditingDay}
        saveEditedDay={itinerary.saveEditedDay}
        setConfirmingDayDelete={itinerary.setConfirmingDayDelete}
        setEditDayTitle={itinerary.setEditDayTitle}
        startEditingDay={itinerary.startEditingDay}
        styles={styles}
        theme={theme}
        trip={trip}
      />
      <DayItemDialogs
        activeDayItemAction={itinerary.activeDayItemAction}
        closeDayItemActions={itinerary.closeDayItemActions}
        deleteActiveDayItem={itinerary.deleteActiveDayItem}
        editPlaceCost={itinerary.editPlaceCost}
        editPlaceCostError={itinerary.editPlaceCostError}
        editPlaceName={itinerary.editPlaceName}
        editPlaceNote={itinerary.editPlaceNote}
        editPlaceTime={itinerary.editPlaceTime}
        editPlaceTimeError={itinerary.editPlaceTimeError}
        isConfirmingDayItemDelete={itinerary.isConfirmingDayItemDelete}
        isEditingDayItem={itinerary.isEditingDayItem}
        isEditingDayItemTime={itinerary.isEditingDayItemTime}
        isPickingDayItemFormTime={itinerary.isPickingDayItemFormTime}
        openDayItemTimeEditor={itinerary.openDayItemTimeEditor}
        saveEditedDayItem={itinerary.saveEditedDayItem}
        saveEditedDayItemTime={itinerary.saveEditedDayItemTime}
        setConfirmingDayItemDelete={itinerary.setConfirmingDayItemDelete}
        setEditPlaceCost={itinerary.setEditPlaceCost}
        setEditPlaceCostError={itinerary.setEditPlaceCostError}
        setEditPlaceName={itinerary.setEditPlaceName}
        setEditPlaceNote={itinerary.setEditPlaceNote}
        setEditPlaceTime={itinerary.setEditPlaceTime}
        setEditPlaceTimeError={itinerary.setEditPlaceTimeError}
        setPickingDayItemFormTime={itinerary.setPickingDayItemFormTime}
        startEditingDayItem={itinerary.startEditingDayItem}
        styles={styles}
        theme={theme}
        trip={trip}
      />
      <TripNotebookModal
        initialNote={trip?.generalNote}
        onRequestClose={tripInfo.onRequestClose}
        onSave={tripInfo.onSave}
        poiNoteLines={tripPoiNoteLines}
        visible={tripInfo.visible}
      />
      <ExpenseLedgerSheet
        activeExpenseCategoryFilter={ledger.activeExpenseCategoryFilter}
        closeExpenseLedger={ledger.closeExpenseLedger}
        expandedExpenseDayIds={ledger.expandedExpenseDayIds}
        expenseBudgetProgress={ledger.expenseBudgetProgress}
        expenseBudgetStatusText={ledger.expenseBudgetStatusText}
        expenseLedgerDays={ledger.expenseLedgerDays}
        expenseLedgerModalAnim={ledger.expenseLedgerModalAnim}
        expenseSummary={ledger.expenseSummary}
        filteredExpenseEntries={ledger.filteredExpenseEntries}
        isExpenseLedgerOpen={ledger.isExpenseLedgerOpen}
        openBudgetInput={ledger.openBudgetInput}
        openExpenseEntry={onExpenseEntryPress}
        openExpenseInput={ledger.openExpenseInput}
        setActiveExpenseCategoryFilter={ledger.setActiveExpenseCategoryFilter}
        styles={styles}
        toggleExpenseCategoryFilter={ledger.toggleExpenseCategoryFilter}
        toggleExpenseDay={ledger.toggleExpenseDay}
        trip={trip}
        tripTotalCost={ledger.tripTotalCost}
        unassignedExpenseEntries={ledger.unassignedExpenseEntries}
        unassignedExpenseTotal={ledger.unassignedExpenseTotal}
      />
      <ChecklistSheet
        cancelEditingChecklistItem={checklist.cancelEditingChecklistItem}
        checklistModalAnim={checklist.checklistModalAnim}
        closeChecklistNotebook={checklist.closeChecklistNotebook}
        completedChecklistCount={checklist.completedChecklistCount}
        deleteChecklistItem={checklist.deleteChecklistItem}
        deleteSelectedChecklistItems={checklist.deleteSelectedChecklistItems}
        editingChecklistError={checklist.editingChecklistError}
        editingChecklistItemId={checklist.editingChecklistItemId}
        editingChecklistTitle={checklist.editingChecklistTitle}
        isChecklistManageMode={checklist.isChecklistManageMode}
        isChecklistNotebookOpen={checklist.isChecklistNotebookOpen}
        isConfirmingChecklistDelete={checklist.isConfirmingChecklistDelete}
        moveChecklistItem={checklist.moveChecklistItem}
        openChecklistInput={checklist.openChecklistInput}
        saveEditingChecklistItem={checklist.saveEditingChecklistItem}
        selectedChecklistItemIds={checklist.selectedChecklistItemIds}
        setChecklistManageMode={checklist.setChecklistManageMode}
        setConfirmingChecklistDelete={checklist.setConfirmingChecklistDelete}
        setEditingChecklistError={checklist.setEditingChecklistError}
        setEditingChecklistTitle={checklist.setEditingChecklistTitle}
        setSelectedChecklistItemIds={checklist.setSelectedChecklistItemIds}
        startEditingChecklistItem={checklist.startEditingChecklistItem}
        styles={styles}
        theme={theme}
        toggleChecklistItem={checklist.toggleChecklistItem}
        toggleChecklistSelection={checklist.toggleChecklistSelection}
        trip={trip}
      />
      <ChecklistInputDialog
        addCustomChecklistItem={checklist.addCustomChecklistItem}
        closeChecklistInput={checklist.closeChecklistInput}
        customChecklistError={checklist.customChecklistError}
        customChecklistTitle={checklist.customChecklistTitle}
        isAddingChecklistItem={checklist.isAddingChecklistItem}
        setCustomChecklistError={checklist.setCustomChecklistError}
        setCustomChecklistTitle={checklist.setCustomChecklistTitle}
        styles={styles}
        theme={theme}
      />
      <MemoInputDialog
        addCustomMemo={tripInfo.addCustomMemo}
        closeMemoInput={tripInfo.closeMemoInput}
        customMemoDetail={tripInfo.customMemoDetail}
        customMemoError={tripInfo.customMemoError}
        customMemoTitle={tripInfo.customMemoTitle}
        isAddingMemo={tripInfo.isAddingMemo}
        setCustomMemoDetail={tripInfo.setCustomMemoDetail}
        setCustomMemoError={tripInfo.setCustomMemoError}
        setCustomMemoTitle={tripInfo.setCustomMemoTitle}
        styles={styles}
        theme={theme}
      />
      <LedgerDialogs
        activeExpenseAction={ledger.activeExpenseAction}
        budgetAmount={ledger.budgetAmount}
        budgetError={ledger.budgetError}
        clearBudget={ledger.clearBudget}
        closeBudgetInput={ledger.closeBudgetInput}
        closeExpenseActions={ledger.closeExpenseActions}
        closeExpenseInput={ledger.closeExpenseInput}
        deleteActiveExpense={ledger.deleteActiveExpense}
        expenseAmount={ledger.expenseAmount}
        expenseCategory={ledger.expenseCategory}
        expenseDayId={ledger.expenseDayId}
        expenseError={ledger.expenseError}
        expenseNote={ledger.expenseNote}
        expensePlaceId={ledger.expensePlaceId}
        expensePlaceOptions={ledger.expensePlaceOptions}
        expenseTitle={ledger.expenseTitle}
        isAddingExpense={ledger.isAddingExpense}
        isConfirmingExpenseDelete={ledger.isConfirmingExpenseDelete}
        isEditingBudget={ledger.isEditingBudget}
        orderedExpenseCategories={ledger.orderedExpenseCategories}
        saveBudget={ledger.saveBudget}
        saveExpense={ledger.saveExpense}
        setBudgetAmount={ledger.setBudgetAmount}
        setBudgetError={ledger.setBudgetError}
        setConfirmingExpenseDelete={ledger.setConfirmingExpenseDelete}
        setExpenseAmount={ledger.setExpenseAmount}
        setExpenseCategory={ledger.setExpenseCategory}
        setExpenseDayId={ledger.setExpenseDayId}
        setExpenseError={ledger.setExpenseError}
        setExpenseNote={ledger.setExpenseNote}
        setExpensePlaceId={ledger.setExpensePlaceId}
        setExpenseTitle={ledger.setExpenseTitle}
        startEditingExpense={ledger.startEditingExpense}
        styles={styles}
        theme={theme}
        trip={trip}
      />
    </>
  );
}
