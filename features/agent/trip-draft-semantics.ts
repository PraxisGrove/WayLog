export const TRIP_DRAFT_REQUIRED_FIELDS = ["destination", "dayCount"] as const;

export type TripDraftRequiredField =
  (typeof TRIP_DRAFT_REQUIRED_FIELDS)[number];

export type TripDraftDateResolution =
  | { kind: "none" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "next_week" }
  | { endDate?: string; kind: "absolute"; startDate: string };

export type TripDraftResolvedDateRange = {
  endDate: string;
  startDate: string;
};

export type TripDraftSemantics = {
  cities: string[];
  companions: string[];
  confidence: number;
  dateExpression: string | null;
  dateResolution: TripDraftDateResolution;
  dayCount?: number;
  destination?: string;
  missingFields: TripDraftRequiredField[];
  preferences: string[];
  resolvedDateRange: TripDraftResolvedDateRange | null;
  semanticTitle?: string;
};

export type TripDraftSemanticsParseResult =
  | { data: TripDraftSemantics; ok: true }
  | { error: string; ok: false };

export type TripDraftTurnReference = {
  referenceTime: string;
  timeZone: string;
};

export function parseTripDraftSemantics(
  value: unknown,
  turnReference: TripDraftTurnReference,
): TripDraftSemanticsParseResult {
  if (!isRecord(value)) {
    return invalid("行程语义必须是对象。");
  }
  if (
    !hasOnlyKeys(value, [
      "cities",
      "companions",
      "confidence",
      "dateExpression",
      "dateResolution",
      "dayCount",
      "destination",
      "missingFields",
      "preferences",
      "resolvedDateRange",
      "semanticTitle",
    ])
  ) {
    return invalid("行程语义包含未声明字段。");
  }

  const referenceDate = new Date(turnReference.referenceTime);
  if (
    !Number.isFinite(referenceDate.getTime()) ||
    !isSupportedTimeZone(turnReference.timeZone)
  ) {
    return invalid("回合参考时间或时区无效。");
  }

  const destination = readOptionalString(value.destination);
  const dayCount = readDayCount(value.dayCount);
  const missingFields = readMissingFields(value.missingFields);
  const confidence = readConfidence(value.confidence);
  const dateExpression = readNullableString(value.dateExpression);
  const dateResolution = parseDateResolution(value.dateResolution);
  const cities = readStringArray(value.cities);
  const companions = readStringArray(value.companions);
  const preferences = readStringArray(value.preferences);

  if (
    missingFields === undefined ||
    confidence === undefined ||
    dateExpression === undefined ||
    !dateResolution ||
    !cities ||
    !companions ||
    !preferences
  ) {
    return invalid("行程语义字段不完整或格式无效。");
  }

  if (Boolean(destination) === missingFields.includes("destination")) {
    return invalid("destination 与 missingFields 不一致。");
  }
  if (Boolean(dayCount) === missingFields.includes("dayCount")) {
    return invalid("dayCount 与 missingFields 不一致。");
  }
  if ((dateResolution.kind === "none") !== (dateExpression === null)) {
    return invalid("日期表达与解析类型不一致。");
  }

  const resolvedDateRange = resolveTripDraftDateRange(
    dateResolution,
    dayCount,
    turnReference,
  );
  if (dateResolution.kind !== "none" && !resolvedDateRange) {
    return invalid("日期表达无法确定性解析。");
  }
  if (
    value.resolvedDateRange !== undefined &&
    !isMatchingResolvedDateRange(value.resolvedDateRange, resolvedDateRange)
  ) {
    return invalid("已保存日期范围与冻结 turn reference 不一致。");
  }

  const semanticTitle = createTripDraftSemanticTitle({
    dateExpression,
    dayCount,
    destination,
    proposedTitle: readOptionalString(value.semanticTitle),
  });

  return {
    data: {
      cities,
      companions,
      confidence,
      dateExpression,
      dateResolution,
      dayCount,
      destination,
      missingFields,
      preferences,
      resolvedDateRange,
      semanticTitle,
    },
    ok: true,
  };
}

function isMatchingResolvedDateRange(
  value: unknown,
  expected: TripDraftResolvedDateRange | null,
): boolean {
  if (value === null || expected === null) return value === expected;
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["endDate", "startDate"]) &&
    value.startDate === expected.startDate &&
    value.endDate === expected.endDate
  );
}

export function createTripDraftSemanticTitle(input: {
  dateExpression: string | null;
  dayCount?: number;
  destination?: string;
  proposedTitle?: string;
}): string | undefined {
  const proposedTitle = input.proposedTitle?.trim();
  const hasCapturedDestinationPhrase = Boolean(
    proposedTitle &&
      input.dateExpression &&
      input.destination &&
      proposedTitle.includes(`${input.dateExpression}去${input.destination}`),
  );

  if (
    proposedTitle &&
    proposedTitle.length <= 40 &&
    !hasCapturedDestinationPhrase
  ) {
    return proposedTitle;
  }

  return input.destination && input.dayCount
    ? `${input.destination}${input.dayCount}日游`
    : undefined;
}

function resolveTripDraftDateRange(
  resolution: TripDraftDateResolution,
  dayCount: number | undefined,
  reference: TripDraftTurnReference,
): TripDraftResolvedDateRange | null {
  if (resolution.kind === "none") return null;

  if (resolution.kind === "absolute") {
    const startDate = parseDateKey(resolution.startDate);
    const endDate = resolution.endDate
      ? parseDateKey(resolution.endDate)
      : dayCount && startDate
        ? addUtcDays(startDate, dayCount - 1)
        : startDate;

    return startDate && endDate && endDate >= startDate
      ? { endDate, startDate }
      : null;
  }

  const localDate = getDateKeyInTimeZone(
    reference.referenceTime,
    reference.timeZone,
  );
  if (!localDate) return null;

  if (resolution.kind === "today") {
    return {
      endDate: dayCount ? addUtcDays(localDate, dayCount - 1) : localDate,
      startDate: localDate,
    };
  }
  if (resolution.kind === "tomorrow") {
    const startDate = addUtcDays(localDate, 1);
    return {
      endDate: dayCount ? addUtcDays(startDate, dayCount - 1) : startDate,
      startDate,
    };
  }

  const weekday = getUtcWeekday(localDate);
  const startDate = addUtcDays(localDate, weekday === 0 ? 1 : 8 - weekday);
  return {
    endDate: addUtcDays(startDate, dayCount ? dayCount - 1 : 6),
    startDate,
  };
}

function getDateKeyInTimeZone(
  referenceTime: string,
  timeZone: string,
): string | undefined {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(referenceTime));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return parseDateKey(`${values.year}-${values.month}-${values.day}`);
}

function getUtcWeekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

function addUtcDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateResolution(
  value: unknown,
): TripDraftDateResolution | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.kind === "none" ||
    value.kind === "today" ||
    value.kind === "tomorrow" ||
    value.kind === "next_week"
  ) {
    return hasOnlyKeys(value, ["kind"]) ? { kind: value.kind } : undefined;
  }
  if (value.kind !== "absolute") return undefined;
  if (!hasOnlyKeys(value, ["endDate", "kind", "startDate"])) return undefined;
  const startDate = readOptionalString(value.startDate);
  const endDate = readOptionalString(value.endDate);
  return startDate ? { endDate, kind: "absolute", startDate } : undefined;
}

function parseDateKey(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function readMissingFields(
  value: unknown,
): TripDraftRequiredField[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => item === "destination" || item === "dayCount")) {
    return undefined;
  }
  return [...new Set(value)];
}

function readDayCount(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 14
    ? value
    : undefined;
}

function readConfidence(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  return value === null ? null : readOptionalString(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.map(readOptionalString);
  return values.every((item): item is string => Boolean(item))
    ? [...new Set(values)]
    : undefined;
}

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return Boolean(timeZone.trim());
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function invalid(error: string): TripDraftSemanticsParseResult {
  return { error, ok: false };
}
