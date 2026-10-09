import { formatTripDayTitle } from "../trips/day-title";
import type {
  CreateTripInput,
  TripDay,
  TripDayItem,
  TripPlace,
  TripPlaceCategory,
  TripPlaceIconKey,
  TripPlacePoiGroup,
} from "../trips/types";
import type {
  TripDraftRequiredField,
  TripDraftResolvedDateRange,
} from "./trip-draft-semantics";

export const AGENT_TRIP_DRAFT_INDEX_STORAGE_KEY =
  "waylog.agent.trip-drafts.index.v1";
export const AGENT_TRIP_DRAFT_STORAGE_KEY_PREFIX =
  "waylog.agent.trip-draft.v1.";

const DEFAULT_TRIP_DRAFT_DAY_COUNT = 3;
const MAX_TRIP_DRAFT_DAY_COUNT = 14;
const MAX_AGENT_TRIP_DRAFTS = 20;
const DEFAULT_TRIP_DRAFT_CURRENCY = "CNY";

export type AgentTripDraftItem = {
  address?: string;
  area?: string;
  category?: TripPlaceCategory;
  latitude?: number;
  longitude?: number;
  note?: string;
  placeName?: string;
  poiType?: string;
  provider?: string;
  providerPlaceId?: string;
  recommendationReason?: string;
  time?: string;
  title: string;
};

export type AgentTripDraftDay = {
  dayIndex: number;
  items: AgentTripDraftItem[];
  summary?: string;
  title: string;
};

export type AgentTripDraft = {
  assumptions: string[];
  cities?: string[];
  companions?: string[];
  confidence?: number;
  createdAt: string;
  dateExpression?: string | null;
  dayCount: number;
  days: AgentTripDraftDay[];
  destination: string;
  draftId: string;
  endDate?: string;
  missingFields?: TripDraftRequiredField[];
  preferences?: string[];
  resolvedDateRange?: TripDraftResolvedDateRange | null;
  semanticTitle?: string;
  source: "local_v1";
  startDate?: string;
  title: string;
  updatedAt: string;
  userMessage?: string;
  warnings: string[];
  planner?: AgentTripDraftPlannerMeta;
};

export type ReliableAgentTripDraft = AgentTripDraft & {
  cities: string[];
  companions: string[];
  confidence: number;
  dateExpression: string | null;
  missingFields: [];
  preferences: string[];
  resolvedDateRange: TripDraftResolvedDateRange | null;
  semanticTitle: string;
};

export type AgentTripDraftPlannerMeta = {
  qualityChecks: AgentTripDraftQualityCheck[];
  steps: AgentTripDraftPlannerStep[];
};

export type AgentTripDraftPlannerStep = {
  description: string;
  id: string;
  status: "completed" | "skipped";
};

export type AgentTripDraftQualityCheck = {
  id: string;
  message: string;
  status: "pass" | "warning";
};

export type AgentTripDraftSummary = {
  createdAt: string;
  dayCount: number;
  destination: string;
  draftId: string;
  title: string;
  updatedAt: string;
};

export type AgentTripDraftIndex = {
  summaries: AgentTripDraftSummary[];
  version: 1;
};

export type AgentTripDraftStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AgentTripDraftDeps = {
  storage?: AgentTripDraftStorage;
};

export type TripDraftToCreateTripInputOptions = {
  currency?: string;
};

export function tripDraftToCreateTripInput(
  draft: AgentTripDraft,
  options: TripDraftToCreateTripInputOptions = {},
): CreateTripInput {
  const normalizedDraft = normalizeAgentTripDraft(draft);
  const places: TripPlace[] = [];
  const days: TripDay[] = normalizedDraft.days.map((day) => ({
    dayIndex: day.dayIndex,
    id: createDraftEntityId("day", normalizedDraft.draftId, day.dayIndex),
    items: day.items.map((item, itemIndex) => {
      const placeName =
        normalizeText(item.placeName) || normalizeText(item.title);
      const placeId = placeName
        ? createDraftEntityId(
            "place",
            normalizedDraft.draftId,
            day.dayIndex,
            itemIndex + 1,
          )
        : undefined;
      const category = item.category ?? createDefaultPlaceCategory();
      const iconKey = getIconKeyForCategory(category);

      if (
        placeId &&
        placeName &&
        !places.some((place) => place.id === placeId)
      ) {
        places.push({
          address: item.address,
          area: item.area,
          category,
          iconKey,
          id: placeId,
          isScheduled: true,
          latitude: item.latitude,
          longitude: item.longitude,
          llm: item.recommendationReason
            ? {
                text: item.recommendationReason,
              }
            : undefined,
          name: placeName,
          note: item.note,
          poiGroup: getPoiGroupForCategory(category),
          poiType: item.poiType,
          provider: item.provider,
          providerPlaceId: item.providerPlaceId,
          externalRefs:
            item.provider === "amap" && item.providerPlaceId
              ? { amapPoiId: item.providerPlaceId }
              : undefined,
        });
      }

      return {
        category,
        iconKey,
        id: createDraftEntityId(
          "item",
          normalizedDraft.draftId,
          day.dayIndex,
          itemIndex + 1,
        ),
        note: item.note,
        placeId,
        placeName: placeName || undefined,
        recommendationReason: item.recommendationReason,
        time: normalizeTime(item.time),
        title:
          normalizeText(item.title) || placeName || `第 ${day.dayIndex} 天安排`,
      } satisfies TripDayItem;
    }),
    summary: day.summary,
    title: day.title,
  }));

  return {
    currency: options.currency ?? DEFAULT_TRIP_DRAFT_CURRENCY,
    days,
    destination: normalizedDraft.destination,
    endDate: normalizedDraft.endDate,
    generalNote: createTripDraftGeneralNote(normalizedDraft),
    places,
    startDate: normalizedDraft.startDate,
    title: normalizedDraft.title,
  };
}

export async function saveAgentTripDraft(
  draft: AgentTripDraft,
  deps: AgentTripDraftDeps = {},
): Promise<AgentTripDraft> {
  const storage = await getAgentTripDraftStorage(deps);
  const normalizedDraft = normalizeAgentTripDraft(draft);
  const index = await getAgentTripDraftIndex(deps);
  const nextIndex: AgentTripDraftIndex = {
    summaries: [
      createAgentTripDraftSummary(normalizedDraft),
      ...index.summaries.filter(
        (summary) => summary.draftId !== normalizedDraft.draftId,
      ),
    ].slice(0, MAX_AGENT_TRIP_DRAFTS),
    version: 1,
  };

  await storage.setItem(
    getAgentTripDraftStorageKey(normalizedDraft.draftId),
    JSON.stringify({
      draft: normalizedDraft,
      version: 1,
    }),
  );
  await storage.setItem(
    AGENT_TRIP_DRAFT_INDEX_STORAGE_KEY,
    JSON.stringify(nextIndex),
  );

  return normalizedDraft;
}

export async function getAgentTripDraft(
  draftId: string,
  deps: AgentTripDraftDeps = {},
): Promise<AgentTripDraft | undefined> {
  const storage = await getAgentTripDraftStorage(deps);
  const rawValue = await storage.getItem(getAgentTripDraftStorageKey(draftId));

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue);
    const draftValue =
      isRecord(parsed) && parsed.version === 1 ? parsed.draft : parsed;

    return parseAgentTripDraft(draftValue);
  } catch {
    return undefined;
  }
}

export async function deleteAgentTripDraft(
  draftId: string,
  deps: AgentTripDraftDeps = {},
): Promise<void> {
  const storage = await getAgentTripDraftStorage(deps);
  const index = await getAgentTripDraftIndex(deps);
  const nextIndex: AgentTripDraftIndex = {
    summaries: index.summaries.filter((summary) => summary.draftId !== draftId),
    version: 1,
  };

  if (storage.removeItem) {
    await storage.removeItem(getAgentTripDraftStorageKey(draftId));
  } else {
    await storage.setItem(getAgentTripDraftStorageKey(draftId), "");
  }
  await storage.setItem(
    AGENT_TRIP_DRAFT_INDEX_STORAGE_KEY,
    JSON.stringify(nextIndex),
  );
}

export async function getAgentTripDraftIndex(
  deps: AgentTripDraftDeps = {},
): Promise<AgentTripDraftIndex> {
  const storage = await getAgentTripDraftStorage(deps);
  const rawValue = await storage.getItem(AGENT_TRIP_DRAFT_INDEX_STORAGE_KEY);

  if (!rawValue) {
    return { summaries: [], version: 1 };
  }

  try {
    const parsed = JSON.parse(rawValue);

    return normalizeAgentTripDraftIndex(parsed);
  } catch {
    return { summaries: [], version: 1 };
  }
}

export function getAgentTripDraftStorageKey(draftId: string): string {
  return `${AGENT_TRIP_DRAFT_STORAGE_KEY_PREFIX}${draftId}`;
}

function createEmptyDraftDay(dayIndex: number): AgentTripDraftDay {
  return {
    dayIndex,
    items: [],
    title: formatTripDayTitle(dayIndex),
  };
}

function clampDayCount(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TRIP_DRAFT_DAY_COUNT;
  }

  return Math.min(MAX_TRIP_DRAFT_DAY_COUNT, Math.max(1, Math.floor(value)));
}

function normalizeAgentTripDraft(draft: AgentTripDraft): AgentTripDraft {
  const destination = normalizeText(draft.destination) || "新目的地";
  const dayCount = clampDayCount(
    draft.dayCount || draft.days.length || DEFAULT_TRIP_DRAFT_DAY_COUNT,
  );
  const days =
    draft.days.length > 0
      ? draft.days
          .slice(0, dayCount)
          .map((day, index) => normalizeAgentTripDraftDay(day, index + 1))
      : [];
  const normalizedDays =
    days.length >= dayCount
      ? days
      : [
          ...days,
          ...Array.from({ length: dayCount - days.length }, (_, index) =>
            createEmptyDraftDay(days.length + index + 1),
          ),
        ];

  return {
    assumptions: draft.assumptions.filter(Boolean),
    cities: draft.cities ? readStringArray(draft.cities) : undefined,
    companions: draft.companions
      ? readStringArray(draft.companions)
      : undefined,
    confidence:
      typeof draft.confidence === "number" &&
      draft.confidence >= 0 &&
      draft.confidence <= 1
        ? draft.confidence
        : undefined,
    createdAt: draft.createdAt,
    dateExpression:
      draft.dateExpression === null
        ? null
        : normalizeText(draft.dateExpression),
    dayCount,
    days: normalizedDays,
    destination,
    draftId: normalizeText(draft.draftId) || createDraftId(),
    endDate: normalizeDateKey(draft.endDate),
    missingFields: draft.missingFields?.filter(
      (field): field is TripDraftRequiredField =>
        field === "destination" || field === "dayCount",
    ),
    preferences: draft.preferences
      ? readStringArray(draft.preferences)
      : undefined,
    resolvedDateRange: draft.resolvedDateRange,
    semanticTitle: normalizeText(draft.semanticTitle),
    source: "local_v1",
    startDate: normalizeDateKey(draft.startDate),
    title: normalizeText(draft.title) || `${destination} ${dayCount} 日游`,
    updatedAt: draft.updatedAt || draft.createdAt,
    userMessage: normalizeText(draft.userMessage),
    warnings: draft.warnings.filter(Boolean),
    planner: normalizeAgentTripDraftPlannerMeta(draft.planner),
  };
}

function normalizeAgentTripDraftDay(
  day: AgentTripDraftDay,
  fallbackDayIndex: number,
): AgentTripDraftDay {
  const dayIndex = clampDayCount(day.dayIndex || fallbackDayIndex);
  const items = day.items
    .map(normalizeAgentTripDraftItem)
    .filter((item): item is AgentTripDraftItem => Boolean(item));

  return {
    dayIndex,
    items,
    summary: normalizeText(day.summary),
    title: normalizeText(day.title) || formatTripDayTitle(dayIndex),
  };
}

function normalizeAgentTripDraftItem(
  item: AgentTripDraftItem,
): AgentTripDraftItem | undefined {
  const title = normalizeText(item.title) || normalizeText(item.placeName);

  if (!title) {
    return undefined;
  }

  return {
    address: normalizeText(item.address),
    area: normalizeText(item.area),
    category: item.category,
    latitude: normalizeCoordinate(item.latitude, -90, 90),
    longitude: normalizeCoordinate(item.longitude, -180, 180),
    note: normalizeText(item.note),
    placeName: normalizeText(item.placeName),
    poiType: normalizeText(item.poiType),
    provider: normalizeText(item.provider),
    providerPlaceId: normalizeText(item.providerPlaceId),
    recommendationReason: normalizeText(item.recommendationReason),
    time: normalizeTime(item.time),
    title,
  };
}

export function parseAgentTripDraft(
  value: unknown,
): AgentTripDraft | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const draftId = readString(value.draftId);
  const title = readString(value.title);
  const destination = readString(value.destination);
  const createdAt = readString(value.createdAt);
  const updatedAt = readString(value.updatedAt) ?? createdAt;
  const days = Array.isArray(value.days)
    ? value.days
        .map(parseAgentTripDraftDay)
        .filter((day): day is AgentTripDraftDay => Boolean(day))
    : [];

  if (
    !draftId ||
    !title ||
    !destination ||
    !createdAt ||
    !updatedAt ||
    days.length === 0
  ) {
    return undefined;
  }

  return normalizeAgentTripDraft({
    assumptions: readStringArray(value.assumptions),
    cities: readStringArray(value.cities),
    companions: readStringArray(value.companions),
    confidence: readNumber(value.confidence),
    createdAt,
    dateExpression:
      value.dateExpression === null ? null : readString(value.dateExpression),
    dayCount: readNumber(value.dayCount) ?? days.length,
    days,
    destination,
    draftId,
    endDate: readString(value.endDate),
    missingFields: Array.isArray(value.missingFields)
      ? value.missingFields.filter(
          (field): field is TripDraftRequiredField =>
            field === "destination" || field === "dayCount",
        )
      : undefined,
    preferences: readStringArray(value.preferences),
    resolvedDateRange: parseResolvedDateRange(value.resolvedDateRange),
    semanticTitle: readString(value.semanticTitle),
    source: "local_v1",
    startDate: readString(value.startDate),
    title,
    updatedAt,
    userMessage: readString(value.userMessage),
    warnings: readStringArray(value.warnings),
    planner: parseAgentTripDraftPlannerMeta(value.planner),
  });
}

function parseResolvedDateRange(
  value: unknown,
): TripDraftResolvedDateRange | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const startDate = normalizeDateKey(value.startDate);
  const endDate = normalizeDateKey(value.endDate);
  return startDate && endDate ? { endDate, startDate } : undefined;
}

function parseAgentTripDraftDay(value: unknown): AgentTripDraftDay | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const dayIndex = readNumber(value.dayIndex);
  const title = readString(value.title);
  const items = Array.isArray(value.items)
    ? value.items
        .map(parseAgentTripDraftItem)
        .filter((item): item is AgentTripDraftItem => Boolean(item))
    : [];

  if (!dayIndex) {
    return undefined;
  }

  return {
    dayIndex,
    items,
    summary: readString(value.summary),
    title: title || formatTripDayTitle(dayIndex),
  };
}

function parseAgentTripDraftItem(
  value: unknown,
): AgentTripDraftItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const title = readString(value.title);

  if (!title) {
    return undefined;
  }

  return {
    address: readString(value.address),
    area: readString(value.area),
    category: readString(value.category) as TripPlaceCategory | undefined,
    latitude: readNumber(value.latitude),
    longitude: readNumber(value.longitude),
    note: readString(value.note),
    placeName: readString(value.placeName),
    poiType: readString(value.poiType),
    provider: readString(value.provider),
    providerPlaceId: readString(value.providerPlaceId),
    recommendationReason: readString(value.recommendationReason),
    time: readString(value.time),
    title,
  };
}

function normalizeAgentTripDraftPlannerMeta(
  value: AgentTripDraftPlannerMeta | undefined,
): AgentTripDraftPlannerMeta | undefined {
  return parseAgentTripDraftPlannerMeta(value);
}

function parseAgentTripDraftPlannerMeta(
  value: unknown,
): AgentTripDraftPlannerMeta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const steps = Array.isArray(value.steps)
    ? value.steps
        .map(parseAgentTripDraftPlannerStep)
        .filter((step): step is AgentTripDraftPlannerStep => Boolean(step))
    : [];
  const qualityChecks = Array.isArray(value.qualityChecks)
    ? value.qualityChecks
        .map(parseAgentTripDraftQualityCheck)
        .filter((check): check is AgentTripDraftQualityCheck => Boolean(check))
    : [];

  return steps.length > 0 || qualityChecks.length > 0
    ? {
        qualityChecks,
        steps,
      }
    : undefined;
}

function parseAgentTripDraftPlannerStep(
  value: unknown,
): AgentTripDraftPlannerStep | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value.id);
  const description = readString(value.description);
  const status =
    value.status === "completed" || value.status === "skipped"
      ? value.status
      : undefined;

  return id && description && status
    ? {
        description,
        id,
        status,
      }
    : undefined;
}

function parseAgentTripDraftQualityCheck(
  value: unknown,
): AgentTripDraftQualityCheck | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value.id);
  const message = readString(value.message);
  const status =
    value.status === "pass" || value.status === "warning"
      ? value.status
      : undefined;

  return id && message && status
    ? {
        id,
        message,
        status,
      }
    : undefined;
}

function normalizeAgentTripDraftIndex(value: unknown): AgentTripDraftIndex {
  if (!isRecord(value) || !Array.isArray(value.summaries)) {
    return { summaries: [], version: 1 };
  }

  return {
    summaries: value.summaries
      .map(parseAgentTripDraftSummary)
      .filter((summary): summary is AgentTripDraftSummary => Boolean(summary))
      .slice(0, MAX_AGENT_TRIP_DRAFTS),
    version: 1,
  };
}

function parseAgentTripDraftSummary(
  value: unknown,
): AgentTripDraftSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const draftId = readString(value.draftId);
  const title = readString(value.title);
  const destination = readString(value.destination);
  const createdAt = readString(value.createdAt);
  const updatedAt = readString(value.updatedAt);
  const dayCount = readNumber(value.dayCount);

  if (
    !draftId ||
    !title ||
    !destination ||
    !createdAt ||
    !updatedAt ||
    !dayCount
  ) {
    return undefined;
  }

  return {
    createdAt,
    dayCount,
    destination,
    draftId,
    title,
    updatedAt,
  };
}

function createAgentTripDraftSummary(
  draft: AgentTripDraft,
): AgentTripDraftSummary {
  return {
    createdAt: draft.createdAt,
    dayCount: draft.dayCount,
    destination: draft.destination,
    draftId: draft.draftId,
    title: draft.title,
    updatedAt: draft.updatedAt,
  };
}

function createTripDraftGeneralNote(draft: AgentTripDraft): string {
  return [
    "由 Agent 智能规划草案创建。",
    draft.userMessage ? `原始需求：${draft.userMessage}` : undefined,
    draft.assumptions.length
      ? `规划假设：${draft.assumptions.join("；")}`
      : undefined,
    draft.warnings.length
      ? `注意事项：${draft.warnings.join("；")}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

async function getAgentTripDraftStorage(
  deps: AgentTripDraftDeps,
): Promise<AgentTripDraftStorage> {
  if (deps.storage) {
    return deps.storage;
  }

  const asyncStorage = await import(
    "@react-native-async-storage/async-storage"
  );

  return asyncStorage.default as unknown as AgentTripDraftStorage;
}

function createDraftId(): string {
  return `trip-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDraftEntityId(
  prefix: string,
  draftId: string,
  dayIndex: number,
  itemIndex?: number,
): string {
  return [
    prefix,
    safeIdSegment(draftId),
    String(dayIndex),
    itemIndex ? String(itemIndex) : undefined,
  ]
    .filter(Boolean)
    .join("-");
}

function safeIdSegment(value: string): string {
  const segment = value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return segment || "draft";
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeTime(value: unknown): string | undefined {
  const text = normalizeText(value);

  if (!text) {
    return undefined;
  }

  const match = text.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toDateKey(
  yearValue: string | undefined,
  monthValue: string | undefined,
  dayValue: string | undefined,
): string | undefined {
  if (!yearValue || !monthValue || !dayValue) {
    return undefined;
  }

  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const day = Number.parseInt(dayValue, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDateKey(value: unknown): string | undefined {
  const text = normalizeText(value);
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return match ? toDateKey(match[1], match[2], match[3]) : undefined;
}

function readString(value: unknown): string | undefined {
  return normalizeText(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeCoordinate(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createDefaultPlaceCategory(): TripPlaceCategory {
  return "景点";
}

function getIconKeyForCategory(category: TripPlaceCategory): TripPlaceIconKey {
  switch (category) {
    case "餐厅":
      return "restaurant";
    case "酒店":
      return "hotel";
    case "交通":
      return "train";
    case "购物":
      return "shopping";
    default:
      return "attraction";
  }
}

function getPoiGroupForCategory(
  category: TripPlaceCategory,
): TripPlacePoiGroup {
  switch (category) {
    case "餐厅":
      return "food";
    case "酒店":
      return "hotel";
    case "交通":
      return "transport";
    case "购物":
      return "shopping";
    default:
      return "attraction";
  }
}
