import type { TripDetailDialogHostProps } from "@/domains/trips/screens/trip-detail/components/trip-detail-dialog-host";
import type { useTripInfoActions } from "@/domains/trips/screens/trip-detail/hooks/info/use-trip-info-actions";
import type { useRouteActions } from "@/domains/trips/screens/trip-detail/hooks/routes/use-route-actions";
import type { useTripRouteSegments } from "@/domains/trips/screens/trip-detail/hooks/routes/use-trip-route-segments";

type TripInfoActions = ReturnType<typeof useTripInfoActions>;
type RouteActions = ReturnType<typeof useRouteActions>;
type TripRouteSegments = ReturnType<typeof useTripRouteSegments>;
type DialogHostControllerProps = Omit<TripDetailDialogHostProps, "agent">;

type UseTripDetailDialogControllerParams = Pick<
  DialogHostControllerProps,
  | "checklist"
  | "itinerary"
  | "ledger"
  | "onExpenseEntryPress"
  | "styles"
  | "theme"
  | "trip"
  | "tripPoiNoteLines"
> & {
  routeActions: RouteActions;
  routeSegments: TripRouteSegments;
  tripInfo: TripInfoActions;
};

export function useTripDetailDialogController({
  checklist,
  itinerary,
  ledger,
  onExpenseEntryPress,
  routeActions,
  routeSegments,
  styles,
  theme,
  trip,
  tripInfo,
  tripPoiNoteLines,
}: UseTripDetailDialogControllerParams) {
  const dialogHostProps: DialogHostControllerProps = {
    checklist,
    itinerary,
    ledger,
    onExpenseEntryPress,
    route: {
      activeRouteSegment: routeActions.activeRouteSegment,
      activeRouteSegmentMode: routeActions.activeRouteSegmentMode,
      activeRouteSegmentResult: routeActions.activeRouteSegmentResult,
      activeRouteUserMessage: routeActions.activeRouteUserMessage,
      closeRoutePreferenceEditor: routeActions.closeRoutePreferenceEditor,
      closeRouteSegmentActions: routeActions.closeRouteSegmentActions,
      isActiveRouteSegmentModePending:
        routeActions.isActiveRouteSegmentModePending,
      isEditingRoutePreference: routeActions.isEditingRoutePreference,
      openRoutePreferenceEditor: routeActions.openRoutePreferenceEditor,
      routeModePendingCounts: routeSegments.routeModePendingCounts,
      routeModePendingIntents: routeSegments.routeModePendingIntents,
      routeNavigationError: routeActions.routeNavigationError,
      routePreference: routeSegments.routePreference,
      routePreferenceError: routeSegments.routePreferenceError,
      selectRouteSegmentMode: routeActions.selectRouteSegmentMode,
      startActiveRouteNavigation: routeActions.startActiveRouteNavigation,
      updateRoutePreference: routeSegments.updateRoutePreference,
    },
    styles,
    theme,
    trip,
    tripInfo: {
      addCustomMemo: tripInfo.addCustomMemo,
      closeMemoInput: tripInfo.closeMemoInput,
      customMemoDetail: tripInfo.customMemoDetail,
      customMemoError: tripInfo.customMemoError,
      customMemoTitle: tripInfo.customMemoTitle,
      isAddingMemo: tripInfo.isAddingMemo,
      onRequestClose: tripInfo.closeTripNotebook,
      onSave: tripInfo.saveTripNotebook,
      setCustomMemoDetail: tripInfo.setCustomMemoDetail,
      setCustomMemoError: tripInfo.setCustomMemoError,
      setCustomMemoTitle: tripInfo.setCustomMemoTitle,
      visible: tripInfo.isTripNotebookOpen,
    },
    tripPoiNoteLines,
  };

  return {
    dialogHostProps,
  };
}
