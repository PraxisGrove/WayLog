import { useMemo } from "react";

import type { TripDetailScrollSectionProps } from "@/domains/trips/screens/trip-detail/components/overview/trip-detail-scroll-section";
import {
  formatDayTabDate,
  getTripPoiNoteLines,
  type Trip,
  type TripPlace,
} from "@/features/trips";

type UseTripDetailOverviewControllerParams = Pick<
  TripDetailScrollSectionProps,
  | "actionError"
  | "bottomInset"
  | "checklist"
  | "dayTabs"
  | "error"
  | "isDayRouteLoading"
  | "isDraggingSelectedDayItem"
  | "isLoading"
  | "isOverviewSelected"
  | "layout"
  | "ledger"
  | "onAddMemoPress"
  | "onBackPress"
  | "onEditPress"
  | "onOpenAgentPress"
  | "onOpenTripNotebook"
  | "onOverviewPress"
  | "onPlacePress"
  | "selectedDayId"
  | "styles"
  | "theme"
  | "topInset"
> & {
  trip: Trip | null;
};

export function useTripDetailOverviewController({
  actionError,
  bottomInset,
  checklist,
  dayTabs,
  error,
  isDayRouteLoading,
  isDraggingSelectedDayItem,
  isLoading,
  isOverviewSelected,
  layout,
  ledger,
  onAddMemoPress,
  onBackPress,
  onEditPress,
  onOpenAgentPress,
  onOpenTripNotebook,
  onOverviewPress,
  onPlacePress,
  selectedDayId,
  styles,
  theme,
  topInset,
  trip,
}: UseTripDetailOverviewControllerParams) {
  const tripPoiNoteLines = useMemo(
    () => (trip ? getTripPoiNoteLines(trip) : []),
    [trip],
  );

  const routeOverviewDays = useMemo(() => {
    if (!trip) {
      return [];
    }

    return trip.days
      .map((day) => {
        const dayPlaces = day.items
          .map((item) => trip.places.find((place) => place.id === item.placeId))
          .filter((place): place is TripPlace => Boolean(place));

        return {
          day,
          dayDate: formatDayTabDate(trip, day),
          dayPlaces,
        };
      })
      .filter(({ dayPlaces }) => dayPlaces.length > 0);
  }, [trip]);

  const tripNotebookPreviewLines = useMemo(() => {
    const lines: string[] = [];
    const generalNote = trip?.generalNote?.trim();

    if (generalNote) {
      lines.push(generalNote);
    }

    for (const line of tripPoiNoteLines) {
      lines.push(`${line.placeName}：${line.note}`);
    }

    return lines.slice(0, 3);
  }, [trip?.generalNote, tripPoiNoteLines]);

  const scrollSectionProps: TripDetailScrollSectionProps = {
    actionError,
    bottomInset,
    checklist,
    dayTabs,
    error,
    isDayRouteLoading,
    isDraggingSelectedDayItem,
    isLoading,
    isOverviewSelected,
    layout,
    ledger,
    noteLineCount: tripPoiNoteLines.length,
    onAddMemoPress,
    onBackPress,
    onEditPress,
    onOpenAgentPress,
    onOpenTripNotebook,
    onOverviewPress,
    onPlacePress,
    routeOverviewDays,
    selectedDayId,
    styles,
    theme,
    topInset,
    trip,
    tripNotebookPreviewLines,
  };

  return {
    scrollSectionProps,
    tripPoiNoteLines,
  };
}
