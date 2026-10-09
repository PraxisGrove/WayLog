import {
  addPlaceToDay,
  moveDayItem,
  removeDayItem,
  resizeTripDays,
  type TripCommandDeps,
  type TripCommandError,
  updateDayItem,
  updateTripDayTitle,
} from "../trips/commands";
import type { Trip, TripDay } from "../trips/types";
import { parseTripEditProposal } from "./contracts/trip-edit-proposal-contract";
import type {
  TripEditAddPlaceToDayOperation,
  TripEditEnsureTripDayCountOperation,
  TripEditMoveDayItemOperation,
  TripEditOperation,
  TripEditProposal,
  TripEditRemoveDayItemOperation,
  TripEditUpdateDayItemOperation,
  TripEditUpdateTripDayTitleOperation,
} from "./contracts/trip-edit-proposal-contract";
import { createTripEditOperationFacts } from "./flows/trip-edit/trip-edit-risk";
import type {
  AgentProposalPreviewFieldChange,
  AgentProposalPreviewItem,
  TripEditProposalError,
  TripEditProposalResult,
} from "./types";

export type ApplyTripEditProposalCommandsInput = {
  appliedOperationIds?: ReadonlySet<string>;
  proposal: TripEditProposal;
  trip: Trip;
};

export type ApplyTripEditProposalCommandsData = {
  appliedOperationIds: string[];
  preview: AgentProposalPreviewItem[];
  trip: Trip;
};

export type TripEditProposalEvaluation = {
  appliedOperationIds: string[];
  trip: Trip;
};

export type ValidateTripEditProposalPreviewInput = {
  proposal: unknown;
  trip: Trip;
};

export type ValidateTripEditProposalPreviewData = {
  preview: AgentProposalPreviewItem[];
  proposal: TripEditProposal;
};

export function validateTripEditProposalPreview(
  input: ValidateTripEditProposalPreviewInput,
): TripEditProposalResult<ValidateTripEditProposalPreviewData> {
  const proposalResult = parseTripEditProposal(input.proposal);

  if (!proposalResult.ok) {
    return createTripEditProposalError(
      proposalResult.error.code === "DUPLICATE_OPERATION"
        ? "DUPLICATE_OPERATION"
        : "INVALID_PROPOSAL",
      proposalResult.error.message,
    );
  }

  const proposal = proposalResult.data;
  const contextResult = validateProposalAgainstTrip(input.trip, proposal);

  if (!contextResult.ok) {
    return contextResult;
  }

  return {
    ok: true,
    data: {
      preview: createAgentProposalPreview(input.trip, proposal),
      proposal,
    },
  };
}

export function createAgentProposalPreview(
  trip: Trip,
  proposal: TripEditProposal,
): AgentProposalPreviewItem[] {
  let previewTrip = trip;
  const operationFacts = createTripEditOperationFacts(
    proposal.operations,
    trip,
  );

  const preview = proposal.operations.map((operation, index) => {
    const operationFact = operationFacts[index];
    const item = (() => {
      switch (operation.type) {
        case "add_place_to_day":
          return describeAddPlaceToDayOperation(previewTrip, operation);
        case "ensure_trip_day_count":
          return describeEnsureTripDayCountOperation(previewTrip, operation);
        case "update_day_item":
          return describeUpdateDayItemOperation(previewTrip, operation);
        case "update_trip_day_title":
          return describeUpdateTripDayTitleOperation(previewTrip, operation);
        case "move_day_item":
          return describeMoveDayItemOperation(previewTrip, operation);
        case "remove_day_item":
          return describeRemoveDayItemOperation(previewTrip, operation);
      }
    })();

    if (operation.type === "ensure_trip_day_count") {
      previewTrip = {
        ...previewTrip,
        days: createSimulatedDays(previewTrip.days, operation.dayCount),
      };
    }

    return {
      ...item,
      risk: operationFact?.risk ?? "high",
    };
  });

  return preview;
}

export function applyTripEditProposalCommands(
  input: ApplyTripEditProposalCommandsInput,
  deps?: TripCommandDeps,
): TripEditProposalResult<ApplyTripEditProposalCommandsData> {
  const validationResult = validateTripEditProposalPreview({
    proposal: input.proposal,
    trip: input.trip,
  });

  if (!validationResult.ok) {
    return validationResult;
  }

  const evaluation = applyValidatedTripOperations(
    input.trip,
    validationResult.data.proposal.operations,
    input.appliedOperationIds,
    deps,
  );

  if (!evaluation.ok) return evaluation;

  return {
    ok: true,
    data: {
      appliedOperationIds: evaluation.data.appliedOperationIds,
      preview: validationResult.data.preview,
      trip: evaluation.data.trip,
    },
  };
}

/** TripEditProposal 的纯计算 seam；不读取存储，也不执行任何写入。 */
export function evaluateTripEditProposal(
  input: { proposal: TripEditProposal; trip: Trip },
  deps?: TripCommandDeps,
): TripEditProposalResult<TripEditProposalEvaluation> {
  const contextResult = validateProposalAgainstTrip(input.trip, input.proposal);

  if (!contextResult.ok) return contextResult;

  return applyValidatedTripOperations(
    input.trip,
    input.proposal.operations,
    undefined,
    deps,
  );
}

function applyValidatedTripOperations(
  trip: Trip,
  operations: readonly TripEditOperation[],
  appliedOperationIds: ReadonlySet<string> | undefined,
  deps: TripCommandDeps | undefined,
): TripEditProposalResult<TripEditProposalEvaluation> {
  const alreadyApplied = appliedOperationIds ?? new Set<string>();
  const repeatedOperation = operations.find((operation) =>
    alreadyApplied.has(operation.operationId),
  );

  if (repeatedOperation) {
    return createTripEditProposalError(
      "DUPLICATE_OPERATION",
      `操作 ${repeatedOperation.operationId} 已经应用过，请重新生成提案`,
    );
  }

  let nextTrip = trip;
  const nextAppliedOperationIds: string[] = [];

  for (const operation of operations) {
    const operationResult = applyTripOperation(nextTrip, operation, deps);

    if (!operationResult.ok) return operationResult;

    nextTrip = operationResult.data.trip;
    nextAppliedOperationIds.push(operation.operationId);
  }

  return {
    data: { appliedOperationIds: nextAppliedOperationIds, trip: nextTrip },
    ok: true,
  };
}

function applyTripOperation(
  trip: Trip,
  operation: TripEditOperation,
  deps?: TripCommandDeps,
): TripEditProposalResult<{ trip: Trip }> {
  switch (operation.type) {
    case "ensure_trip_day_count": {
      if (trip.days.length >= operation.dayCount) {
        return { ok: true, data: { trip } };
      }

      const result = resizeTripDays(
        trip,
        {
          dayCount: operation.dayCount,
        },
        deps,
      );

      if (!result.ok) {
        return createCommandFailedError(result.error);
      }

      return { ok: true, data: { trip: result.data.trip } };
    }
    case "add_place_to_day": {
      const targetDayId = resolveAddPlaceTargetDayId(trip, operation);

      if (!targetDayId) {
        return createTripEditProposalError(
          "TARGET_NOT_FOUND",
          operation.dayIndex
            ? `找不到目标日期：第${operation.dayIndex}天`
            : "找不到目标日期",
        );
      }

      const result = addPlaceToDay(
        trip,
        {
          dayId: targetDayId,
          note: operation.note,
          place: operation.place,
          recommendationReason: operation.recommendationReason,
          targetIndex: operation.targetIndex,
          time: operation.time,
        },
        deps,
      );

      if (!result.ok) {
        return createCommandFailedError(result.error);
      }

      return { ok: true, data: { trip: result.data.trip } };
    }
    case "remove_day_item": {
      const result = removeDayItem(
        trip,
        {
          dayId: operation.dayId,
          itemId: operation.itemId,
        },
        deps,
      );

      if (!result.ok) {
        return createCommandFailedError(result.error);
      }

      return { ok: true, data: { trip: result.data.trip } };
    }
    case "update_day_item": {
      const result = updateDayItem(
        trip,
        {
          changes: operation.changes,
          dayId: operation.dayId,
          itemId: operation.itemId,
        },
        deps,
      );

      if (!result.ok) {
        return createCommandFailedError(result.error);
      }

      return { ok: true, data: { trip: result.data.trip } };
    }
    case "update_trip_day_title": {
      const result = updateTripDayTitle(
        trip,
        {
          dayId: operation.dayId,
          title: operation.title,
        },
        deps,
      );

      if (!result.ok) {
        return createCommandFailedError(result.error);
      }

      return { ok: true, data: { trip: result.data.trip } };
    }
    case "move_day_item": {
      const result = moveDayItem(
        trip,
        {
          fromDayId: operation.fromDayId,
          itemId: operation.itemId,
          targetIndex: operation.targetIndex,
          toDayId: operation.toDayId,
        },
        deps,
      );

      if (!result.ok) {
        return createCommandFailedError(result.error);
      }

      return { ok: true, data: { trip: result.data.trip } };
    }
  }
}

function validateProposalAgainstTrip(
  trip: Trip,
  proposal: TripEditProposal,
): TripEditProposalResult<void> {
  if (proposal.tripId !== trip.id) {
    return createTripEditProposalError(
      "TRIP_MISMATCH",
      "Agent 提案指向的行程不是当前行程",
    );
  }

  if (proposal.expectedUpdatedAt !== trip.updatedAt) {
    return createTripEditProposalError(
      "VERSION_CONFLICT",
      "行程已被修改，请重新生成 Agent 提案",
    );
  }

  let simulatedDays = trip.days;

  for (const operation of proposal.operations) {
    if (operation.tripId !== trip.id) {
      return createTripEditProposalError(
        "TRIP_MISMATCH",
        `操作 ${operation.operationId} 指向的行程不是当前行程`,
      );
    }

    switch (operation.type) {
      case "ensure_trip_day_count":
        if (operation.dayCount < simulatedDays.length) {
          return createInvalidProposalError(
            `ensure_trip_day_count.dayCount 不能小于当前天数：${operation.dayCount}`,
          );
        }
        simulatedDays = createSimulatedDays(simulatedDays, operation.dayCount);
        break;
      case "add_place_to_day":
        if (
          !resolveAddPlaceTargetDayId(
            { ...trip, days: simulatedDays },
            operation,
          )
        ) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            operation.dayIndex
              ? `找不到目标日期：第${operation.dayIndex}天`
              : `找不到目标日期 ${operation.dayId}`,
          );
        }
        break;
      case "update_day_item": {
        const day = simulatedDays.find(
          (candidate) => candidate.id === operation.dayId,
        );

        if (!day) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标日期 ${operation.dayId}`,
          );
        }

        if (!day.items.some((item) => item.id === operation.itemId)) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标行程点 ${operation.itemId}`,
          );
        }

        break;
      }
      case "update_trip_day_title": {
        const day = simulatedDays.find(
          (candidate) => candidate.id === operation.dayId,
        );

        if (!day) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标日期 ${operation.dayId}`,
          );
        }

        break;
      }
      case "move_day_item": {
        const fromDay = simulatedDays.find(
          (candidate) => candidate.id === operation.fromDayId,
        );
        const toDay = simulatedDays.find(
          (candidate) => candidate.id === operation.toDayId,
        );

        if (!fromDay) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到来源日期 ${operation.fromDayId}`,
          );
        }

        if (!toDay) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标日期 ${operation.toDayId}`,
          );
        }

        if (!fromDay.items.some((item) => item.id === operation.itemId)) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标行程点 ${operation.itemId}`,
          );
        }

        const maxTargetIndex =
          operation.fromDayId === operation.toDayId
            ? Math.max(0, fromDay.items.length - 1)
            : toDay.items.length;

        if (operation.targetIndex > maxTargetIndex) {
          return createInvalidProposalError(
            `move_day_item.targetIndex 超出目标范围：${operation.targetIndex}`,
          );
        }

        break;
      }
      case "remove_day_item": {
        const day = simulatedDays.find(
          (candidate) => candidate.id === operation.dayId,
        );

        if (!day) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标日期 ${operation.dayId}`,
          );
        }

        if (!day.items.some((item) => item.id === operation.itemId)) {
          return createTripEditProposalError(
            "TARGET_NOT_FOUND",
            `找不到目标行程点 ${operation.itemId}`,
          );
        }

        break;
      }
    }
  }

  return { ok: true, data: undefined };
}

type AgentProposalPreviewItemWithoutRisk = Omit<
  AgentProposalPreviewItem,
  "risk"
>;

function describeAddPlaceToDayOperation(
  trip: Trip,
  operation: TripEditAddPlaceToDayOperation,
): AgentProposalPreviewItemWithoutRisk {
  const targetDayId = resolveAddPlaceTargetDayId(trip, operation);
  const day = targetDayId
    ? trip.days.find((candidate) => candidate.id === targetDayId)
    : undefined;
  const dayLabel =
    day?.title ??
    (operation.dayIndex
      ? `第${operation.dayIndex}天`
      : (operation.dayId ?? "目标日期"));
  const timeLabel = operation.time ? ` ${operation.time}` : "";
  const placeResolutionImpact = describePlaceResolutionImpact(operation);
  const sourceDetails = placeResolutionImpact.filter(
    (line) => !line.startsWith("地点地址："),
  );
  const address =
    operation.metadata?.placeResolution?.address ?? operation.place.address;

  return {
    action: operation.type,
    dayId: targetDayId ?? operation.dayId,
    description: `在${dayLabel}${timeLabel}添加地点：${operation.place.name}`,
    display: {
      ...(address ? { address } : {}),
      dayLabel,
      kind: operation.type,
      placeName: operation.place.name,
      ...(sourceDetails.length > 0 ? { sourceDetails } : {}),
      ...(operation.targetIndex === undefined
        ? {}
        : { targetPosition: operation.targetIndex + 1 }),
      ...(operation.time ? { time: operation.time } : {}),
    },
    impact: [
      `新增地点：${operation.place.name}`,
      `目标日期：${dayLabel}`,
      ...placeResolutionImpact,
    ],
    operationId: operation.operationId,
    targetName: operation.place.name,
  };
}

function describeEnsureTripDayCountOperation(
  trip: Trip,
  operation: TripEditEnsureTripDayCountOperation,
): AgentProposalPreviewItemWithoutRisk {
  const currentCount = trip.days.length;
  const addedLabels: string[] = [];

  for (let index = currentCount + 1; index <= operation.dayCount; index += 1) {
    addedLabels.push(`第${index}天`);
  }

  return {
    action: operation.type,
    description:
      addedLabels.length > 0
        ? `补齐行程天数到第${operation.dayCount}天`
        : `行程已包含第${operation.dayCount}天`,
    display: {
      addedDayLabels: addedLabels,
      currentDayCount: currentCount,
      kind: operation.type,
      targetDayCount: operation.dayCount,
    },
    impact:
      addedLabels.length > 0
        ? [`新增日期：${addedLabels.join("、")}`]
        : [`当前已有 ${currentCount} 天，无需新增日期`],
    operationId: operation.operationId,
    targetName: `第${operation.dayCount}天`,
  };
}

function describePlaceResolutionImpact(
  operation: TripEditAddPlaceToDayOperation,
): string[] {
  const resolution = operation.metadata?.placeResolution;

  if (!resolution) {
    return [];
  }

  const sourceLabel = getPlaceResolutionSourceLabel(
    resolution.source ?? resolution.provider,
  );
  const lines = [`已匹配真实地点：${sourceLabel}`];

  if (resolution.address) {
    lines.push(`地点地址：${resolution.address}`);
  }

  if (resolution.providerPlaceId) {
    lines.push(`地点来源 ID：${resolution.providerPlaceId}`);
  }

  return lines;
}

function getPlaceResolutionSourceLabel(source: string | undefined): string {
  if (source === "poi_cache") {
    return "缓存 / 高德";
  }

  if (source === "amap") {
    return "高德";
  }

  return source ?? "已验证来源";
}

function describeUpdateDayItemOperation(
  trip: Trip,
  operation: TripEditUpdateDayItemOperation,
): AgentProposalPreviewItemWithoutRisk {
  const day = trip.days.find((candidate) => candidate.id === operation.dayId);
  const item = day?.items.find(
    (candidate) => candidate.id === operation.itemId,
  );
  const dayLabel = day?.title ?? operation.dayId;
  const targetName = item?.placeName ?? item?.title ?? operation.itemId;

  return {
    action: operation.type,
    dayId: operation.dayId,
    description: `更新${dayLabel}的行程点：${targetName}`,
    display: {
      changes: createUpdateDayItemDisplayChanges(item, operation),
      kind: operation.type,
      targetName,
    },
    impact: describeUpdateDayItemImpact(item, operation),
    itemId: operation.itemId,
    operationId: operation.operationId,
    targetName,
  };
}

function createUpdateDayItemDisplayChanges(
  item: Trip["days"][number]["items"][number] | undefined,
  operation: TripEditUpdateDayItemOperation,
) {
  const changes: AgentProposalPreviewFieldChange[] = [];

  if (operation.changes.title !== undefined) {
    changes.push({
      afterValue: operation.changes.title,
      beforeValue: item?.title ?? "未命名",
      field: "title",
      label: "标题",
    });
  }

  if (operation.changes.time !== undefined) {
    changes.push({
      afterValue: operation.changes.time,
      beforeValue: item?.time ?? "未设置",
      field: "time",
      label: "时间",
    });
  }

  if (operation.changes.note !== undefined) {
    changes.push({
      afterValue: operation.changes.note,
      beforeValue: item?.note ?? "未设置",
      field: "note",
      label: "备注",
    });
  }

  if (operation.changes.recommendationReason !== undefined) {
    changes.push({
      afterValue: operation.changes.recommendationReason,
      beforeValue: item?.recommendationReason ?? "未设置",
      field: "recommendationReason",
      label: "推荐理由",
    });
  }

  return changes;
}

function describeUpdateDayItemImpact(
  item: Trip["days"][number]["items"][number] | undefined,
  operation: TripEditUpdateDayItemOperation,
): string[] {
  const changes = operation.changes;
  const impact: string[] = [];

  if (changes.title !== undefined) {
    impact.push(`标题：${item?.title ?? "未命名"} -> ${changes.title}`);
  }

  if (changes.time !== undefined) {
    impact.push(`时间：${item?.time ?? "未设置"} -> ${changes.time}`);
  }

  if (changes.note !== undefined) {
    impact.push(`备注：${changes.note}`);
  }

  if (changes.recommendationReason !== undefined) {
    impact.push(`推荐理由：${changes.recommendationReason}`);
  }

  return impact.length > 0 ? impact : ["更新行程点信息"];
}

function describeUpdateTripDayTitleOperation(
  trip: Trip,
  operation: TripEditUpdateTripDayTitleOperation,
): AgentProposalPreviewItemWithoutRisk {
  const day = trip.days.find((candidate) => candidate.id === operation.dayId);
  const dayLabel = day?.title ?? operation.dayId;

  return {
    action: operation.type,
    dayId: operation.dayId,
    description: `更新日期标题：${dayLabel}`,
    display: {
      afterValue: operation.title,
      beforeValue: dayLabel,
      dayLabel,
      kind: operation.type,
    },
    impact: [`标题：${dayLabel} -> ${operation.title}`],
    operationId: operation.operationId,
    targetName: operation.title,
  };
}

function describeMoveDayItemOperation(
  trip: Trip,
  operation: TripEditMoveDayItemOperation,
): AgentProposalPreviewItemWithoutRisk {
  const fromDay = trip.days.find(
    (candidate) => candidate.id === operation.fromDayId,
  );
  const toDay = trip.days.find(
    (candidate) => candidate.id === operation.toDayId,
  );
  const item = fromDay?.items.find(
    (candidate) => candidate.id === operation.itemId,
  );
  const fromDayLabel = fromDay?.title ?? operation.fromDayId;
  const toDayLabel = toDay?.title ?? operation.toDayId;
  const targetName = item?.placeName ?? item?.title ?? operation.itemId;
  const sourceIndex =
    fromDay?.items.findIndex(
      (candidate) => candidate.id === operation.itemId,
    ) ?? -1;

  return {
    action: operation.type,
    dayId: operation.toDayId,
    description: `移动行程点：${targetName}`,
    display: {
      from: {
        dayId: operation.fromDayId,
        dayLabel: fromDayLabel,
        position: sourceIndex >= 0 ? sourceIndex + 1 : 1,
      },
      kind: operation.type,
      targetName,
      to: {
        dayId: operation.toDayId,
        dayLabel: toDayLabel,
        position: operation.targetIndex + 1,
      },
    },
    impact: [
      `从${fromDayLabel}移动到${toDayLabel}`,
      `目标位置：第 ${operation.targetIndex + 1} 位`,
    ],
    itemId: operation.itemId,
    operationId: operation.operationId,
    targetName,
  };
}

function describeRemoveDayItemOperation(
  trip: Trip,
  operation: TripEditRemoveDayItemOperation,
): AgentProposalPreviewItemWithoutRisk {
  const day = trip.days.find((candidate) => candidate.id === operation.dayId);
  const item = day?.items.find(
    (candidate) => candidate.id === operation.itemId,
  );
  const dayLabel = day?.title ?? operation.dayId;
  const targetName = item?.placeName ?? item?.title ?? operation.itemId;
  const placeImpact = describeRemovedItemPlaceImpact(trip, operation, item);

  return {
    action: operation.type,
    dayId: operation.dayId,
    description: `从${dayLabel}删除行程点：${targetName}`,
    display: {
      dayLabel,
      kind: operation.type,
      placeImpact,
      targetName,
    },
    impact: [`删除行程点：${targetName}`, placeImpact],
    itemId: operation.itemId,
    operationId: operation.operationId,
    targetName,
  };
}

function describeRemovedItemPlaceImpact(
  trip: Trip,
  operation: TripEditRemoveDayItemOperation,
  item: Trip["days"][number]["items"][number] | undefined,
): string {
  if (!item) {
    return "不涉及地点库清理";
  }

  const place = findPlaceLinkedToRemovedItem(trip, item);

  if (!place) {
    return "不涉及地点库清理";
  }

  const isReferencedElsewhere = trip.days.some((day) =>
    day.items.some(
      (candidate) =>
        !(day.id === operation.dayId && candidate.id === operation.itemId) &&
        isDayItemLinkedToRemovedPlace(candidate, item, place),
    ),
  );

  if (isReferencedElsewhere) {
    return `保留地点库：${place.name}`;
  }

  return `可能清理地点库：${place.name}`;
}

function findPlaceLinkedToRemovedItem(
  trip: Trip,
  removedItem: Trip["days"][number]["items"][number],
): Trip["places"][number] | undefined {
  if (removedItem.placeId) {
    return trip.places.find(
      (candidate) => candidate.id === removedItem.placeId,
    );
  }

  return trip.places.find(
    (candidate) =>
      removedItem.placeName === candidate.name ||
      removedItem.title === candidate.name,
  );
}

function isDayItemLinkedToRemovedPlace(
  candidate: Trip["days"][number]["items"][number],
  removedItem: Trip["days"][number]["items"][number],
  removedPlace: Trip["places"][number],
): boolean {
  if (removedItem.placeId) {
    return candidate.placeId === removedItem.placeId;
  }

  return (
    candidate.placeId === removedPlace.id ||
    candidate.placeName === removedPlace.name ||
    candidate.title === removedPlace.name
  );
}

function createCommandFailedError(
  error: TripCommandError,
): TripEditProposalResult<never> {
  return createTripEditProposalError(
    "COMMAND_FAILED",
    `领域命令执行失败：${error.message}`,
  );
}

function createInvalidProposalError(
  message: string,
): TripEditProposalResult<never> {
  return createTripEditProposalError("INVALID_PROPOSAL", message);
}

function createTripEditProposalError(
  code: TripEditProposalError["code"],
  message: string,
): TripEditProposalResult<never> {
  return { ok: false, error: { code, message } };
}

function resolveAddPlaceTargetDayId(
  trip: Trip,
  operation: TripEditAddPlaceToDayOperation,
): string | undefined {
  if (operation.dayId && trip.days.some((day) => day.id === operation.dayId)) {
    return operation.dayId;
  }

  if (operation.dayIndex !== undefined) {
    return trip.days.find((day) => day.dayIndex === operation.dayIndex)?.id;
  }

  return undefined;
}

function createSimulatedDays(days: TripDay[], dayCount: number): TripDay[] {
  if (days.length >= dayCount) {
    return days;
  }

  const nextDays = [...days];

  for (let dayIndex = days.length + 1; dayIndex <= dayCount; dayIndex += 1) {
    nextDays.push({
      dayIndex,
      id: `__agent_pending_day_${dayIndex}`,
      items: [],
      title: `第${dayIndex}天`,
    });
  }

  return nextDays;
}
