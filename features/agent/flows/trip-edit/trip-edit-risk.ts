import type { Trip } from "../../../trips/types";
import type { TripEditOperation } from "../../contracts/trip-edit-proposal-contract";

export type TripEditOperationFact = {
  operationId: string;
  reasonCode:
    | "bounded_day_title_update"
    | "bounded_item_update"
    | "destructive_item_removal"
    | "itinerary_day_expansion"
    | "itinerary_reorder"
    | "verified_poi_addition";
  risk: "high" | "low" | "medium";
  type: TripEditOperation["type"];
};

type TripEditRiskOperation =
  | {
      operationId: string;
      type: Exclude<TripEditOperation["type"], "ensure_trip_day_count">;
    }
  | {
      dayCount: number;
      operationId: string;
      type: "ensure_trip_day_count";
    };

export function createTripEditOperationFacts(
  operations: readonly TripEditRiskOperation[],
  trip: Trip,
): TripEditOperationFact[] {
  let dayCount = trip.days.length;

  return operations.map((operation) => {
    const operationFact = createFact(operation, dayCount);

    if (operation.type === "ensure_trip_day_count") {
      dayCount = Math.max(dayCount, operation.dayCount);
    }

    return operationFact;
  });
}

function createFact(
  operation: TripEditRiskOperation,
  currentDayCount: number,
): TripEditOperationFact {
  switch (operation.type) {
    case "add_place_to_day":
      return fact(operation, "verified_poi_addition", "low");
    case "update_day_item":
      return fact(operation, "bounded_item_update", "low");
    case "update_trip_day_title":
      return fact(operation, "bounded_day_title_update", "low");
    case "ensure_trip_day_count":
      return fact(
        operation,
        "itinerary_day_expansion",
        operation.dayCount > currentDayCount ? "medium" : "low",
      );
    case "move_day_item":
      return fact(operation, "itinerary_reorder", "medium");
    case "remove_day_item":
      return fact(operation, "destructive_item_removal", "high");
  }
}

function fact(
  operation: TripEditRiskOperation,
  reasonCode: TripEditOperationFact["reasonCode"],
  risk: TripEditOperationFact["risk"],
): TripEditOperationFact {
  return {
    operationId: operation.operationId,
    reasonCode,
    risk,
    type: operation.type,
  };
}
