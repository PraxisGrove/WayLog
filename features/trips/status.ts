import { compareDateKeys, createDateKey, parseDateKey } from "./date";
import type { Trip, TripStatus } from "./types";

export type TripStatusDisplayLabel = TripStatus | "示例";

export function getTripStatusDisplayLabel(
  trip: Pick<Trip, "id" | "status">,
): TripStatusDisplayLabel {
  return trip.id.startsWith("seed-") ? "示例" : trip.status;
}

export type TripStatusColor = {
  accentBackgroundColor: string;
  accentColor: string;
  backgroundColor: string;
  borderColor?: string;
  color: string;
};

export type TripStatusPalette = {
  completed: {
    background: string;
    border?: string;
    text: string;
  };
  planned: {
    background: string;
    border?: string;
    text: string;
  };
  traveling: {
    background: string;
    border?: string;
    text: string;
  };
};

const statusPalette = {
  completed: {
    background: "#F1F0F5",
    text: "#6B5E7A",
  },
  planned: {
    background: "#CCFBF1",
    text: "#0F766E",
  },
  traveling: {
    background: "#FFF0EB",
    text: "#C2410C",
  },
} as const;

export const tripStatusColors: Record<TripStatus, TripStatusColor> = {
  计划中: {
    accentBackgroundColor: statusPalette.planned.background,
    accentColor: statusPalette.planned.text,
    backgroundColor: statusPalette.planned.background,
    color: statusPalette.planned.text,
  },
  旅途中: {
    accentBackgroundColor: statusPalette.traveling.background,
    accentColor: statusPalette.traveling.text,
    backgroundColor: statusPalette.traveling.background,
    color: statusPalette.traveling.text,
  },
  已完成: {
    accentBackgroundColor: statusPalette.completed.background,
    accentColor: statusPalette.completed.text,
    backgroundColor: statusPalette.completed.background,
    color: statusPalette.completed.text,
  },
};

/** Resolve status colors from the active theme while keeping status meaning stable. */
export function getTripStatusColors(
  status: TripStatus,
  palette?: TripStatusPalette,
): TripStatusColor {
  if (!palette) {
    return tripStatusColors[status];
  }

  const colors =
    status === "计划中"
      ? palette.planned
      : status === "旅途中"
        ? palette.traveling
        : palette.completed;

  return {
    accentBackgroundColor: colors.background,
    accentColor: colors.text,
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  };
}

export function normalizeTripStatus(status: unknown): TripStatus {
  return status === "旅途中" || status === "已完成" ? status : "计划中";
}

export function resolveTripStatusByDate(
  trip: Pick<Trip, "endDate" | "startDate" | "status">,
  currentDate = new Date(),
): TripStatus {
  const currentDateKey = createDateKey(currentDate);
  const startDate =
    trip.startDate && parseDateKey(trip.startDate) ? trip.startDate : undefined;
  const endDate =
    trip.endDate && parseDateKey(trip.endDate) ? trip.endDate : undefined;

  if (endDate && compareDateKeys(currentDateKey, endDate) > 0) {
    return "已完成";
  }

  if (startDate && compareDateKeys(currentDateKey, startDate) < 0) {
    return "计划中";
  }

  if (startDate) {
    return "旅途中";
  }

  return normalizeTripStatus(trip.status);
}

export function applyTripAutoStatus<
  T extends Pick<Trip, "endDate" | "startDate" | "status">,
>(trip: T): T {
  const status = resolveTripStatusByDate(trip);
  return status === trip.status ? trip : { ...trip, status };
}

/**
 * Select the trip shown in the large home ticket.
 *
 * Active trips take priority. Otherwise, select the future trip with the
 * nearest start date. Completed and undated planned trips are never featured.
 */
export function getFeaturedTrip(
  trips: Trip[],
  currentDate = new Date(),
): Trip | undefined {
  const currentDateKey = createDateKey(currentDate);
  const candidates = trips.map((trip, index) => ({
    index,
    status: resolveTripStatusByDate(trip, currentDate),
    trip,
    validStartDate:
      trip.startDate && parseDateKey(trip.startDate)
        ? trip.startDate
        : undefined,
  }));

  const activeTrips = candidates
    .filter((candidate) => candidate.status === "旅途中")
    .sort((left, right) => {
      if (
        left.validStartDate &&
        right.validStartDate &&
        left.validStartDate !== right.validStartDate
      ) {
        return compareDateKeys(right.validStartDate, left.validStartDate);
      }

      if (Boolean(left.validStartDate) !== Boolean(right.validStartDate)) {
        return left.validStartDate ? -1 : 1;
      }

      return left.index - right.index;
    });

  if (activeTrips[0]) {
    return activeTrips[0].trip;
  }

  return candidates
    .filter(
      (candidate) =>
        candidate.status === "计划中" &&
        candidate.validStartDate &&
        compareDateKeys(candidate.validStartDate, currentDateKey) > 0,
    )
    .sort((left, right) => {
      const leftStartDate = left.validStartDate;
      const rightStartDate = right.validStartDate;
      if (!leftStartDate || !rightStartDate) {
        return left.index - right.index;
      }

      const dateComparison = compareDateKeys(leftStartDate, rightStartDate);
      return dateComparison || left.index - right.index;
    })[0]?.trip;
}
