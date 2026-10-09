import type { ComponentProps } from "react";
import type { Trip } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import type { createStyles } from "../../trip-detail.styles";
import { TripDetailDayTabs } from "../day-tabs";
import type { TripDetailOverviewContentProps } from "./trip-detail-overview-content";
import { TripDetailScrollContent } from "./trip-detail-scroll-content";

type TripDetailDayTabsProps = ComponentProps<typeof TripDetailDayTabs>;

export type TripDetailScrollSectionProps = {
  actionError?: string;
  bottomInset: number;
  checklist: TripDetailOverviewContentProps["checklist"];
  dayTabs: {
    onAddDay: TripDetailDayTabsProps["onAddDay"];
    onContentWidthChange: TripDetailDayTabsProps["onContentWidthChange"];
    onDayLayout: TripDetailDayTabsProps["onDayLayout"];
    onDayLongPress: TripDetailDayTabsProps["onDayLongPress"];
    onDayPress: TripDetailDayTabsProps["onDayPress"];
    onOverviewPress: TripDetailDayTabsProps["onOverviewPress"];
    onViewportWidthChange: TripDetailDayTabsProps["onViewportWidthChange"];
    scrollRef: TripDetailDayTabsProps["scrollRef"];
  };
  error?: string;
  isDayRouteLoading: boolean;
  isDraggingSelectedDayItem: boolean;
  isLoading: boolean;
  isOverviewSelected: boolean;
  ledger: TripDetailOverviewContentProps["ledger"];
  layout: TripDetailOverviewContentProps["layout"];
  noteLineCount: number;
  onAddMemoPress: () => void;
  onBackPress: () => void;
  onEditPress: () => void;
  onOpenAgentPress: () => void;
  onOpenTripNotebook: () => void;
  onOverviewPress: () => void;
  onPlacePress: TripDetailOverviewContentProps["onPlacePress"];
  routeOverviewDays: TripDetailOverviewContentProps["routeOverviewDays"];
  selectedDayId?: string;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  topInset: number;
  trip: Trip | null;
  tripNotebookPreviewLines: string[];
};

export function TripDetailScrollSection({
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
  noteLineCount,
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
}: TripDetailScrollSectionProps) {
  const dayTabsContent = trip ? (
    <TripDetailDayTabs
      isOverviewSelected={isOverviewSelected}
      onAddDay={dayTabs.onAddDay}
      onContentWidthChange={dayTabs.onContentWidthChange}
      onDayLayout={dayTabs.onDayLayout}
      onDayLongPress={dayTabs.onDayLongPress}
      onDayPress={dayTabs.onDayPress}
      onOverviewPress={dayTabs.onOverviewPress}
      onViewportWidthChange={dayTabs.onViewportWidthChange}
      scrollRef={dayTabs.scrollRef}
      selectedDayId={selectedDayId}
      styles={styles}
      theme={theme}
      trip={trip}
    />
  ) : null;

  return (
    <TripDetailScrollContent
      actionError={actionError}
      bottomInset={bottomInset}
      dayTabsContent={dayTabsContent}
      error={error}
      isDayRouteLoading={isDayRouteLoading}
      isDraggingSelectedDayItem={isDraggingSelectedDayItem}
      isLoading={isLoading}
      isOverviewSelected={isOverviewSelected}
      onBackPress={onBackPress}
      onOverviewPress={onOverviewPress}
      overviewProps={
        trip
          ? {
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
            }
          : undefined
      }
      styles={styles}
      theme={theme}
      topInset={topInset}
      trip={trip}
    />
  );
}
