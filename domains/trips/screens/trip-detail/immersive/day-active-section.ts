export type ScrollMetrics = {
  contentHeight: number;
  scrollY: number;
  viewportHeight: number;
};

export type ScrollSectionLayout = {
  height: number;
  y: number;
};

export type ResolveActiveVisibleDayInput = {
  isAtScrollEnd: boolean;
  viewableDayIds: readonly string[];
};

export type ResolveScrollEndActiveDayInput = ScrollMetrics & {
  dayIds: readonly string[];
};

export type ResolveScrollAnchorActiveDayInput = ScrollMetrics & {
  anchorOffset?: number;
  contentTopInset?: number;
  dayIds: readonly string[];
  itemSeparatorHeight?: number;
  sectionLayouts: Record<string, ScrollSectionLayout | undefined>;
};

const DEFAULT_ANCHOR_OFFSET = 88;
const DEFAULT_CONTENT_TOP_INSET = 4;
const DEFAULT_ITEM_SEPARATOR_HEIGHT = 12;

export function isScrollAtContentEnd({
  contentHeight,
  scrollY,
  viewportHeight,
}: ScrollMetrics): boolean {
  if (contentHeight <= 0 || viewportHeight <= 0) {
    return false;
  }

  return Math.max(0, scrollY) + viewportHeight >= contentHeight - 2;
}

export function resolveActiveVisibleDayId({
  isAtScrollEnd,
  viewableDayIds,
}: ResolveActiveVisibleDayInput): string | undefined {
  if (viewableDayIds.length === 0) {
    return undefined;
  }

  return isAtScrollEnd
    ? viewableDayIds[viewableDayIds.length - 1]
    : viewableDayIds[0];
}

export function resolveScrollEndActiveDayId({
  dayIds,
  ...scrollMetrics
}: ResolveScrollEndActiveDayInput): string | undefined {
  if (!isScrollAtContentEnd(scrollMetrics)) {
    return undefined;
  }

  return dayIds[dayIds.length - 1];
}

export function resolveScrollAnchorActiveDayId({
  anchorOffset = DEFAULT_ANCHOR_OFFSET,
  contentTopInset = DEFAULT_CONTENT_TOP_INSET,
  dayIds,
  itemSeparatorHeight = DEFAULT_ITEM_SEPARATOR_HEIGHT,
  sectionLayouts,
  scrollY,
  viewportHeight,
}: ResolveScrollAnchorActiveDayInput): string | undefined {
  if (viewportHeight <= 0 || dayIds.length === 0) {
    return undefined;
  }

  const anchorY = Math.max(0, scrollY) + Math.max(0, anchorOffset);
  let sectionTop = Math.max(0, contentTopInset);
  let firstMeasuredDayId: string | undefined;
  let activeDayId: string | undefined;

  for (const dayId of dayIds) {
    const layout = sectionLayouts[dayId];

    if (!layout || layout.height <= 0) {
      return undefined;
    }

    firstMeasuredDayId ??= dayId;

    if (sectionTop > anchorY) {
      break;
    }

    const sectionBottom = sectionTop + layout.height;
    activeDayId = dayId;
    sectionTop = sectionBottom + Math.max(0, itemSeparatorHeight);
  }

  return activeDayId ?? firstMeasuredDayId;
}
