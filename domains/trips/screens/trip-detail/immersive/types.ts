export type DayTabLayout = {
  width: number;
  x: number;
};

export type DayItemLayout = {
  height: number;
  y: number;
};

export type DaySectionLayout = {
  height: number;
  y: number;
};

export type DayItemDragState = {
  currentIndex: number;
  dayId: string;
  itemId: string;
  offsetY: number;
  startIndex: number;
  startedAt: number;
};

export type DayDetailSheetSnapKey = "collapsed" | "default" | "expanded";
export type DayDetailSheetContentMode = "mapPreview" | "timeline";

export type DayDetailSheetReturnSnapshot = {
  dayId: string;
  previewItemId?: string;
  savedAt: number;
  snapKey: DayDetailSheetSnapKey;
};
