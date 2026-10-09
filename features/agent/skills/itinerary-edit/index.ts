/**
 * @file Itinerary edit Skill (itinerary.edit).
 *
 * Unifies the four common Trip editing operations behind one controlled skill:
 * add_place_to_day, update_day_item, move_day_item, and remove_day_item.
 */

import type { TripSelectedPlaceInput } from "../../../trips/commands";
import { canUseProviderPlaceIdAsAmapPoiId } from "../../../trips/place-identity";
import type {
  Trip,
  TripDay,
  TripDayItem,
  TripPlaceCategory,
  TripPlaceExternalRefs,
  TripPlacePhoto,
} from "../../../trips/types";
import type {
  AgentSkillDefinition,
  AgentSkillResult,
  AgentSkillRunContext,
  AgentSkillRunResult,
} from "../../skill-types";
import { createAgentSkillError } from "../../skill-types";
import type { TripEditProposal } from "../../contracts/trip-edit-proposal-contract";

type ItineraryEditAction =
  | "add_place_to_day"
  | "move_day_item"
  | "remove_day_item"
  | "update_day_item";

type ItineraryEditAddInput = {
  action: "add_place_to_day";
  autoCreateMissingDays?: boolean;
  dayId?: string;
  dayIndex?: number;
  note?: string;
  place: TripSelectedPlaceInput;
  targetIndex?: number;
  time?: string;
  type?: "add_place_to_day";
};

type ItineraryEditUpdateInput = {
  action: "update_day_item";
  changes: {
    note?: string;
    time?: string;
    title?: string;
  };
  dayId: string;
  itemId: string;
  type?: "update_day_item";
};

type ItineraryEditMoveInput = {
  action: "move_day_item";
  fromDayId: string;
  itemId: string;
  targetIndex: number;
  toDayId: string;
  type?: "move_day_item";
};

type ItineraryEditPatchInput =
  | ItineraryEditMoveInput
  | ItineraryEditUpdateInput;

type ItineraryEditRemoveInput = {
  action: "remove_day_item";
  dayId: string;
  itemId: string;
  reason?: string;
  type?: "remove_day_item";
};

export type ItineraryEditSkillInput =
  | ItineraryEditAddInput
  | ItineraryEditPatchInput
  | ItineraryEditRemoveInput;

type ParseItineraryEditSkillInputResult =
  | { ok: true; data: ItineraryEditSkillInput }
  | ReturnType<typeof createAgentSkillError>;

export const itineraryEditSkill: AgentSkillDefinition<unknown> = {
  allowedInternalActions: ["get_trip_context", "propose_trip_patch"],
  allowedRuntimeTools: ["poi.search"],
  allowedTools: ["get_trip_context", "search_places", "propose_trip_patch"],
  description:
    "统一处理行程增删改移：添加地点、更新行程点、移动行程点、删除行程点。删除会产出高风险提案，必须由用户明确确认。",
  id: "itinerary.edit",
  maxToolCalls: 3,
  output: "proposal",
  routeMetadata: {
    description:
      "Generate a confirmable edit proposal for an existing Trip itinerary.",
    name: "itinerary.edit",
    requiredContext: ["selectedTrip.full"],
    routeType: "trip_edit",
    tags: ["trip-edit", "add-place", "update-item", "move-item", "remove-item"],
  },
  risk: "high",
  triggerExamples: [
    "把武康大楼加到第二天下午",
    "把第一天的西湖时间改到 10:30",
    "把这家餐厅移动到第三天第一个",
    "删除第二天的咖啡店",
  ],
  run: runItineraryEditSkill,
};

function runItineraryEditSkill(
  rawInput: unknown,
  context: AgentSkillRunContext,
): AgentSkillResult<AgentSkillRunResult> {
  const inputResult = parseItineraryEditSkillInput(rawInput);

  if (!inputResult.ok) {
    return inputResult;
  }

  const input = inputResult.data;

  if (input.action === "add_place_to_day") {
    return runAddPlaceToDay(input, context);
  }

  if (input.action === "update_day_item" || input.action === "move_day_item") {
    return runPatchDayItem(input, context);
  }

  return runRemoveDayItem(input, context);
}

function runAddPlaceToDay(
  input: ItineraryEditAddInput,
  context: AgentSkillRunContext,
): AgentSkillResult<AgentSkillRunResult> {
  const targetDay =
    (input.dayId
      ? context.trip.days.find((day) => day.id === input.dayId)
      : undefined) ??
    (input.dayIndex
      ? context.trip.days.find((day) => day.dayIndex === input.dayIndex)
      : undefined);

  if (
    !targetDay &&
    (!input.autoCreateMissingDays ||
      !input.dayIndex ||
      input.dayIndex <= context.trip.days.length)
  ) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      input.dayIndex
        ? `找不到目标日期：第${input.dayIndex}天`
        : `找不到目标日期：${input.dayId ?? "未指定"}`,
    );
  }

  context.emit?.({
    text: `正在准备把 ${input.place.name} 加入 ${targetDay?.title ?? `第${input.dayIndex}天`}`,
    type: "status",
  });

  if (input.place.provider || input.place.providerPlaceId) {
    context.emit?.({
      sourceCount: 1,
      summary: `已使用 ${input.place.provider ?? "外部来源"} 地点信息：${input.place.name}`,
      toolName: "search_places",
      type: "tool_result_summary",
    });
  }

  context.emit?.({
    argsPreview: {
      action: "add_place_to_day",
      dayId: input.dayId,
      dayIndex: input.dayIndex,
      placeName: input.place.name,
      time: input.time,
    },
    toolName: "propose_trip_patch",
    type: "tool_request",
  });

  const proposal = buildAddPlaceToDayProposal(
    context,
    input,
    targetDay?.title ?? `第${input.dayIndex}天`,
  );

  return {
    ok: true,
    data: {
      events: [],
      kind: "proposal",
      proposal,
    },
  };
}

function runPatchDayItem(
  input: ItineraryEditPatchInput,
  context: AgentSkillRunContext,
): AgentSkillResult<AgentSkillRunResult> {
  const targetResult = isUpdateInput(input)
    ? findUpdateTarget(context.trip, input)
    : findMoveTarget(context.trip, input);

  if (!targetResult.ok) {
    return targetResult;
  }

  context.emit?.({
    text: buildPatchStatusText(input, targetResult.data),
    type: "status",
  });
  context.emit?.({
    argsPreview: buildPatchToolArgsPreview(input),
    toolName: "propose_trip_patch",
    type: "tool_request",
  });

  const proposal = buildPatchDayItemProposal(context, input, targetResult.data);

  return {
    ok: true,
    data: {
      events: [],
      kind: "proposal",
      proposal,
    },
  };
}

function runRemoveDayItem(
  input: ItineraryEditRemoveInput,
  context: AgentSkillRunContext,
): AgentSkillResult<AgentSkillRunResult> {
  const targetResult = findRemoveTarget(context, input);

  if (!targetResult.ok) {
    return targetResult;
  }

  context.emit?.({
    text: `正在准备删除 ${targetResult.data.day.title} 的 ${getItemName(targetResult.data.item)}`,
    type: "status",
  });
  context.emit?.({
    argsPreview: {
      action: "remove_day_item",
      dayId: input.dayId,
      itemId: input.itemId,
    },
    toolName: "propose_trip_patch",
    type: "tool_request",
  });

  const proposal = buildRemoveDayItemProposal(
    context,
    input,
    targetResult.data,
  );

  return {
    ok: true,
    data: {
      events: [],
      kind: "proposal",
      proposal,
    },
  };
}

function buildAddPlaceToDayProposal(
  context: AgentSkillRunContext,
  input: ItineraryEditAddInput,
  dayTitle: string,
): TripEditProposal {
  const placeName = input.place.name.trim();
  const targetDayId =
    input.dayId ??
    context.trip.days.find((day) => day.dayIndex === input.dayIndex)?.id;
  const targetDayIndex =
    input.dayIndex ??
    context.trip.days.find((day) => day.id === targetDayId)?.dayIndex;
  const shouldEnsureDay =
    input.autoCreateMissingDays === true &&
    targetDayIndex !== undefined &&
    targetDayIndex > context.trip.days.length;
  const targetKey =
    targetDayId ?? (targetDayIndex ? `day-${targetDayIndex}` : "unknown-day");
  const operationId = buildSkillIdPart([
    "skill",
    "place-add-op",
    context.trip.id,
    targetKey,
    placeName,
    context.trip.updatedAt,
  ]);
  const proposalId = buildSkillIdPart([
    "skill",
    "place-add-proposal",
    context.trip.id,
    targetKey,
    placeName,
    context.trip.updatedAt,
  ]);
  const ensureOperationId = shouldEnsureDay
    ? buildSkillIdPart([
        "skill",
        "ensure-day-count-op",
        context.trip.id,
        String(targetDayIndex),
        context.trip.updatedAt,
      ])
    : undefined;

  return {
    expectedUpdatedAt: context.trip.updatedAt,
    operations: [
      ...(shouldEnsureDay && ensureOperationId && targetDayIndex
        ? [
            {
              dayCount: targetDayIndex,
              operationId: ensureOperationId,
              reason: `用户要求添加到第${targetDayIndex}天`,
              tripId: context.trip.id,
              type: "ensure_trip_day_count" as const,
            },
          ]
        : []),
      {
        dayId: targetDayId,
        dayIndex: targetDayIndex,
        metadata:
          input.place.provider && input.place.providerPlaceId
            ? {
                placeResolution: {
                  address: input.place.address,
                  confidence: "high" as const,
                  provider: input.place.provider,
                  providerPlaceId: input.place.providerPlaceId,
                  source: input.place.provider,
                },
              }
            : undefined,
        note: input.note,
        operationId,
        place: input.place,
        targetIndex: input.targetIndex,
        time: input.time,
        tripId: context.trip.id,
        type: "add_place_to_day",
      },
    ],
    proposalId,
    summary: `将${placeName}加入${dayTitle}`,
    tripId: context.trip.id,
  };
}

function buildPatchDayItemProposal(
  context: AgentSkillRunContext,
  input: ItineraryEditPatchInput,
  target: { fromDay?: TripDay; item: TripDayItem; targetDay: TripDay },
): TripEditProposal {
  const action = getPatchAction(input);
  const itemName = getItemName(target.item);
  const operationId = buildSkillIdPart([
    "skill",
    "itinerary-edit-op",
    context.trip.id,
    action,
    input.itemId,
    context.trip.updatedAt,
  ]);
  const proposalId = buildSkillIdPart([
    "skill",
    "itinerary-edit-proposal",
    context.trip.id,
    action,
    input.itemId,
    context.trip.updatedAt,
  ]);

  return {
    expectedUpdatedAt: context.trip.updatedAt,
    operations: [
      isUpdateInput(input)
        ? {
            changes: input.changes,
            dayId: input.dayId,
            itemId: input.itemId,
            operationId,
            tripId: context.trip.id,
            type: "update_day_item",
          }
        : {
            fromDayId: input.fromDayId,
            itemId: input.itemId,
            operationId,
            targetIndex: normalizeMoveTargetIndex(
              input,
              target.fromDay,
              target.targetDay,
            ),
            toDayId: input.toDayId,
            tripId: context.trip.id,
            type: "move_day_item",
          },
    ],
    proposalId,
    summary:
      action === "update_day_item"
        ? `更新${target.targetDay.title}的${itemName}`
        : `将${itemName}移动到${target.targetDay.title}`,
    tripId: context.trip.id,
  };
}

function buildRemoveDayItemProposal(
  context: AgentSkillRunContext,
  input: ItineraryEditRemoveInput,
  target: { day: TripDay; item: TripDayItem },
): TripEditProposal {
  const itemName = getItemName(target.item);
  const operationId = buildSkillIdPart([
    "skill",
    "itinerary-edit-remove-op",
    context.trip.id,
    input.dayId,
    input.itemId,
    context.trip.updatedAt,
  ]);
  const proposalId = buildSkillIdPart([
    "skill",
    "itinerary-edit-remove-proposal",
    context.trip.id,
    input.dayId,
    input.itemId,
    context.trip.updatedAt,
  ]);

  return {
    expectedUpdatedAt: context.trip.updatedAt,
    operations: [
      {
        dayId: input.dayId,
        itemId: input.itemId,
        operationId,
        reason: input.reason,
        tripId: context.trip.id,
        type: "remove_day_item",
      },
    ],
    proposalId,
    summary: `从${target.day.title}删除${itemName}`,
    tripId: context.trip.id,
  };
}

function parseItineraryEditSkillInput(
  value: unknown,
): ParseItineraryEditSkillInputResult {
  if (!isRecord(value)) {
    return createAgentSkillError("INVALID_SKILL_INPUT", "Skill 输入必须是对象");
  }

  const action = readAction(value.action) ?? readAction(value.type);

  if (!action) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "itinerary.edit 缺少 action",
    );
  }

  if (action === "add_place_to_day") {
    return parseAddPlaceToDayInput(value);
  }

  if (action === "update_day_item") {
    return parseUpdateInput(value);
  }

  if (action === "move_day_item") {
    return parseMoveInput(value);
  }

  return parseRemoveInput(value);
}

function parseAddPlaceToDayInput(
  value: Record<string, unknown>,
): ParseItineraryEditSkillInputResult {
  const dayId = readRequiredString(value.dayId);
  const dayIndex = parsePositiveInteger(value.dayIndex);
  const placeResult = parseSkillPlace(value.place);

  if (!dayId && dayIndex === undefined) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "add_place_to_day 缺少 dayId 或 dayIndex",
    );
  }

  if (!placeResult.ok) {
    return placeResult;
  }

  const targetIndex = parseTargetIndex(value.targetIndex);

  if (targetIndex === "invalid") {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "targetIndex 必须是非负整数",
    );
  }

  return {
    ok: true,
    data: {
      action: "add_place_to_day",
      dayId,
      dayIndex,
      autoCreateMissingDays: value.autoCreateMissingDays === true,
      note: readOptionalString(value.note),
      place: placeResult.data,
      targetIndex,
      time: readOptionalString(value.time),
    },
  };
}

function parseUpdateInput(
  value: Record<string, unknown>,
): ParseItineraryEditSkillInputResult {
  const dayId = readRequiredString(value.dayId);
  const itemId = readRequiredString(value.itemId);
  const changesResult = parseUpdateChanges(value.changes);

  if (!dayId || !itemId) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "update_day_item 缺少 dayId 或 itemId",
    );
  }

  if (!changesResult.ok) {
    return changesResult;
  }

  return {
    ok: true,
    data: {
      action: "update_day_item",
      changes: changesResult.data,
      dayId,
      itemId,
    },
  };
}

function parseMoveInput(
  value: Record<string, unknown>,
): ParseItineraryEditSkillInputResult {
  const fromDayId = readRequiredString(value.fromDayId);
  const itemId = readRequiredString(value.itemId);
  const targetIndex = parseTargetIndex(value.targetIndex);
  const toDayId = readRequiredString(value.toDayId);

  if (!fromDayId || !itemId || !toDayId) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "move_day_item 缺少 fromDayId、toDayId 或 itemId",
    );
  }

  if (targetIndex === "invalid" || targetIndex === undefined) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "move_day_item.targetIndex 必须是非负整数",
    );
  }

  return {
    ok: true,
    data: {
      action: "move_day_item",
      fromDayId,
      itemId,
      targetIndex,
      toDayId,
    },
  };
}

function parseRemoveInput(
  value: Record<string, unknown>,
): ParseItineraryEditSkillInputResult {
  const dayId = readRequiredString(value.dayId);
  const itemId = readRequiredString(value.itemId);

  if (!dayId || !itemId) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "remove_day_item 缺少 dayId 或 itemId",
    );
  }

  return {
    ok: true,
    data: {
      action: "remove_day_item",
      dayId,
      itemId,
      reason: readOptionalString(value.reason),
    },
  };
}

function parseUpdateChanges(
  value: unknown,
):
  | { ok: true; data: ItineraryEditUpdateInput["changes"] }
  | ReturnType<typeof createAgentSkillError> {
  if (!isRecord(value)) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "update_day_item.changes 必须是对象",
    );
  }

  const changes: ItineraryEditUpdateInput["changes"] = {};
  const note = readOptionalString(value.note);
  const time = readOptionalString(value.time);
  const title = readOptionalString(value.title);

  if (note !== undefined) {
    changes.note = note;
  }

  if (time !== undefined) {
    changes.time = time;
  }

  if (title !== undefined) {
    changes.title = title;
  }

  if (Object.keys(changes).length === 0) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      "update_day_item 至少需要一个有效变更字段",
    );
  }

  return { ok: true, data: changes };
}

function parseSkillPlace(
  value: unknown,
):
  | { ok: true; data: TripSelectedPlaceInput }
  | ReturnType<typeof createAgentSkillError> {
  if (!isRecord(value)) {
    return createAgentSkillError("INVALID_SKILL_INPUT", "地点信息必须是对象");
  }

  const name = readRequiredString(value.name);

  if (!name) {
    return createAgentSkillError("INVALID_SKILL_INPUT", "地点信息缺少 name");
  }

  const provider = readOptionalString(value.provider);
  const providerPlaceId = readOptionalString(value.providerPlaceId);
  const externalRefs = normalizeSkillPlaceExternalRefs({
    externalRefs: parseExternalRefs(value.externalRefs),
    provider,
    providerPlaceId,
  });

  return {
    ok: true,
    data: {
      address: readOptionalString(value.address),
      area: readOptionalString(value.area),
      category: parsePlaceCategory(value.category),
      details: parsePlaceDetails(value.details),
      externalRefs,
      id: readOptionalString(value.id),
      latitude: readOptionalNumber(value.latitude),
      longitude: readOptionalNumber(value.longitude),
      name,
      photos: parsePlacePhotos(value.photos),
      provider,
      providerPlaceId,
    },
  };
}

function normalizeSkillPlaceExternalRefs(input: {
  externalRefs?: TripPlaceExternalRefs;
  provider?: string;
  providerPlaceId?: string;
}): TripPlaceExternalRefs | undefined {
  const shouldUseProviderPlaceIdAsAmapPoiId = canUseProviderPlaceIdAsAmapPoiId(
    input.provider,
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

function parseExternalRefs(value: unknown): TripPlaceExternalRefs | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const externalRefs: TripPlaceExternalRefs = {
    amapAdcode: readOptionalString(value.amapAdcode),
    amapCitycode: readOptionalString(value.amapCitycode),
    amapCityName: readOptionalString(value.amapCityName),
    amapPoiId: readOptionalString(value.amapPoiId),
    mapUrl: readOptionalString(value.mapUrl),
    sourceUrl: readOptionalString(value.sourceUrl),
    wikidataId: readOptionalString(value.wikidataId),
  };
  const hasValue = Object.values(externalRefs).some(
    (entry) => entry !== undefined,
  );

  return hasValue ? externalRefs : undefined;
}

function parsePlaceDetails(value: unknown): TripSelectedPlaceInput["details"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const rating = readOptionalNumber(value.rating);
  return {
    openingHours: readOptionalString(value.openingHours),
    phone: readOptionalString(value.phone),
    priceLevel: readOptionalString(value.priceLevel),
    rating: rating !== undefined && rating >= 0 ? rating : undefined,
    ratingSource: readOptionalString(value.ratingSource),
  };
}

function parsePlacePhotos(value: unknown): TripPlacePhoto[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const photos = value
    .filter((photo): photo is Record<string, unknown> => isRecord(photo))
    .map((photo, index) => {
      const url = readOptionalString(photo.url);

      if (!url) {
        return undefined;
      }

      const normalizedPhoto: TripPlacePhoto = {
        id: readOptionalString(photo.id) ?? `agent-photo-${index + 1}`,
        url,
      };

      const credit = readOptionalString(photo.credit);
      const sourceLabel = readOptionalString(photo.sourceLabel);
      const sourceUrl = readOptionalString(photo.sourceUrl);

      if (credit !== undefined) {
        normalizedPhoto.credit = credit;
      }

      if (sourceLabel !== undefined) {
        normalizedPhoto.sourceLabel = sourceLabel;
      }

      if (sourceUrl !== undefined) {
        normalizedPhoto.sourceUrl = sourceUrl;
      }

      normalizedPhoto.isCover =
        typeof photo.isCover === "boolean" ? photo.isCover : index === 0;

      return normalizedPhoto;
    })
    .filter((photo): photo is TripPlacePhoto => Boolean(photo));

  return photos.length > 0 ? photos : undefined;
}

function parsePlaceCategory(value: unknown): TripPlaceCategory | undefined {
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
    : undefined;
}

function findUpdateTarget(
  trip: Trip,
  input: ItineraryEditUpdateInput,
):
  | { ok: true; data: { item: TripDayItem; targetDay: TripDay } }
  | ReturnType<typeof createAgentSkillError> {
  const targetDay = trip.days.find((day) => day.id === input.dayId);
  const item = targetDay?.items.find(
    (candidate) => candidate.id === input.itemId,
  );

  if (!targetDay) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到目标日期：${input.dayId}`,
    );
  }

  if (!item) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到目标行程点：${input.itemId}`,
    );
  }

  return { ok: true, data: { item, targetDay } };
}

function findMoveTarget(
  trip: Trip,
  input: ItineraryEditMoveInput,
):
  | {
      ok: true;
      data: { fromDay: TripDay; item: TripDayItem; targetDay: TripDay };
    }
  | ReturnType<typeof createAgentSkillError> {
  const fromDay = trip.days.find((day) => day.id === input.fromDayId);
  const targetDay = trip.days.find((day) => day.id === input.toDayId);
  const item = fromDay?.items.find(
    (candidate) => candidate.id === input.itemId,
  );

  if (!fromDay) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到来源日期：${input.fromDayId}`,
    );
  }

  if (!targetDay) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到目标日期：${input.toDayId}`,
    );
  }

  if (!item) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到目标行程点：${input.itemId}`,
    );
  }

  const maxTargetIndex = getMoveTargetMaxIndex(input, fromDay, targetDay);

  if (input.targetIndex > maxTargetIndex + 1) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `目标位置超出范围：${input.targetIndex}`,
    );
  }

  return { ok: true, data: { fromDay, item, targetDay } };
}

function findRemoveTarget(
  context: AgentSkillRunContext,
  input: ItineraryEditRemoveInput,
):
  | { ok: true; data: { day: TripDay; item: TripDayItem } }
  | ReturnType<typeof createAgentSkillError> {
  const day = context.trip.days.find(
    (candidate) => candidate.id === input.dayId,
  );
  const item = day?.items.find((candidate) => candidate.id === input.itemId);

  if (!day) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到目标日期：${input.dayId}`,
    );
  }

  if (!item) {
    return createAgentSkillError(
      "INVALID_SKILL_INPUT",
      `找不到目标行程点：${input.itemId}`,
    );
  }

  return { ok: true, data: { day, item } };
}

function normalizeMoveTargetIndex(
  input: ItineraryEditMoveInput,
  fromDay: TripDay | undefined,
  targetDay: TripDay,
): number {
  const maxTargetIndex = getMoveTargetMaxIndex(input, fromDay, targetDay);

  return Math.min(input.targetIndex, maxTargetIndex);
}

function getMoveTargetMaxIndex(
  input: ItineraryEditMoveInput,
  fromDay: TripDay | undefined,
  targetDay: TripDay,
): number {
  return input.fromDayId === input.toDayId
    ? Math.max(0, (fromDay?.items.length ?? 0) - 1)
    : targetDay.items.length;
}

function buildPatchStatusText(
  input: ItineraryEditPatchInput,
  target: { fromDay?: TripDay; item: TripDayItem; targetDay: TripDay },
): string {
  const itemName = getItemName(target.item);

  return getPatchAction(input) === "update_day_item"
    ? `正在准备更新 ${target.targetDay.title} 的 ${itemName}`
    : `正在准备把 ${itemName} 移动到 ${target.targetDay.title}`;
}

function buildPatchToolArgsPreview(
  input: ItineraryEditPatchInput,
): Record<string, unknown> {
  return isUpdateInput(input)
    ? {
        action: "update_day_item",
        changes: input.changes,
        dayId: input.dayId,
        itemId: input.itemId,
      }
    : {
        action: "move_day_item",
        fromDayId: input.fromDayId,
        itemId: input.itemId,
        targetIndex: input.targetIndex,
        toDayId: input.toDayId,
      };
}

function isUpdateInput(
  input: ItineraryEditPatchInput,
): input is ItineraryEditUpdateInput {
  return input.action === "update_day_item";
}

function getPatchAction(
  input: ItineraryEditPatchInput,
): "move_day_item" | "update_day_item" {
  return isUpdateInput(input) ? "update_day_item" : "move_day_item";
}

function readAction(value: unknown): ItineraryEditAction | undefined {
  return value === "add_place_to_day" ||
    value === "move_day_item" ||
    value === "remove_day_item" ||
    value === "update_day_item"
    ? value
    : undefined;
}

function getItemName(item: TripDayItem): string {
  return item.placeName ?? item.title;
}

function parseTargetIndex(value: unknown): number | "invalid" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return "invalid";
  }

  return value;
}

function parsePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function buildSkillIdPart(parts: string[]): string {
  return parts
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48),
    )
    .filter(Boolean)
    .join("-");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return readRequiredString(value);
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
