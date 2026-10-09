import assert from "node:assert/strict";
import test from "node:test";

import { seedTrips } from "../../../features/trips/seed";

test("trip days use 1-based dayIndex values", () => {
  const trip = seedTrips.find((seedTrip) => seedTrip.id === "seed-xian");

  if (!trip) {
    throw new Error("Expected seed-xian trip to exist.");
  }

  assert.equal(trip.days[0]?.dayIndex, 1);
  assert.deepEqual(
    trip.days.map((day) => day.dayIndex),
    [1, 2, 3],
  );
});
