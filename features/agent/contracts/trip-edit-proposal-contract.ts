import type { TripSelectedPlaceInput } from "../../trips/commands";
import { isTripPlaceCategory } from "../../trips/types";
import type { AgentContractParseResult } from "./contract-result";
import { createAgentContractParseError } from "./contract-result";
import {
  isRecord,
  readFiniteNumber,
  readPositiveInteger,
  readString,
} from "./contract-utils";

export type TripEditOperationBase = {
  operationId: string;
  tripId: string;
};

export type TripEditAddPlaceToDayOperation = TripEditOperationBase & {
  dayId?: string;
  dayIndex?: number;
  metadata?: {
    placeResolution: {
      address?: string;
      confidence: "high";
      provider: string;
      providerPlaceId: string;
      source: string;
    };
  };
  note?: string;
  place: TripSelectedPlaceInput;
  recommendationReason?: string;
  targetIndex?: number;
  time?: string;
  type: "add_place_to_day";
};

export type TripEditEnsureTripDayCountOperation = TripEditOperationBase & {
  dayCount: number;
  reason?: string;
  type: "ensure_trip_day_count";
};

export type TripEditMoveDayItemOperation = TripEditOperationBase & {
  fromDayId: string;
  itemId: string;
  reason?: string;
  targetIndex: number;
  toDayId: string;
  type: "move_day_item";
};

export type TripEditRemoveDayItemOperation = TripEditOperationBase & {
  dayId: string;
  itemId: string;
  reason?: string;
  type: "remove_day_item";
};

export type TripEditUpdateDayItemOperation = TripEditOperationBase & {
  changes: {
    note?: string;
    recommendationReason?: string;
    time?: string;
    title?: string;
  };
  dayId: string;
  itemId: string;
  reason?: string;
  type: "update_day_item";
};

export type TripEditUpdateTripDayTitleOperation = TripEditOperationBase & {
  dayId: string;
  reason?: string;
  title: string;
  type: "update_trip_day_title";
};

export type TripEditOperation =
  | TripEditAddPlaceToDayOperation
  | TripEditEnsureTripDayCountOperation
  | TripEditMoveDayItemOperation
  | TripEditRemoveDayItemOperation
  | TripEditUpdateDayItemOperation
  | TripEditUpdateTripDayTitleOperation;

export type TripEditProposal = {
  expectedUpdatedAt: string;
  operations: TripEditOperation[];
  proposalId: string;
  summary: string;
  tripId: string;
};

export function parseTripEditProposal(
  value: unknown,
): AgentContractParseResult<TripEditProposal> {
  if (!isRecord(value)) {
    return createAgentContractParseError(
      "INVALID_FIELD",
      "TripEditProposal 必须是对象",
      "proposal",
    );
  }

  const proposalId = readString(value.proposalId);
  const tripId = readString(value.tripId);
  const expectedUpdatedAt = readString(value.expectedUpdatedAt);
  const summary = readString(value.summary);

  if (!proposalId || !tripId || !expectedUpdatedAt || !summary) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "TripEditProposal 缺少 proposalId、tripId、expectedUpdatedAt 或 summary",
      "proposal",
    );
  }

  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "TripEditProposal 至少需要一个 operation",
      "proposal.operations",
    );
  }

  const operations: TripEditOperation[] = [];
  const seenOperationIds = new Set<string>();

  for (const [index, operationValue] of value.operations.entries()) {
    const operationResult = parseTripEditOperation(
      operationValue,
      `proposal.operations.${index}`,
    );

    if (!operationResult.ok) {
      return operationResult;
    }

    if (seenOperationIds.has(operationResult.data.operationId)) {
      return createAgentContractParseError(
        "DUPLICATE_OPERATION",
        `同一 TripEditProposal 中重复出现 operation ${operationResult.data.operationId}`,
        `proposal.operations.${index}.operationId`,
      );
    }

    seenOperationIds.add(operationResult.data.operationId);
    operations.push(operationResult.data);
  }

  return {
    ok: true,
    data: {
      expectedUpdatedAt,
      operations,
      proposalId,
      summary,
      tripId,
    },
  };
}

function parseTripEditOperation(
  value: unknown,
  path: string,
): AgentContractParseResult<TripEditOperation> {
  if (!isRecord(value)) {
    return createAgentContractParseError(
      "INVALID_FIELD",
      "TripEditOperation 必须是对象",
      path,
    );
  }

  const type = readString(value.type);

  switch (type) {
    case "add_place_to_day":
      return parseAddPlaceToDayOperation(value, path);
    case "ensure_trip_day_count":
      return parseEnsureTripDayCountOperation(value, path);
    case "move_day_item":
      return parseMoveDayItemOperation(value, path);
    case "remove_day_item":
      return parseRemoveDayItemOperation(value, path);
    case "update_day_item":
      return parseUpdateDayItemOperation(value, path);
    case "update_trip_day_title":
      return parseUpdateTripDayTitleOperation(value, path);
    default:
      return createAgentContractParseError(
        "INVALID_FIELD",
        `暂不支持的 TripEditOperation 类型：${type ?? ""}`,
        `${path}.type`,
      );
  }
}

function parseOperationBase(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditOperationBase> {
  const operationId = readString(value.operationId);
  const tripId = readString(value.tripId);

  if (!operationId || !tripId) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "TripEditOperation 缺少 operationId 或 tripId",
      path,
    );
  }

  return { ok: true, data: { operationId, tripId } };
}

function parseAddPlaceToDayOperation(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditAddPlaceToDayOperation> {
  const baseResult = parseOperationBase(value, path);

  if (!baseResult.ok) {
    return baseResult;
  }

  const dayId = readString(value.dayId);
  const dayIndex = readPositiveInteger(value.dayIndex);
  const placeResult = parseTripSelectedPlaceInput(value.place, `${path}.place`);

  if (!dayId && dayIndex === undefined) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "add_place_to_day 需要 dayId 或 dayIndex",
      path,
    );
  }

  if (!placeResult.ok) {
    return placeResult;
  }

  const targetIndex = readNonNegativeIntegerField(value.targetIndex);

  if (value.targetIndex !== undefined && targetIndex === undefined) {
    return createAgentContractParseError(
      "INVALID_FIELD",
      "targetIndex 必须是非负整数",
      `${path}.targetIndex`,
    );
  }

  return {
    ok: true,
    data: {
      ...baseResult.data,
      dayId,
      dayIndex,
      metadata: parseVerifiedPlaceResolutionMetadata(value.metadata),
      note: readString(value.note),
      place: placeResult.data,
      recommendationReason: readString(value.recommendationReason),
      targetIndex,
      time: readString(value.time),
      type: "add_place_to_day",
    },
  };
}

function parseVerifiedPlaceResolutionMetadata(
  value: unknown,
): TripEditAddPlaceToDayOperation["metadata"] {
  if (!isRecord(value) || !isRecord(value.placeResolution)) {
    return undefined;
  }
  const provider = readString(value.placeResolution.provider);
  const providerPlaceId = readString(value.placeResolution.providerPlaceId);
  if (
    !provider ||
    !providerPlaceId ||
    value.placeResolution.confidence !== "high"
  ) {
    return undefined;
  }

  return {
    placeResolution: {
      address: readString(value.placeResolution.address),
      confidence: "high",
      provider,
      providerPlaceId,
      source: readString(value.placeResolution.source) ?? provider,
    },
  };
}

function parseEnsureTripDayCountOperation(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditEnsureTripDayCountOperation> {
  const baseResult = parseOperationBase(value, path);

  if (!baseResult.ok) {
    return baseResult;
  }

  const dayCount = readPositiveInteger(value.dayCount);

  if (dayCount === undefined) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "ensure_trip_day_count 需要 dayCount",
      `${path}.dayCount`,
    );
  }

  return {
    ok: true,
    data: {
      ...baseResult.data,
      dayCount,
      reason: readString(value.reason),
      type: "ensure_trip_day_count",
    },
  };
}

function parseMoveDayItemOperation(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditMoveDayItemOperation> {
  const baseResult = parseOperationBase(value, path);

  if (!baseResult.ok) {
    return baseResult;
  }

  const fromDayId = readString(value.fromDayId);
  const itemId = readString(value.itemId);
  const targetIndex = readNonNegativeIntegerField(value.targetIndex);
  const toDayId = readString(value.toDayId);

  if (!fromDayId || !itemId || targetIndex === undefined || !toDayId) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "move_day_item 缺少 fromDayId、itemId、targetIndex 或 toDayId",
      path,
    );
  }

  return {
    ok: true,
    data: {
      ...baseResult.data,
      fromDayId,
      itemId,
      reason: readString(value.reason),
      targetIndex,
      toDayId,
      type: "move_day_item",
    },
  };
}

function parseRemoveDayItemOperation(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditRemoveDayItemOperation> {
  const baseResult = parseOperationBase(value, path);

  if (!baseResult.ok) {
    return baseResult;
  }

  const dayId = readString(value.dayId);
  const itemId = readString(value.itemId);

  if (!dayId || !itemId) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "remove_day_item 缺少 dayId 或 itemId",
      path,
    );
  }

  return {
    ok: true,
    data: {
      ...baseResult.data,
      dayId,
      itemId,
      reason: readString(value.reason),
      type: "remove_day_item",
    },
  };
}

function parseUpdateDayItemOperation(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditUpdateDayItemOperation> {
  const baseResult = parseOperationBase(value, path);

  if (!baseResult.ok) {
    return baseResult;
  }

  const dayId = readString(value.dayId);
  const itemId = readString(value.itemId);
  const changes = parseUpdateDayItemChanges(value.changes);

  if (!dayId || !itemId) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "update_day_item 缺少 dayId 或 itemId",
      path,
    );
  }

  if (!changes) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "update_day_item 至少需要一个 changes 字段",
      `${path}.changes`,
    );
  }

  return {
    ok: true,
    data: {
      ...baseResult.data,
      changes,
      dayId,
      itemId,
      reason: readString(value.reason),
      type: "update_day_item",
    },
  };
}

function parseUpdateTripDayTitleOperation(
  value: Record<string, unknown>,
  path: string,
): AgentContractParseResult<TripEditUpdateTripDayTitleOperation> {
  const baseResult = parseOperationBase(value, path);

  if (!baseResult.ok) {
    return baseResult;
  }

  const dayId = readString(value.dayId);
  const title = readString(value.title);

  if (!dayId || !title) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "update_trip_day_title 缺少 dayId 或 title",
      path,
    );
  }

  return {
    ok: true,
    data: {
      ...baseResult.data,
      dayId,
      reason: readString(value.reason),
      title,
      type: "update_trip_day_title",
    },
  };
}

function parseUpdateDayItemChanges(
  value: unknown,
): TripEditUpdateDayItemOperation["changes"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const changes: TripEditUpdateDayItemOperation["changes"] = {};
  const note = readString(value.note);
  const recommendationReason = readString(value.recommendationReason);
  const time = readString(value.time);
  const title = readString(value.title);

  if (note !== undefined) {
    changes.note = note;
  }

  if (recommendationReason !== undefined) {
    changes.recommendationReason = recommendationReason;
  }

  if (time !== undefined) {
    changes.time = time;
  }

  if (title !== undefined) {
    changes.title = title;
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

function parseTripSelectedPlaceInput(
  value: unknown,
  path: string,
): AgentContractParseResult<TripSelectedPlaceInput> {
  if (!isRecord(value)) {
    return createAgentContractParseError(
      "INVALID_FIELD",
      "地点信息必须是对象",
      path,
    );
  }

  const name = readString(value.name);

  if (!name) {
    return createAgentContractParseError(
      "MISSING_REQUIRED_FIELD",
      "地点信息缺少 name",
      `${path}.name`,
    );
  }

  return {
    ok: true,
    data: {
      address: readString(value.address),
      area: readString(value.area),
      category: isTripPlaceCategory(value.category)
        ? value.category
        : undefined,
      id: readString(value.id),
      latitude: readFiniteNumber(value.latitude),
      longitude: readFiniteNumber(value.longitude),
      name,
      poiType: readString(value.poiType),
      provider: readString(value.provider),
      providerPlaceId: readString(value.providerPlaceId),
      sourcePlaceId: readString(value.sourcePlaceId),
    },
  };
}

function readNonNegativeIntegerField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}
