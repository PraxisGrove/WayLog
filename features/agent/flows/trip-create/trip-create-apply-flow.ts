import type { CreateTripInput, Trip } from "../../../trips";
import {
  createTripLocally,
  getTripById,
  markTripDirtyWithoutScheduling,
  rollbackLocallyCreatedTrip,
  scheduleTripsCloudSync,
} from "../../../trips";
import { getAppliedAgentProposalRecords } from "../../applied-proposals";
import { getAgentLocalStorage } from "../../agent-local-storage";
import {
  type AgentTripDraft,
  getAgentTripDraft,
  tripDraftToCreateTripInput,
} from "../../trip-draft";
import {
  getTripCreateOperationId,
  getTripDraftRevision,
  isStableTripDraftId,
  parseConfirmedTripDraftSnapshot,
  type TripCreateRequest,
} from "./trip-create-contract";
import {
  TRIP_CREATE_PENDING_STORAGE_KEY_PREFIX,
  TRIP_CREATE_RECEIPT_STORAGE_KEY_PREFIX,
} from "./trip-create-local-state";

export type TripCreateApplyReceipt = {
  appliedAt: string;
  conversationId: string;
  createOperationId: string;
  draftId: string;
  draftRevision: string;
  tripId: string;
  turnId: string;
};

export type TripCreateApplyResult =
  | {
      receipt: TripCreateApplyReceipt;
      status: "applied" | "duplicate";
      trip: Trip;
    }
  | {
      error: { code: TripCreateApplyErrorCode; message: string };
      status: "failed" | "rejected";
    };

export type TripCreateApplyErrorCode =
  | "CONFIRMATION_REQUIRED"
  | "DRAFT_CHANGED"
  | "DRAFT_NOT_FOUND"
  | "DUPLICATE_RECEIPT_MISSING_TRIP"
  | "INVALID_DRAFT"
  | "ROLLBACK_FAILED"
  | "TRIP_ID_CONFLICT"
  | "UNVERIFIED_POI"
  | "WRITE_FAILED";

export type TripCreateApplyDeps = {
  clock?: () => string;
  findReceipt: (
    createOperationId: string,
  ) => Promise<TripCreateApplyReceipt | undefined>;
  findTripById: (tripId: string) => Promise<Trip | null>;
  loadDraft: (draftId: string) => Promise<AgentTripDraft | undefined>;
  markTripDirty: (trip: Trip) => Promise<void>;
  persistTripLocally: (input: CreateTripInput, tripId: string) => Promise<Trip>;
  recordReceipt: (
    receipt: TripCreateApplyReceipt,
    trip: Trip,
  ) => Promise<TripCreateApplyReceipt>;
  rollbackLocalTrip: (tripId: string) => Promise<void>;
  scheduleCloudSync: () => void;
};

type TripCreateValidationResult =
  | { draft: AgentTripDraft; ok: true }
  | {
      error: { code: TripCreateApplyErrorCode; message: string };
      ok: false;
    };

const activeTripCreateApplies = new Map<string, Promise<void>>();

type TripCreatePendingRecord = {
  createOperationId: string;
  startedAt: string;
  tripId: string;
};

export async function applyConfirmedTripCreate(
  request: TripCreateRequest,
  overrides: Partial<TripCreateApplyDeps> = {},
): Promise<TripCreateApplyResult> {
  const operationId = request?.createOperationId;
  if (!operationId?.trim()) {
    return applyConfirmedTripCreateOnce(request, overrides);
  }

  const activeApply = activeTripCreateApplies.get(operationId);
  if (activeApply) {
    await activeApply;
    return applyConfirmedTripCreate(request, overrides);
  }

  let releaseApply: (() => void) | undefined;
  const applyCompleted = new Promise<void>((resolve) => {
    releaseApply = resolve;
  });
  activeTripCreateApplies.set(operationId, applyCompleted);

  try {
    return await applyConfirmedTripCreateOnce(request, overrides);
  } finally {
    activeTripCreateApplies.delete(operationId);
    releaseApply?.();
  }
}

async function applyConfirmedTripCreateOnce(
  request: TripCreateRequest,
  overrides: Partial<TripCreateApplyDeps>,
): Promise<TripCreateApplyResult> {
  const deps = createDefaultDeps(overrides);
  const usesDefaultApplyStore =
    overrides.findReceipt === undefined &&
    overrides.recordReceipt === undefined;
  if (
    request.kind !== "trip_create_request" ||
    request.confirmation?.kind !== "explicit_create"
  ) {
    return {
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "创建新行程必须明确确认。",
      },
      status: "rejected",
    };
  }
  if (
    !isStableTripDraftId(request.draftId) ||
    !request.draftRevision?.trim() ||
    !request.conversationId?.trim() ||
    !request.turnId?.trim() ||
    request.createOperationId !==
      getTripCreateOperationId(request.draftId, request.draftRevision)
  ) {
    return {
      error: {
        code: "DRAFT_CHANGED",
        message: "TripCreateRequest 的稳定身份无效。",
      },
      status: "rejected",
    };
  }

  const existingReceipt = await deps.findReceipt(request.createOperationId);
  if (existingReceipt) {
    const trip = await deps.findTripById(existingReceipt.tripId);
    if (trip && usesDefaultApplyStore) {
      try {
        await clearDefaultPendingRecord(request.createOperationId);
      } catch {
        // receipt 已经是幂等事实；残留 pending 记录清理失败不影响重复确认结果。
      }
    }
    return trip
      ? { receipt: existingReceipt, status: "duplicate", trip }
      : {
          error: {
            code: "DUPLICATE_RECEIPT_MISSING_TRIP",
            message: "已存在创建收据，但对应行程不存在。",
          },
          status: "failed",
        };
  }

  const validation = await validateRequest(request, deps);
  if (!validation.ok) return { error: validation.error, status: "rejected" };

  const tripId = createStableTripId(request.createOperationId);
  const pendingRecord = usesDefaultApplyStore
    ? await findDefaultPendingRecord(request.createOperationId)
    : undefined;
  const existingTrip = await deps.findTripById(tripId);
  if (
    (pendingRecord && pendingRecord.tripId !== tripId) ||
    (existingTrip && !pendingRecord)
  ) {
    return {
      error: {
        code: "TRIP_ID_CONFLICT",
        message: "稳定 Trip ID 已被其他本地行程占用。",
      },
      status: "failed",
    };
  }
  let didPersist = false;
  let ownsPendingTrip = Boolean(pendingRecord);
  try {
    if (usesDefaultApplyStore && !pendingRecord) {
      await recordDefaultPendingRecord({
        createOperationId: request.createOperationId,
        startedAt: deps.clock?.() ?? new Date().toISOString(),
        tripId,
      });
      ownsPendingTrip = true;
    }
    const trip =
      existingTrip ??
      (await deps.persistTripLocally(
        tripDraftToCreateTripInput(validation.draft),
        tripId,
      ));
    didPersist = !existingTrip;
    await deps.markTripDirty(trip);
    const receipt = await deps.recordReceipt(
      {
        appliedAt: deps.clock?.() ?? new Date().toISOString(),
        conversationId: request.conversationId,
        createOperationId: request.createOperationId,
        draftId: request.draftId,
        draftRevision: request.draftRevision,
        tripId: trip.id,
        turnId: request.turnId,
      },
      trip,
    );
    if (usesDefaultApplyStore) {
      try {
        await clearDefaultPendingRecord(request.createOperationId);
      } catch {
        // receipt 已经提交；残留 pending 记录不影响幂等结果，后续可安全清理。
      }
    }
    try {
      deps.scheduleCloudSync();
    } catch {
      // 本地 Trip、dirty 与 receipt 已提交；调度失败不能回滚已确认创建。
    }
    return { receipt, status: "applied", trip };
  } catch (error) {
    if (didPersist || ownsPendingTrip) {
      try {
        await deps.rollbackLocalTrip(tripId);
        if (usesDefaultApplyStore) {
          await clearDefaultPendingRecord(request.createOperationId);
        }
      } catch (rollbackError) {
        const writeMessage =
          error instanceof Error ? error.message : "创建行程失败。";
        const rollbackMessage =
          rollbackError instanceof Error
            ? rollbackError.message
            : "本地补偿失败。";
        return {
          error: {
            code: "ROLLBACK_FAILED",
            message: `${writeMessage} 本地补偿失败：${rollbackMessage}`,
          },
          status: "failed",
        };
      }
    }
    return {
      error: {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "创建行程失败。",
      },
      status: "failed",
    };
  }
}

async function validateRequest(
  request: TripCreateRequest,
  deps: TripCreateApplyDeps,
): Promise<TripCreateValidationResult> {
  const requestDraft = parseConfirmedTripDraftSnapshot(request.draft);
  if (!requestDraft) {
    return rejected("INVALID_DRAFT", "TripCreateRequest 中的草案结构无效。");
  }
  const storedDraft = await deps.loadDraft(request.draftId);
  if (!storedDraft) {
    return rejected("DRAFT_NOT_FOUND", "待创建的 TripDraft 不存在。");
  }
  const draft = parseConfirmedTripDraftSnapshot(storedDraft);
  if (!draft) {
    return rejected("INVALID_DRAFT", "持久化的 TripDraft 不符合运行时契约。");
  }
  if (
    request.draftId !== draft.draftId ||
    request.draftRevision !== getTripDraftRevision(draft) ||
    request.draftRevision !== getTripDraftRevision(requestDraft) ||
    request.createOperationId !==
      getTripCreateOperationId(request.draftId, request.draftRevision)
  ) {
    return rejected("DRAFT_CHANGED", "TripDraft 已变化，请重新检查后再创建。");
  }
  if (
    !draft.destination.trim() ||
    !draft.title.trim() ||
    draft.dayCount < 1 ||
    draft.dayCount > 14 ||
    draft.days.length !== draft.dayCount ||
    (draft.missingFields?.length ?? 0) > 0
  ) {
    return rejected("INVALID_DRAFT", "TripDraft 未通过完整性校验。");
  }
  for (const day of draft.days) {
    for (const item of day.items) {
      if (
        item.provider !== "amap" ||
        !item.providerPlaceId?.trim() ||
        !Number.isFinite(item.latitude) ||
        !Number.isFinite(item.longitude) ||
        (item.latitude ?? 91) < -90 ||
        (item.latitude ?? -91) > 90 ||
        (item.longitude ?? 181) < -180 ||
        (item.longitude ?? -181) > 180
      ) {
        return rejected(
          "UNVERIFIED_POI",
          `地点「${item.title}」缺少已验证 POI 标识。`,
        );
      }
    }
  }
  return { draft, ok: true } as const;
}

function rejected(
  code: TripCreateApplyErrorCode,
  message: string,
): TripCreateValidationResult {
  return { error: { code, message }, ok: false };
}

function createStableTripId(operationId: string): string {
  return `trip-agent-${operationId}`;
}

function createDefaultDeps(
  overrides: Partial<TripCreateApplyDeps>,
): TripCreateApplyDeps {
  return {
    clock: overrides.clock,
    findReceipt: overrides.findReceipt ?? findDefaultReceipt,
    findTripById: overrides.findTripById ?? getTripById,
    loadDraft: overrides.loadDraft ?? getAgentTripDraft,
    markTripDirty: overrides.markTripDirty ?? markTripDirtyWithoutScheduling,
    persistTripLocally:
      overrides.persistTripLocally ??
      ((input, tripId) => createTripLocally(input, { tripId })),
    recordReceipt: overrides.recordReceipt ?? recordDefaultReceipt,
    rollbackLocalTrip:
      overrides.rollbackLocalTrip ?? rollbackLocallyCreatedTrip,
    scheduleCloudSync: overrides.scheduleCloudSync ?? scheduleTripsCloudSync,
  };
}

async function findDefaultReceipt(createOperationId: string) {
  const storage = getAgentLocalStorage();
  const rawReceipt = await storage.getItem(
    getTripCreateReceiptStorageKey(createOperationId),
  );
  const receipt = parseTripCreateApplyReceipt(rawReceipt);
  if (receipt?.createOperationId === createOperationId) {
    return receipt;
  }

  const record = await findLegacyReceiptRecord(createOperationId);
  if (!record) return undefined;
  const proposalIdentity = record.proposalId.replace(/^trip-create:/, "");
  const revisionSeparator = proposalIdentity.lastIndexOf(":");
  const legacyReceipt = {
    appliedAt: record.appliedAt,
    conversationId: "restored",
    createOperationId,
    draftId: proposalIdentity.slice(0, revisionSeparator),
    draftRevision: proposalIdentity.slice(revisionSeparator + 1),
    tripId: record.tripId,
    turnId: "restored",
  } satisfies TripCreateApplyReceipt;
  await storage.setItem(
    getTripCreateReceiptStorageKey(createOperationId),
    JSON.stringify(legacyReceipt),
  );
  return legacyReceipt;
}

async function recordDefaultReceipt(
  receipt: TripCreateApplyReceipt,
  _trip: Trip,
) {
  await getAgentLocalStorage().setItem(
    getTripCreateReceiptStorageKey(receipt.createOperationId),
    JSON.stringify(receipt),
  );
  return receipt;
}

function getTripCreateReceiptStorageKey(createOperationId: string): string {
  return `${TRIP_CREATE_RECEIPT_STORAGE_KEY_PREFIX}${encodeURIComponent(createOperationId)}`;
}

function getTripCreatePendingStorageKey(createOperationId: string): string {
  return `${TRIP_CREATE_PENDING_STORAGE_KEY_PREFIX}${encodeURIComponent(createOperationId)}`;
}

async function findDefaultPendingRecord(
  createOperationId: string,
): Promise<TripCreatePendingRecord | undefined> {
  const rawRecord = await getAgentLocalStorage().getItem(
    getTripCreatePendingStorageKey(createOperationId),
  );
  if (!rawRecord) return undefined;

  try {
    const value = JSON.parse(rawRecord) as Record<string, unknown>;
    if (
      value.createOperationId !== createOperationId ||
      typeof value.startedAt !== "string" ||
      !value.startedAt.trim() ||
      typeof value.tripId !== "string" ||
      !value.tripId.trim()
    ) {
      return undefined;
    }

    return {
      createOperationId,
      startedAt: value.startedAt,
      tripId: value.tripId,
    };
  } catch {
    return undefined;
  }
}

async function recordDefaultPendingRecord(
  record: TripCreatePendingRecord,
): Promise<void> {
  await getAgentLocalStorage().setItem(
    getTripCreatePendingStorageKey(record.createOperationId),
    JSON.stringify(record),
  );
}

async function clearDefaultPendingRecord(
  createOperationId: string,
): Promise<void> {
  await getAgentLocalStorage().removeItem?.(
    getTripCreatePendingStorageKey(createOperationId),
  );
}

function parseTripCreateApplyReceipt(
  rawReceipt: string | null,
): TripCreateApplyReceipt | undefined {
  if (!rawReceipt) return undefined;

  try {
    const value = JSON.parse(rawReceipt) as Record<string, unknown>;
    const fields = [
      "appliedAt",
      "conversationId",
      "createOperationId",
      "draftId",
      "draftRevision",
      "tripId",
      "turnId",
    ] as const;

    if (
      typeof value !== "object" ||
      value === null ||
      fields.some(
        (field) => typeof value[field] !== "string" || !value[field].trim(),
      )
    ) {
      return undefined;
    }

    return value as TripCreateApplyReceipt;
  } catch {
    return undefined;
  }
}

async function findLegacyReceiptRecord(createOperationId: string) {
  try {
    return (await getAppliedAgentProposalRecords()).find((item) =>
      item.operationIds.includes(createOperationId),
    );
  } catch {
    return undefined;
  }
}
