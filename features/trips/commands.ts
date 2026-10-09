import { addDaysToDateKey } from "./date";
import { formatTripDayTitle, isDefaultTripDayTitle } from "./day-title";
import {
  normalizeExpenseAmount,
  normalizeExpenseCategory,
  normalizeExpenseCurrency,
} from "./expenses";
import {
  canUseProviderPlaceIdAsAmapPoiId,
  doesTripDayItemReferenceTripPlace,
} from "./place-identity";
import {
  inferPlaceKind,
  isTripPlaceIconKey,
  isTripPlacePoiGroup,
} from "./place-kind";
import type {
  Trip,
  TripBudget,
  TripChecklistItem,
  TripDay,
  TripDayItem,
  TripExpense,
  TripExpenseCategory,
  TripMemo,
  TripPlace,
  TripPlaceCategory,
  TripPlaceExternalRefs,
  TripPlaceIconKey,
  TripPlaceMapBoundary,
  TripPlacePoiGroup,
  TripStatus,
} from "./types";

export type TripCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TripCommandError };

export type TripCommandError = {
  code: TripCommandErrorCode;
  message: string;
};

export type TripCommandErrorCode = "INVALID_INPUT" | "NOT_FOUND";

export type TripCommandDeps = {
  idGen: (prefix: string) => string;
  clock: () => string;
};

export const defaultTripCommandDeps: TripCommandDeps = {
  idGen: (prefix) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  clock: () => new Date().toISOString(),
};

function normalizeRequiredText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createInvalidInputError(message: string): TripCommandResult<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_INPUT",
      message,
    },
  };
}

function createChecklistNotFoundError(
  itemId: string,
): TripCommandResult<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: `清单项不存在：${itemId}`,
    },
  };
}

function createTripDayNotFoundError(dayId: string): TripCommandResult<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: `行程日期不存在：${dayId}`,
    },
  };
}

function createTripDayItemNotFoundError(
  itemId: string,
): TripCommandResult<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: `行程地点不存在：${itemId}`,
    },
  };
}

function createTripExpenseNotFoundError(
  expenseId: string,
): TripCommandResult<never> {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: `开销记录不存在：${expenseId}`,
    },
  };
}

function updateTripChecklist(
  trip: Trip,
  checklistItems: TripChecklistItem[],
  deps: TripCommandDeps,
): Trip {
  return {
    ...trip,
    checklistItems,
    updatedAt: deps.clock(),
  };
}

function updateTripDaysAndPlaces(
  trip: Trip,
  input: {
    days: Trip["days"];
    deps: TripCommandDeps;
    places?: TripPlace[];
  },
): Trip {
  return {
    ...trip,
    days: input.days,
    places: input.places ?? trip.places,
    updatedAt: input.deps.clock(),
  };
}

function getExpenseDateForDay(
  trip: Trip,
  dayId: string | undefined,
): string | undefined {
  if (!dayId || !trip.startDate) {
    return undefined;
  }

  const day = trip.days.find((candidate) => candidate.id === dayId);
  return day ? addDaysToDateKey(trip.startDate, day.dayIndex - 1) : undefined;
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTripDayItemTime(value: unknown): string | undefined {
  const text = normalizeOptionalText(value);

  if (!text) {
    return undefined;
  }

  return /^\d{2}:\d{2}$/.test(text) ? text : undefined;
}

function isInvalidTripDayItemTime(value: unknown): boolean {
  return (
    normalizeOptionalText(value) !== undefined &&
    normalizeTripDayItemTime(value) === undefined
  );
}

function normalizeTripPlaceCategory(value: unknown): TripPlaceCategory {
  const categories: TripPlaceCategory[] = [
    "景点",
    "餐厅",
    "酒店",
    "交通",
    "购物",
    "教育",
    "医疗",
    "其他",
  ];
  return categories.includes(value as TripPlaceCategory)
    ? (value as TripPlaceCategory)
    : "其他";
}

function shouldRefreshTripDayTitle(day: TripDay): boolean {
  return isDefaultTripDayTitle(day);
}

function renumberTripDaysForCommand(days: TripDay[]): TripDay[] {
  return days.map((day, index) => {
    const dayIndex = index + 1;

    return {
      ...day,
      dayIndex,
      title: shouldRefreshTripDayTitle(day)
        ? formatTripDayTitle(dayIndex)
        : day.title.trim(),
    };
  });
}

function createTripDayForCommand(
  dayIndex: number,
  deps: TripCommandDeps,
): TripDay {
  return {
    id: deps.idGen(`day-${dayIndex}`),
    dayIndex,
    title: formatTripDayTitle(dayIndex),
    items: [],
  };
}

function removeUnusedTripPlacesForDayItems(
  places: TripPlace[],
  days: Trip["days"],
  removedItems: TripDayItem[],
): TripPlace[] {
  if (removedItems.length === 0) {
    return places;
  }

  return places.filter((place) => {
    const wasLinkedToRemovedItem = removedItems.some((item) =>
      doesTripDayItemReferenceTripPlace(item, place),
    );

    if (!wasLinkedToRemovedItem) {
      return true;
    }

    return days.some((day) =>
      day.items.some((item) => doesTripDayItemReferenceTripPlace(item, place)),
    );
  });
}

function insertAtIndex<T>(items: T[], item: T, targetIndex: number): T[] {
  const nextItems = [...items];
  const boundedIndex = Math.min(Math.max(targetIndex, 0), nextItems.length);
  nextItems.splice(boundedIndex, 0, item);
  return nextItems;
}

function moveItemBetweenLists<T>(
  sourceItems: T[],
  sourceIndex: number,
  targetItems: T[],
  targetIndex: number,
): { nextSourceItems: T[]; nextTargetItems: T[]; movedItem?: T } {
  const nextSourceItems = [...sourceItems];
  const [movedItem] = nextSourceItems.splice(sourceIndex, 1);

  if (movedItem === undefined) {
    return { nextSourceItems, nextTargetItems: targetItems };
  }

  const nextTargetItems = insertAtIndex(targetItems, movedItem, targetIndex);
  return { movedItem, nextSourceItems, nextTargetItems };
}

export type AddChecklistItemInput = {
  title: string;
};

export function addChecklistItem(
  trip: Trip,
  input: AddChecklistItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip; itemId: string }> {
  const title = normalizeRequiredText(input.title);

  if (!title) {
    return createInvalidInputError("请先填写清单物品");
  }

  const itemId = deps.idGen("checklist");
  const nextItem: TripChecklistItem = {
    id: itemId,
    title,
    isCompleted: false,
  };

  const nextTrip = updateTripChecklist(
    trip,
    [...trip.checklistItems, nextItem],
    deps,
  );

  return { ok: true, data: { trip: nextTrip, itemId } };
}

export type ToggleChecklistItemInput = {
  itemId: string;
};

export function toggleChecklistItem(
  trip: Trip,
  input: ToggleChecklistItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const target = trip.checklistItems.find((item) => item.id === input.itemId);
  if (!target) {
    return createChecklistNotFoundError(input.itemId);
  }

  const nextItems: TripChecklistItem[] = trip.checklistItems.map((item) =>
    item.id === input.itemId
      ? { ...item, isCompleted: !item.isCompleted }
      : item,
  );
  const nextTrip = updateTripChecklist(trip, nextItems, deps);

  return { ok: true, data: { trip: nextTrip } };
}

export type RemoveChecklistItemInput = {
  itemId: string;
};

export function removeChecklistItem(
  trip: Trip,
  input: RemoveChecklistItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const target = trip.checklistItems.find((item) => item.id === input.itemId);

  if (!target) {
    return createChecklistNotFoundError(input.itemId);
  }

  const nextItems = trip.checklistItems.filter(
    (item) => item.id !== input.itemId,
  );
  const nextTrip = updateTripChecklist(trip, nextItems, deps);

  return { ok: true, data: { trip: nextTrip } };
}

export type RemoveChecklistItemsInput = {
  itemIds: string[];
};

export function removeChecklistItems(
  trip: Trip,
  input: RemoveChecklistItemsInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip; removedCount: number }> {
  const uniqueItemIds = Array.from(
    new Set(
      input.itemIds.filter(
        (itemId) => typeof itemId === "string" && itemId.trim(),
      ),
    ),
  );

  if (uniqueItemIds.length === 0) {
    return createInvalidInputError("请选择要删除的清单项");
  }

  const existingItemIds = new Set(trip.checklistItems.map((item) => item.id));
  const missingItemId = uniqueItemIds.find(
    (itemId) => !existingItemIds.has(itemId),
  );

  if (missingItemId) {
    return createChecklistNotFoundError(missingItemId);
  }

  const removalSet = new Set(uniqueItemIds);
  const nextItems = trip.checklistItems.filter(
    (item) => !removalSet.has(item.id),
  );
  const nextTrip = updateTripChecklist(trip, nextItems, deps);

  return {
    ok: true,
    data: { trip: nextTrip, removedCount: uniqueItemIds.length },
  };
}

export type UpdateChecklistItemTitleInput = {
  itemId: string;
  title: string;
};

export function updateChecklistItemTitle(
  trip: Trip,
  input: UpdateChecklistItemTitleInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const title = normalizeRequiredText(input.title);

  if (!title) {
    return createInvalidInputError("请先填写清单物品");
  }

  const target = trip.checklistItems.find((item) => item.id === input.itemId);

  if (!target) {
    return createChecklistNotFoundError(input.itemId);
  }

  const nextItems = trip.checklistItems.map((item) =>
    item.id === input.itemId ? { ...item, title } : item,
  );
  const nextTrip = updateTripChecklist(trip, nextItems, deps);

  return { ok: true, data: { trip: nextTrip } };
}

export type MoveChecklistItemInput = {
  direction?: "down" | "up";
  itemId: string;
  toIndex?: number;
};

export function moveChecklistItem(
  trip: Trip,
  input: MoveChecklistItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const currentIndex = trip.checklistItems.findIndex(
    (item) => item.id === input.itemId,
  );

  if (currentIndex < 0) {
    return createChecklistNotFoundError(input.itemId);
  }

  let targetIndex: number;

  if (typeof input.toIndex === "number" && Number.isInteger(input.toIndex)) {
    targetIndex = input.toIndex;
  } else if (input.direction === "up") {
    targetIndex = currentIndex - 1;
  } else if (input.direction === "down") {
    targetIndex = currentIndex + 1;
  } else {
    return createInvalidInputError("请选择清单项的移动方向");
  }

  if (targetIndex < 0 || targetIndex >= trip.checklistItems.length) {
    return createInvalidInputError("清单项已经在边界位置");
  }

  if (targetIndex === currentIndex) {
    return { ok: true, data: { trip } };
  }

  const nextItems = [...trip.checklistItems];
  const [movedItem] = nextItems.splice(currentIndex, 1);

  if (!movedItem) {
    return createChecklistNotFoundError(input.itemId);
  }

  nextItems.splice(targetIndex, 0, movedItem);
  const nextTrip = updateTripChecklist(trip, nextItems, deps);

  return { ok: true, data: { trip: nextTrip } };
}

export type AddChecklistItemsInput = {
  titles: string[];
};

export function addChecklistItems(
  trip: Trip,
  input: AddChecklistItemsInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ itemIds: string[]; trip: Trip }> {
  const titles = input.titles
    .map((title) => normalizeRequiredText(title))
    .filter((title): title is string => Boolean(title));

  if (titles.length === 0) {
    return createInvalidInputError("请先填写清单物品");
  }

  const itemIds: string[] = [];
  const nextItems: TripChecklistItem[] = titles.map((title) => {
    const itemId = deps.idGen("checklist");
    itemIds.push(itemId);

    return {
      id: itemId,
      title,
      isCompleted: false,
    };
  });

  return {
    ok: true,
    data: {
      itemIds,
      trip: updateTripChecklist(
        trip,
        [...trip.checklistItems, ...nextItems],
        deps,
      ),
    },
  };
}

export type UpdateTripFieldsInput = {
  changes: {
    currency?: string;
    destination?: string;
    endDate?: string;
    startDate?: string;
    status?: TripStatus;
    title?: string;
  };
};

export function updateTripFields(
  trip: Trip,
  input: UpdateTripFieldsInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const nextTitle =
    input.changes.title === undefined
      ? trip.title
      : normalizeRequiredText(input.changes.title);

  if (input.changes.title !== undefined && !nextTitle) {
    return createInvalidInputError("请先填写行程名称");
  }

  const nextDestination =
    input.changes.destination === undefined
      ? trip.destination
      : normalizeRequiredText(input.changes.destination);

  if (input.changes.destination !== undefined && !nextDestination) {
    return createInvalidInputError("请先填写目的地");
  }

  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        currency:
          normalizeOptionalText(input.changes.currency) ?? trip.currency,
        destination: nextDestination ?? trip.destination,
        endDate:
          input.changes.endDate === undefined
            ? trip.endDate
            : normalizeOptionalText(input.changes.endDate),
        startDate:
          input.changes.startDate === undefined
            ? trip.startDate
            : normalizeOptionalText(input.changes.startDate),
        status: input.changes.status ?? trip.status,
        title: nextTitle ?? trip.title,
        updatedAt: deps.clock(),
      },
    },
  };
}

export type AddTripDayInput = {
  title?: string;
};

export type ResizeTripDaysInput = {
  dayCount: number;
  endDate?: string;
  startDate?: string;
};

export function addTripDay(
  trip: Trip,
  input: AddTripDayInput = {},
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ day: TripDay; trip: Trip }> {
  const dayIndex = trip.days.length + 1;
  const defaultDay = createTripDayForCommand(dayIndex, deps);
  const day: TripDay = {
    ...defaultDay,
    title: normalizeOptionalText(input.title) ?? defaultDay.title,
  };

  return {
    ok: true,
    data: {
      day,
      trip: {
        ...trip,
        days: [...trip.days, day],
        endDate: trip.startDate
          ? addDaysToDateKey(trip.startDate, day.dayIndex - 1)
          : trip.endDate,
        updatedAt: deps.clock(),
      },
    },
  };
}

export function resizeTripDays(
  trip: Trip,
  input: ResizeTripDaysInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{
  addedDays: TripDay[];
  removedDays: TripDay[];
  trip: Trip;
}> {
  if (!Number.isInteger(input.dayCount) || input.dayCount < 1) {
    return createInvalidInputError("至少需要保留一天行程");
  }

  const currentDays =
    trip.days.length > 0
      ? renumberTripDaysForCommand(trip.days)
      : [createTripDayForCommand(1, deps)];
  const targetDayCount = input.dayCount;
  const keptDays = currentDays.slice(0, targetDayCount);
  const removedDays = currentDays.slice(targetDayCount);
  const addedDays: TripDay[] = [];

  for (let index = keptDays.length; index < targetDayCount; index += 1) {
    addedDays.push(createTripDayForCommand(index + 1, deps));
  }

  const nextDays = renumberTripDaysForCommand([...keptDays, ...addedDays]);
  const removedItems = removedDays.flatMap((day) => day.items);
  const nextStartDate =
    input.startDate === undefined
      ? trip.startDate
      : normalizeOptionalText(input.startDate);
  const nextEndDate =
    input.endDate === undefined
      ? nextStartDate
        ? addDaysToDateKey(nextStartDate, targetDayCount - 1)
        : trip.endDate
      : normalizeOptionalText(input.endDate);

  return {
    ok: true,
    data: {
      addedDays,
      removedDays,
      trip: {
        ...trip,
        days: nextDays,
        places: removeUnusedTripPlacesForDayItems(
          trip.places,
          nextDays,
          removedItems,
        ),
        endDate: nextEndDate,
        startDate: nextStartDate,
        updatedAt: deps.clock(),
      },
    },
  };
}

export type UpdateTripDayTitleInput = {
  dayId: string;
  title: string;
};

export function updateTripDayTitle(
  trip: Trip,
  input: UpdateTripDayTitleInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const title = normalizeRequiredText(input.title);

  if (!title) {
    return createInvalidInputError("请先填写天数标题");
  }

  const day = trip.days.find((candidate) => candidate.id === input.dayId);

  if (!day) {
    return createTripDayNotFoundError(input.dayId);
  }

  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        days: trip.days.map((candidate) =>
          candidate.id === input.dayId ? { ...candidate, title } : candidate,
        ),
        updatedAt: deps.clock(),
      },
    },
  };
}

export type RemoveTripDayInput = {
  dayId: string;
};

export function removeTripDay(
  trip: Trip,
  input: RemoveTripDayInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{
  removedDay: TripDay;
  removedDayIndex: number;
  trip: Trip;
}> {
  const removedDayIndex = trip.days.findIndex((day) => day.id === input.dayId);

  if (removedDayIndex < 0) {
    return createTripDayNotFoundError(input.dayId);
  }

  if (trip.days.length <= 1) {
    return createInvalidInputError("至少需要保留一天行程");
  }

  const removedDay = trip.days[removedDayIndex];
  if (!removedDay) {
    return createTripDayNotFoundError(input.dayId);
  }
  const nextDays = renumberTripDaysForCommand(
    trip.days.filter((day) => day.id !== input.dayId),
  );

  return {
    ok: true,
    data: {
      removedDay,
      removedDayIndex,
      trip: {
        ...trip,
        days: nextDays,
        places: removeUnusedTripPlacesForDayItems(
          trip.places,
          nextDays,
          removedDay.items,
        ),
        endDate: trip.startDate
          ? addDaysToDateKey(trip.startDate, nextDays.length - 1)
          : trip.endDate,
        updatedAt: deps.clock(),
      },
    },
  };
}

export type SetTripBudgetInput = {
  amount?: number;
  currency?: string;
};

export function setTripBudget(
  trip: Trip,
  input: SetTripBudgetInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const amount =
    input.amount === undefined
      ? undefined
      : normalizeExpenseAmount(input.amount);

  if (input.amount !== undefined && amount === undefined) {
    return createInvalidInputError("请填写有效金额");
  }

  const budget: TripBudget | undefined =
    amount === undefined
      ? undefined
      : {
          amount,
          currency: normalizeExpenseCurrency(input.currency ?? trip.currency),
        };

  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        budget,
        updatedAt: deps.clock(),
      },
    },
  };
}

export function clearTripBudget(
  trip: Trip,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        budget: undefined,
        updatedAt: deps.clock(),
      },
    },
  };
}

export type TripSelectedPlaceInput = {
  address?: string;
  area?: string;
  category?: TripPlaceCategory;
  externalRefs?: TripPlaceExternalRefs;
  details?: TripPlace["details"];
  iconKey?: TripPlaceIconKey;
  id?: string;
  latitude?: number;
  longitude?: number;
  mapBoundary?: TripPlaceMapBoundary;
  name: string;
  osmKey?: string;
  osmValue?: string;
  poiGroup?: TripPlacePoiGroup;
  poiType?: string;
  photos?: TripPlace["photos"];
  provider?: string;
  providerPlaceId?: string;
  sourcePlaceId?: string;
};

export type AddPlaceToDayInput = {
  dayId: string;
  note?: string;
  place: TripSelectedPlaceInput;
  recommendationReason?: string;
  targetIndex?: number;
  time?: string;
};

export function addPlaceToDay(
  trip: Trip,
  input: AddPlaceToDayInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ itemId: string; placeId: string; trip: Trip }> {
  const day = trip.days.find((candidate) => candidate.id === input.dayId);

  if (!day) {
    return createTripDayNotFoundError(input.dayId);
  }

  if (
    input.targetIndex !== undefined &&
    (!Number.isInteger(input.targetIndex) ||
      input.targetIndex < 0 ||
      input.targetIndex > day.items.length)
  ) {
    return createInvalidInputError("地点插入位置无效");
  }

  if (isInvalidTripDayItemTime(input.time)) {
    return createInvalidInputError("时间格式应为 HH:MM");
  }

  const placeResult = createTripPlaceFromSelectedPlaceInput(input.place, deps);

  if (!placeResult.ok) {
    return placeResult;
  }

  const place = placeResult.data.place;
  const itemId = deps.idGen("item");

  const nextItem: TripDayItem = {
    id: itemId,
    title: place.name,
    category: place.category,
    iconKey: place.iconKey,
    placeId: place.id,
    placeName: place.name,
    note: normalizeOptionalText(input.note),
    recommendationReason: normalizeOptionalText(input.recommendationReason),
    time: normalizeTripDayItemTime(input.time),
  };

  const targetIndex = input.targetIndex ?? day.items.length;
  const nextDays = trip.days.map((candidate) =>
    candidate.id === day.id
      ? {
          ...candidate,
          items: insertAtIndex(candidate.items, nextItem, targetIndex),
        }
      : candidate,
  );

  return {
    ok: true,
    data: {
      itemId,
      placeId: place.id,
      trip: updateTripDaysAndPlaces(trip, {
        days: nextDays,
        places: [...trip.places, place],
        deps,
      }),
    },
  };
}

function createTripPlaceFromSelectedPlaceInput(
  place: TripSelectedPlaceInput,
  deps: TripCommandDeps,
): TripCommandResult<{ place: TripPlace }> {
  const name = normalizeRequiredText(place.name);

  if (!name) {
    return createInvalidInputError("请先填写地点名称");
  }

  const category = normalizeTripPlaceCategory(place.category);
  const inferredKind = inferPlaceKind({
    category,
    name,
    osmKey: normalizeOptionalText(place.osmKey),
    osmValue: normalizeOptionalText(place.osmValue),
  });
  const iconKey = isTripPlaceIconKey(place.iconKey)
    ? place.iconKey
    : inferredKind.iconKey;
  const poiGroup = isTripPlacePoiGroup(place.poiGroup)
    ? place.poiGroup
    : inferredKind.poiGroup;
  const poiType = normalizeOptionalText(place.poiType) ?? inferredKind.poiType;
  const provider = normalizeOptionalText(place.provider);
  const providerPlaceId =
    normalizeOptionalText(place.providerPlaceId) ??
    normalizeOptionalText(place.sourcePlaceId) ??
    normalizeOptionalText(place.id);
  const externalRefs = normalizeSelectedPlaceExternalRefs({
    externalRefs: place.externalRefs,
    provider,
    providerPlaceId,
  });
  const nextPlace: TripPlace = {
    id: deps.idGen("place"),
    name,
    category,
    isScheduled: true,
    address: normalizeOptionalText(place.address),
    area: normalizeOptionalText(place.area),
    latitude:
      typeof place.latitude === "number" && Number.isFinite(place.latitude)
        ? place.latitude
        : undefined,
    longitude:
      typeof place.longitude === "number" && Number.isFinite(place.longitude)
        ? place.longitude
        : undefined,
    mapBoundary: place.mapBoundary,
    iconKey,
    osmKey: normalizeOptionalText(place.osmKey),
    osmValue: normalizeOptionalText(place.osmValue),
    poiGroup,
    poiType,
    provider,
    providerPlaceId,
    externalRefs,
    details: place.details,
    photos: place.photos,
  };

  return { ok: true, data: { place: nextPlace } };
}

function normalizeSelectedPlaceExternalRefs(input: {
  externalRefs?: TripPlaceExternalRefs;
  provider?: string;
  providerPlaceId?: string;
}): TripPlaceExternalRefs | undefined {
  const provider = input.provider?.toLowerCase();
  const shouldUseProviderPlaceIdAsAmapPoiId = canUseProviderPlaceIdAsAmapPoiId(
    provider,
    input.providerPlaceId,
  );
  const externalRefs: TripPlaceExternalRefs = {
    ...(input.externalRefs ?? {}),
    amapPoiId:
      input.externalRefs?.amapPoiId ??
      (shouldUseProviderPlaceIdAsAmapPoiId ? input.providerPlaceId : undefined),
  };

  return Object.values(externalRefs).some((entry) => entry !== undefined)
    ? externalRefs
    : undefined;
}

export type UpdateDayItemInput = {
  changes: {
    note?: string;
    recommendationReason?: string;
    time?: string;
    title?: string;
  };
  dayId: string;
  itemId: string;
};

export function updateDayItem(
  trip: Trip,
  input: UpdateDayItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const day = trip.days.find((candidate) => candidate.id === input.dayId);

  if (!day) {
    return createTripDayNotFoundError(input.dayId);
  }

  const targetItem = day.items.find((item) => item.id === input.itemId);

  if (!targetItem) {
    return createTripDayItemNotFoundError(input.itemId);
  }

  const title =
    input.changes.title === undefined
      ? targetItem.title
      : normalizeRequiredText(input.changes.title);

  if (input.changes.title !== undefined && !title) {
    return createInvalidInputError("请先填写地点名称");
  }

  if (isInvalidTripDayItemTime(input.changes.time)) {
    return createInvalidInputError("时间格式应为 HH:MM");
  }

  const nextDays = trip.days.map((candidate) =>
    candidate.id === input.dayId
      ? {
          ...candidate,
          items: candidate.items.map(
            (item): TripDayItem =>
              item.id === input.itemId
                ? {
                    ...item,
                    note:
                      input.changes.note === undefined
                        ? item.note
                        : normalizeOptionalText(input.changes.note),
                    placeName:
                      input.changes.title === undefined
                        ? item.placeName
                        : title,
                    recommendationReason:
                      input.changes.recommendationReason === undefined
                        ? item.recommendationReason
                        : normalizeOptionalText(
                            input.changes.recommendationReason,
                          ),
                    time:
                      input.changes.time === undefined
                        ? item.time
                        : normalizeTripDayItemTime(input.changes.time),
                    title: title ?? item.title,
                  }
                : item,
          ),
        }
      : candidate,
  );

  const nextPlaces =
    input.changes.title === undefined || !targetItem.placeId
      ? trip.places
      : trip.places.map((place) =>
          place.id === targetItem.placeId
            ? {
                ...place,
                name: title ?? place.name,
              }
            : place,
        );

  return {
    ok: true,
    data: {
      trip: updateTripDaysAndPlaces(trip, {
        days: nextDays,
        places: nextPlaces,
        deps,
      }),
    },
  };
}

export type MoveDayItemInput = {
  fromDayId: string;
  itemId: string;
  targetIndex: number;
  toDayId: string;
};

export type ReplaceTripDayItemsLayoutInput = {
  days: {
    dayId: string;
    itemIds: string[];
  }[];
};

export function replaceTripDayItemsLayout(
  trip: Trip,
  input: ReplaceTripDayItemsLayoutInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const dayById = new Map(trip.days.map((day) => [day.id, day]));
  const itemById = new Map<string, TripDayItem>();

  for (const day of trip.days) {
    for (const item of day.items) {
      itemById.set(item.id, item);
    }
  }

  const seenDayIds = new Set<string>();
  const assignedItemIds = new Set<string>();

  for (const dayLayout of input.days) {
    if (!dayById.has(dayLayout.dayId)) {
      return createTripDayNotFoundError(dayLayout.dayId);
    }

    if (seenDayIds.has(dayLayout.dayId)) {
      return createInvalidInputError("同一天不能重复出现");
    }

    seenDayIds.add(dayLayout.dayId);

    for (const itemId of dayLayout.itemIds) {
      if (!itemById.has(itemId)) {
        return createTripDayItemNotFoundError(itemId);
      }

      if (assignedItemIds.has(itemId)) {
        return createInvalidInputError("同一个地点不能重复安排");
      }

      assignedItemIds.add(itemId);
    }
  }

  const missingDay = trip.days.find((day) => !seenDayIds.has(day.id));

  if (missingDay) {
    return createInvalidInputError("缺少某天的地点布局");
  }

  const deletedItems = trip.days.flatMap((day) =>
    day.items.filter((item) => !assignedItemIds.has(item.id)),
  );
  const layoutByDayId = new Map(
    input.days.map((dayLayout) => [dayLayout.dayId, dayLayout.itemIds]),
  );
  const nextDays = trip.days.map((day) => {
    const nextItemIds = layoutByDayId.get(day.id);

    if (!nextItemIds) {
      return day;
    }

    return {
      ...day,
      items: nextItemIds.map((itemId) => {
        const item = itemById.get(itemId);
        if (!item) {
          throw new Error(`找不到行程地点: ${itemId}`);
        }
        return item;
      }),
    };
  });

  return {
    ok: true,
    data: {
      trip: updateTripDaysAndPlaces(trip, {
        days: nextDays,
        places: removeUnusedTripPlacesForDayItems(
          trip.places,
          nextDays,
          deletedItems,
        ),
        deps,
      }),
    },
  };
}

export function moveDayItem(
  trip: Trip,
  input: MoveDayItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const fromDay = trip.days.find(
    (candidate) => candidate.id === input.fromDayId,
  );
  const toDay = trip.days.find((candidate) => candidate.id === input.toDayId);

  if (!fromDay) {
    return createTripDayNotFoundError(input.fromDayId);
  }

  if (!toDay) {
    return createTripDayNotFoundError(input.toDayId);
  }

  const currentIndex = fromDay.items.findIndex(
    (item) => item.id === input.itemId,
  );

  if (currentIndex < 0) {
    return createTripDayItemNotFoundError(input.itemId);
  }

  const maxTargetIndex =
    input.fromDayId === input.toDayId
      ? fromDay.items.length - 1
      : toDay.items.length;

  if (
    !Number.isInteger(input.targetIndex) ||
    input.targetIndex < 0 ||
    input.targetIndex > maxTargetIndex
  ) {
    return createInvalidInputError("地点移动位置无效");
  }

  if (input.fromDayId === input.toDayId && currentIndex === input.targetIndex) {
    return { ok: true, data: { trip } };
  }

  const nextDays = trip.days.map((day) => {
    if (input.fromDayId === input.toDayId && day.id === input.fromDayId) {
      const nextItems = [...day.items];
      const [movedItem] = nextItems.splice(currentIndex, 1);

      if (movedItem) {
        nextItems.splice(input.targetIndex, 0, movedItem);
      }

      return { ...day, items: nextItems };
    }

    if (day.id === input.fromDayId) {
      return {
        ...day,
        items: day.items.filter((item) => item.id !== input.itemId),
      };
    }

    if (day.id === input.toDayId) {
      const moveResult = moveItemBetweenLists(
        fromDay.items,
        currentIndex,
        day.items,
        input.targetIndex,
      );
      return {
        ...day,
        items: moveResult.nextTargetItems,
      };
    }

    return day;
  });

  return {
    ok: true,
    data: {
      trip: updateTripDaysAndPlaces(trip, { days: nextDays, deps }),
    },
  };
}

export type RemoveDayItemInput = {
  dayId: string;
  itemId: string;
};

export function removeDayItem(
  trip: Trip,
  input: RemoveDayItemInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const day = trip.days.find((candidate) => candidate.id === input.dayId);

  if (!day) {
    return createTripDayNotFoundError(input.dayId);
  }

  const targetItem = day.items.find((item) => item.id === input.itemId);

  if (!targetItem) {
    return createTripDayItemNotFoundError(input.itemId);
  }

  const nextDays = trip.days.map((candidate) =>
    candidate.id === input.dayId
      ? {
          ...candidate,
          items: candidate.items.filter((item) => item.id !== input.itemId),
        }
      : candidate,
  );

  return {
    ok: true,
    data: {
      trip: updateTripDaysAndPlaces(trip, {
        days: nextDays,
        places: removeUnusedTripPlacesForDayItems(trip.places, nextDays, [
          targetItem,
        ]),
        deps,
      }),
    },
  };
}

export type AddMemoInput = {
  detail?: string;
  pinned?: boolean;
  title: string;
};

export function addMemo(
  trip: Trip,
  input: AddMemoInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ memoId: string; trip: Trip }> {
  const title = normalizeRequiredText(input.title);

  if (!title) {
    return createInvalidInputError("请先填写备忘标题");
  }

  const memoId = deps.idGen("memo");
  const nextMemo: TripMemo = {
    id: memoId,
    title,
    detail: normalizeOptionalText(input.detail),
    pinned: input.pinned,
  };

  return {
    ok: true,
    data: {
      memoId,
      trip: {
        ...trip,
        memos: [nextMemo, ...trip.memos],
        updatedAt: deps.clock(),
      },
    },
  };
}

export type UpsertTripExpenseInput = {
  amount: number;
  category: TripExpenseCategory;
  currency?: string;
  dayId?: string;
  expenseId?: string;
  note?: string;
  placeId?: string;
  placeName?: string;
  title?: string;
};

export function upsertTripExpense(
  trip: Trip,
  input: UpsertTripExpenseInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ expenseId: string; trip: Trip }> {
  const amount = normalizeExpenseAmount(input.amount);

  if (amount === undefined) {
    return createInvalidInputError("请填写有效金额");
  }

  const dayId = normalizeOptionalText(input.dayId);
  if (dayId && !trip.days.some((day) => day.id === dayId)) {
    return createTripDayNotFoundError(dayId);
  }

  const expenseId = normalizeOptionalText(input.expenseId);
  const existingExpense = expenseId
    ? trip.expenses.find((expense) => expense.id === expenseId)
    : undefined;

  if (expenseId && !existingExpense) {
    return createTripExpenseNotFoundError(expenseId);
  }

  const category = normalizeExpenseCategory(input.category);
  const now = deps.clock();

  const nextExpense: TripExpense = {
    ...(existingExpense ?? {
      id: deps.idGen("expense"),
      createdAt: now,
    }),
    amount,
    category,
    currency: normalizeExpenseCurrency(
      input.currency ?? existingExpense?.currency ?? trip.currency,
    ),
    date: getExpenseDateForDay(trip, dayId),
    dayId,
    note: normalizeOptionalText(input.note),
    placeId: normalizeOptionalText(input.placeId),
    placeName: normalizeOptionalText(input.placeName),
    title: normalizeOptionalText(input.title) ?? `${category}开销`,
    updatedAt: now,
  };

  const nextExpenses = existingExpense
    ? trip.expenses.map((expense) =>
        expense.id === nextExpense.id ? nextExpense : expense,
      )
    : [nextExpense, ...(trip.expenses ?? [])];

  return {
    ok: true,
    data: {
      expenseId: nextExpense.id,
      trip: {
        ...trip,
        expenses: nextExpenses,
        updatedAt: now,
      },
    },
  };
}

export type RemoveTripExpenseInput = {
  expenseId: string;
};

export function removeTripExpense(
  trip: Trip,
  input: RemoveTripExpenseInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const expenseId = normalizeRequiredText(input.expenseId);

  if (!expenseId) {
    return createInvalidInputError("请选择要删除的开销记录");
  }

  if (!trip.expenses.some((expense) => expense.id === expenseId)) {
    return createTripExpenseNotFoundError(expenseId);
  }

  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        expenses: trip.expenses.filter((expense) => expense.id !== expenseId),
        updatedAt: deps.clock(),
      },
    },
  };
}

export type SetTripDayItemCostInput = {
  amount?: number;
  dayId: string;
  itemId: string;
};

export function setTripDayItemCost(
  trip: Trip,
  input: SetTripDayItemCostInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const day = trip.days.find((candidate) => candidate.id === input.dayId);

  if (!day) {
    return createTripDayNotFoundError(input.dayId);
  }

  const targetItem = day.items.find((item) => item.id === input.itemId);

  if (!targetItem) {
    return createTripDayItemNotFoundError(input.itemId);
  }

  const amount =
    input.amount === undefined
      ? undefined
      : normalizeExpenseAmount(input.amount);

  if (input.amount !== undefined && amount === undefined) {
    return createInvalidInputError("请填写有效金额");
  }

  const now = deps.clock();
  const nextDays = trip.days.map((candidate) =>
    candidate.id === input.dayId
      ? {
          ...candidate,
          items: candidate.items.map(
            (item): TripDayItem =>
              item.id === input.itemId
                ? {
                    ...item,
                    cost: amount,
                    costRecordedAt:
                      amount === undefined
                        ? undefined
                        : amount !== item.cost || !item.costRecordedAt
                          ? now
                          : item.costRecordedAt,
                  }
                : item,
          ),
        }
      : candidate,
  );

  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        days: nextDays,
        updatedAt: now,
      },
    },
  };
}

export type SetTripGeneralNoteInput = {
  note?: string;
};

export type TripPoiNoteLine = {
  dayId: string;
  dayTitle: string;
  itemId: string;
  placeName: string;
  note: string;
};

export function setTripGeneralNote(
  trip: Trip,
  input: SetTripGeneralNoteInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        generalNote: normalizeOptionalText(input.note),
        updatedAt: deps.clock(),
      },
    },
  };
}

export function getTripPoiNoteLines(trip: Trip): TripPoiNoteLine[] {
  return trip.days.flatMap((day) =>
    day.items
      .map((item) => {
        const note = normalizeOptionalText(item.note);

        if (!note) {
          return undefined;
        }

        return {
          dayId: day.id,
          dayTitle: day.title,
          itemId: item.id,
          placeName: item.placeName ?? item.title,
          note,
        };
      })
      .filter((line): line is TripPoiNoteLine => Boolean(line)),
  );
}

export type SetTripDayItemNoteInput = {
  dayId: string;
  itemId: string;
  note?: string;
};

export function setTripDayItemNote(
  trip: Trip,
  input: SetTripDayItemNoteInput,
  deps: TripCommandDeps = defaultTripCommandDeps,
): TripCommandResult<{ trip: Trip }> {
  const day = trip.days.find((candidate) => candidate.id === input.dayId);

  if (!day) {
    return createTripDayNotFoundError(input.dayId);
  }

  if (!day.items.some((item) => item.id === input.itemId)) {
    return createTripDayItemNotFoundError(input.itemId);
  }

  const note = normalizeOptionalText(input.note);
  const now = deps.clock();
  const nextDays = trip.days.map((candidate) =>
    candidate.id === input.dayId
      ? {
          ...candidate,
          items: candidate.items.map((item) =>
            item.id === input.itemId
              ? {
                  ...item,
                  note,
                }
              : item,
          ),
        }
      : candidate,
  );

  return {
    ok: true,
    data: {
      trip: {
        ...trip,
        days: nextDays,
        updatedAt: now,
      },
    },
  };
}
