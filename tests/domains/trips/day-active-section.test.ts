import assert from "node:assert/strict";
import test from "node:test";

import {
  isScrollAtContentEnd,
  resolveActiveVisibleDayId,
  resolveScrollAnchorActiveDayId,
  resolveScrollEndActiveDayId,
} from "../../../domains/trips/screens/trip-detail/immersive/day-active-section";

test("正常上下滑动时使用 FlatList 的第一个可见天作为高亮天", () => {
  const activeDayId = resolveActiveVisibleDayId({
    isAtScrollEnd: false,
    viewableDayIds: ["day-2", "day-3"],
  });

  assert.equal(activeDayId, "day-2");
});

test("行程详情滚到底部且最后一天较短时高亮最后一个可见天", () => {
  const activeDayId = resolveActiveVisibleDayId({
    isAtScrollEnd: true,
    viewableDayIds: ["day-6", "day-7"],
  });

  assert.equal(activeDayId, "day-7");
});

test("只有滚动视口触底时才启用最后可见天兜底", () => {
  assert.equal(
    isScrollAtContentEnd({
      contentHeight: 1500,
      scrollY: 778,
      viewportHeight: 720,
    }),
    true,
  );

  assert.equal(
    isScrollAtContentEnd({
      contentHeight: 1500,
      scrollY: 700,
      viewportHeight: 720,
    }),
    false,
  );
});

test("缺少可见天时不产生高亮结果", () => {
  const activeDayId = resolveActiveVisibleDayId({
    isAtScrollEnd: true,
    viewableDayIds: [],
  });

  assert.equal(activeDayId, undefined);
});

test("内容高度或视口无效时不判定为触底", () => {
  assert.equal(
    isScrollAtContentEnd({
      contentHeight: 0,
      scrollY: 0,
      viewportHeight: 720,
    }),
    false,
  );

  assert.equal(
    isScrollAtContentEnd({
      contentHeight: 1500,
      scrollY: 780,
      viewportHeight: 0,
    }),
    false,
  );
});

test("负向滚动偏移按顶部处理，不能误判为触底", () => {
  assert.equal(
    isScrollAtContentEnd({
      contentHeight: 1500,
      scrollY: -100,
      viewportHeight: 720,
    }),
    false,
  );
});

test("列表触底时直接高亮最后一天，不依赖可见项回调再次触发", () => {
  const activeDayId = resolveScrollEndActiveDayId({
    contentHeight: 2773,
    dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    scrollY: 2257,
    viewportHeight: 515,
  });

  assert.equal(activeDayId, "day-7");
});

test("列表没有触底时不强制改成最后一天", () => {
  const activeDayId = resolveScrollEndActiveDayId({
    contentHeight: 2773,
    dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    scrollY: 1807,
    viewportHeight: 515,
  });

  assert.equal(activeDayId, undefined);
});

test("从底部上滑离开触底状态后按锚点回到第六天", () => {
  const activeDayId = resolveScrollAnchorActiveDayId({
    contentHeight: 2773,
    dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    scrollY: 1997,
    sectionLayouts: {
      "day-1": { height: 385, y: 0 },
      "day-2": { height: 502, y: 0 },
      "day-3": { height: 502, y: 0 },
      "day-4": { height: 366, y: 0 },
      "day-5": { height: 251, y: 0 },
      "day-6": { height: 366, y: 0 },
      "day-7": { height: 251, y: 0 },
    },
    viewportHeight: 515,
  });

  assert.equal(activeDayId, "day-6");
});

test("锚点落在两天间隔内时保持上一天，不提前切到下一天", () => {
  const activeDayId = resolveScrollAnchorActiveDayId({
    contentHeight: 2773,
    dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    scrollY: 1976,
    sectionLayouts: {
      "day-1": { height: 385, y: 0 },
      "day-2": { height: 502, y: 0 },
      "day-3": { height: 502, y: 0 },
      "day-4": { height: 366, y: 0 },
      "day-5": { height: 251, y: 0 },
      "day-6": { height: 366, y: 0 },
      "day-7": { height: 251, y: 0 },
    },
    viewportHeight: 515,
  });

  assert.equal(activeDayId, "day-5");
});

test("下一天标题到达锚点后才切换到下一天", () => {
  const activeDayId = resolveScrollAnchorActiveDayId({
    contentHeight: 2773,
    dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    scrollY: 1982,
    sectionLayouts: {
      "day-1": { height: 385, y: 0 },
      "day-2": { height: 502, y: 0 },
      "day-3": { height: 502, y: 0 },
      "day-4": { height: 366, y: 0 },
      "day-5": { height: 251, y: 0 },
      "day-6": { height: 366, y: 0 },
      "day-7": { height: 251, y: 0 },
    },
    viewportHeight: 515,
  });

  assert.equal(activeDayId, "day-6");
});

test("触底时由触底分支返回最后一天，即使锚点仍在前一天", () => {
  const scrollMetrics = {
    contentHeight: 2773,
    scrollY: 2257,
    viewportHeight: 515,
  };

  const activeDayId = resolveScrollAnchorActiveDayId({
    ...scrollMetrics,
    dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    sectionLayouts: {
      "day-1": { height: 385, y: 0 },
      "day-2": { height: 502, y: 0 },
      "day-3": { height: 502, y: 0 },
      "day-4": { height: 366, y: 0 },
      "day-5": { height: 251, y: 0 },
      "day-6": { height: 366, y: 0 },
      "day-7": { height: 251, y: 0 },
    },
  });

  assert.equal(activeDayId, "day-6");
  assert.equal(
    resolveScrollEndActiveDayId({
      ...scrollMetrics,
      dayIds: ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7"],
    }),
    "day-7",
  );
});
