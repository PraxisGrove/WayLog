import { createLocalTripEntityId } from "./place-draft";
import type { Trip, TripMemo } from "./types";

export function createTripMemo(input: {
  detail?: string;
  title: string;
}): TripMemo {
  const title = input.title.trim();
  const detail = input.detail?.trim();

  return {
    id: createLocalTripEntityId("memo"),
    title: title || "备忘",
    detail: detail ? detail : undefined,
    pinned: false,
  };
}

export function appendTripMemo(
  trip: Trip,
  input: { detail?: string; title: string },
): Trip {
  const nextMemo = createTripMemo(input);

  return {
    ...trip,
    memos: [...trip.memos, nextMemo],
    updatedAt: new Date().toISOString(),
  };
}
