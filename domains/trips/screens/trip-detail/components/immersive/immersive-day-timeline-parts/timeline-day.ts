import {
  addDaysToDateKey,
  compareDateKeys,
  createDateKey,
  parseDateKey,
  type Trip,
  type TripDay,
  type TripDayItem,
} from "@/features/trips";

type TimelineItemStatus = "completed" | "current" | "upcoming";
export function formatTimelineDayDate(
  trip: Trip,
  day: TripDay,
): string | undefined {
  if (!trip.startDate) {
    return undefined;
  }

  const dateParts = parseDateKey(
    addDaysToDateKey(trip.startDate, day.dayIndex - 1),
  );

  if (!dateParts) {
    return undefined;
  }

  return `${dateParts.month} 月 ${dateParts.day} 日`;
}

export function getTimeStatusMap(
  trip: Trip,
  day: TripDay,
  dayItems: TripDayItem[],
) {
  const statusMap = new Map<string, TimelineItemStatus>();

  if (!trip.startDate) {
    return statusMap;
  }

  const dayDateKey = addDaysToDateKey(trip.startDate, day.dayIndex - 1);
  const todayKey = createDateKey();
  const dayCmp = compareDateKeys(dayDateKey, todayKey);

  if (dayCmp < 0) {
    for (const item of dayItems) {
      if (item.time) {
        statusMap.set(item.id, "completed");
      }
    }
    return statusMap;
  }

  if (dayCmp > 0) {
    for (const item of dayItems) {
      if (item.time) {
        statusMap.set(item.id, "upcoming");
      }
    }
    return statusMap;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const timedItems = dayItems
    .flatMap((item) => {
      if (!item.time) {
        return [];
      }
      const [hour, minute] = item.time.split(":").map(Number);
      return { id: item.id, minutes: hour * 60 + minute };
    })
    .sort((left, right) => left.minutes - right.minutes);

  const nextUpcomingIndex = timedItems.findIndex(
    (item) => item.minutes > nowMinutes,
  );

  if (nextUpcomingIndex === -1) {
    timedItems.forEach((item, index) => {
      statusMap.set(
        item.id,
        index === timedItems.length - 1 ? "current" : "completed",
      );
    });
    return statusMap;
  }

  timedItems.forEach((item, index) => {
    if (index === nextUpcomingIndex) {
      statusMap.set(item.id, "upcoming");
    } else if (index === nextUpcomingIndex - 1) {
      statusMap.set(item.id, "current");
    } else if (index < nextUpcomingIndex - 1) {
      statusMap.set(item.id, "completed");
    } else {
      statusMap.set(item.id, "upcoming");
    }
  });

  return statusMap;
}
