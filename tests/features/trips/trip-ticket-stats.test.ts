import assert from "node:assert/strict";
import test from "node:test";
import {
  getFeaturedTripTicketPalette,
  getTripCurrentDayNumber,
  getTripTicketStats,
} from "../../../features/trips/format";
import type { Trip } from "../../../features/trips/types";
import { THEME_COLORS } from "../../../shared/theme/theme-colors";

const baseTrip: Trip = {
  id: "trip-xian",
  title: "西安 3 日历史文化行",
  destination: "西安市",
  currency: "CNY",
  startDate: "2026-06-12",
  endDate: "2026-06-14",
  status: "计划中",
  days: [
    {
      id: "day-1",
      dayIndex: 1,
      title: "第 1 天",
      items: [
        { cost: 80, id: "item-1", title: "陕西历史博物馆", time: "09:30" },
        { id: "item-2", title: "大雁塔", time: "16:00" },
      ],
    },
    {
      id: "day-2",
      dayIndex: 2,
      title: "第 2 天",
      items: [{ cost: 54, id: "item-3", title: "城墙骑行" }],
    },
    {
      id: "day-3",
      dayIndex: 3,
      title: "第 3 天",
      items: [],
    },
  ],
  places: [],
  transports: [],
  lodgings: [],
  memos: [],
  checklistItems: [],
  expenses: [],
  importSources: [],
  createdAt: "2026-05-04T08:00:00.000Z",
  updatedAt: "2026-05-04T08:00:00.000Z",
};

test("trip ticket stats expose days, places, and due item counts for ticket cards", () => {
  const stats = getTripTicketStats(
    baseTrip,
    new Date("2026-06-12T12:00:00.000+08:00"),
  );

  assert.deepEqual(stats, [
    { label: "天数", value: 3 },
    { label: "地点", value: 3 },
    { label: "已到点", value: 1 },
    { label: "开销", value: "¥134" },
  ]);
});

test("trip current day number is zero before start and clamps to the trip duration", () => {
  assert.equal(getTripCurrentDayNumber(baseTrip, new Date(2026, 5, 11, 12)), 0);
  assert.equal(getTripCurrentDayNumber(baseTrip, new Date(2026, 5, 12, 12)), 1);
  assert.equal(getTripCurrentDayNumber(baseTrip, new Date(2026, 5, 13, 12)), 2);
  assert.equal(getTripCurrentDayNumber(baseTrip, new Date(2026, 5, 20, 12)), 3);
});

test("featured trip ticket palette uses a restrained two-color pastel palette", () => {
  assert.deepEqual(getFeaturedTripTicketPalette("light"), {
    accentText: "#9B6756",
    dashColor: "#C7B4A9",
    dashSegmentLength: 14,
    dashSegmentThickness: 2,
    heroBackground: "#33466F",
    heroMutedText: "#C7D5EB",
    heroPattern: "#6982AC",
    heroText: "#FFFFFF",
    paperBackground: "#FFFBF5",
    paperPressed: "#FFF1E5",
    paperText: "#20283A",
    punchBorder: "#DABEB2",
    seamHeight: 30,
    seamSplitY: 15,
    statBackground: "#FFF0E8",
  });
});

test("every skin provides complete light and dark featured ticket palettes", () => {
  for (const color of THEME_COLORS) {
    for (const mode of ["light", "dark"] as const) {
      const palette = getFeaturedTripTicketPalette(mode, color.id);

      assert.ok(palette.heroBackground);
      assert.ok(palette.paperBackground);
      assert.ok(palette.paperPressed);
      assert.ok(palette.paperText);
      assert.equal(palette.dashSegmentLength, 14);
      assert.equal(palette.seamSplitY, 15);
    }
  }
});
