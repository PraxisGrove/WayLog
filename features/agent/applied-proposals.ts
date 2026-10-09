import {
  getLocalDb,
  isLocalDbSupported,
  runLocalDbTransaction,
  type LocalDbExecutor,
} from "../local-db";
import type { Trip } from "../trips/types";
import { getAgentLocalStorage } from "./agent-local-storage";
import type { TripEditProposal } from "./contracts/trip-edit-proposal-contract";

export const AGENT_APPLIED_PROPOSALS_STORAGE_KEY =
  "waylog.agent.applied-proposals.v1";
const MAX_APPLIED_PROPOSAL_RECORDS = 200;

export type AgentApplyLedgerStatus = "failed" | "started" | "succeeded";

export type AgentApplyFailureStep =
  | "duplicate_check"
  | "proposal_apply"
  | "trip_save"
  | "unknown";

export type AppliedAgentProposalRecord = {
  appliedAt: string;
  conversationId?: string;
  operationIds: string[];
  proposalId: string;
  tripId: string;
  tripUpdatedAtAfterApply: string;
  turnId?: string;
};

export type AgentApplyLedgerRecord = {
  errorCode?: string;
  errorMessage?: string;
  failedStep?: AgentApplyFailureStep;
  finishedAt?: string;
  operationIds: string[];
  proposalId: string;
  startedAt: string;
  status: AgentApplyLedgerStatus;
  tripId: string;
  tripUpdatedAtAfterApply?: string;
  tripUpdatedAtBeforeApply?: string;
};

export type AgentAppliedProposalStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AgentAppliedProposalDeps = {
  clock?: () => string;
  storage?: AgentAppliedProposalStorage;
};

type AgentApplyRecordRow = {
  conversation_id: string | null;
  error_code: string | null;
  error_message: string | null;
  failed_step: string | null;
  finished_at: string | null;
  proposal_id: string;
  started_at: string;
  status: AgentApplyLedgerStatus;
  trip_id: string;
  trip_updated_at_after_apply: string | null;
  trip_updated_at_before_apply: string | null;
  turn_id: string | null;
};

type AgentApplyOperationRow = {
  operation_id: string;
};

export async function getAppliedAgentProposalRecords(
  deps: AgentAppliedProposalDeps = {},
): Promise<AppliedAgentProposalRecord[]> {
  if (!isLocalDbSupported()) {
    return getWebAppliedAgentProposalRecords(deps);
  }

  await migrateLegacyAppliedProposalRecordsToLedger(deps);
  const db = await getLocalDb();
  const rows = await db.getAll<AgentApplyRecordRow>(
    `SELECT proposal_id, trip_id, conversation_id, turn_id,
        status, started_at, finished_at,
        trip_updated_at_before_apply, trip_updated_at_after_apply,
        failed_step, error_code, error_message
      FROM agent_apply_records
      WHERE status = 'succeeded'
      ORDER BY COALESCE(finished_at, started_at) DESC
      LIMIT ?`,
    [MAX_APPLIED_PROPOSAL_RECORDS],
  );
  const records: AppliedAgentProposalRecord[] = [];

  for (const row of rows) {
    const operationIds = await getSucceededOperationIdsByProposalId(
      db,
      row.proposal_id,
    );

    if (!row.trip_updated_at_after_apply || operationIds.length === 0) {
      continue;
    }

    records.push({
      appliedAt: row.finished_at ?? row.started_at,
      conversationId: row.conversation_id ?? undefined,
      operationIds,
      proposalId: row.proposal_id,
      tripId: row.trip_id,
      tripUpdatedAtAfterApply: row.trip_updated_at_after_apply,
      turnId: row.turn_id ?? undefined,
    });
  }

  return records;
}

export async function getAppliedAgentOperationIds(
  deps: AgentAppliedProposalDeps = {},
): Promise<Set<string>> {
  if (!isLocalDbSupported()) {
    const records = await getWebAppliedAgentProposalRecords(deps);

    return new Set(records.flatMap((record) => record.operationIds));
  }

  await migrateLegacyAppliedProposalRecordsToLedger(deps);
  const db = await getLocalDb();
  const rows = await db.getAll<AgentApplyOperationRow>(
    `SELECT operation_id
      FROM agent_apply_operation_ledger
      WHERE status = 'succeeded'`,
  );

  return new Set(rows.map((row) => row.operation_id));
}

export async function hasAppliedAgentProposal(
  proposal: TripEditProposal,
  deps: AgentAppliedProposalDeps = {},
): Promise<boolean> {
  if (!isLocalDbSupported()) {
    const records = await getWebAppliedAgentProposalRecords(deps);
    const operationIds = new Set(getProposalOperationIds(proposal));

    return records.some(
      (record) =>
        record.proposalId === proposal.proposalId ||
        record.operationIds.some((operationId) =>
          operationIds.has(operationId),
        ),
    );
  }

  await migrateLegacyAppliedProposalRecordsToLedger(deps);
  const db = await getLocalDb();
  const proposalRow = await db.getFirst<{ proposal_id: string }>(
    `SELECT proposal_id
      FROM agent_apply_records
      WHERE proposal_id = ? AND status = 'succeeded'
      LIMIT 1`,
    [proposal.proposalId],
  );

  if (proposalRow) {
    return true;
  }

  const operationIds = getProposalOperationIds(proposal);

  if (operationIds.length === 0) {
    return false;
  }

  const placeholders = operationIds.map(() => "?").join(", ");
  const operationRows = await db.getAll<AgentApplyOperationRow>(
    `SELECT operation_id
      FROM agent_apply_operation_ledger
      WHERE status = 'succeeded'
        AND operation_id IN (${placeholders})
      LIMIT 1`,
    operationIds,
  );

  return operationRows.length > 0;
}

export async function beginAgentProposalApply(
  input: {
    proposal: TripEditProposal;
    trip: Trip;
  },
  deps: AgentAppliedProposalDeps = {},
): Promise<AgentApplyLedgerRecord> {
  if (!isLocalDbSupported()) {
    return {
      operationIds: getProposalOperationIds(input.proposal),
      proposalId: input.proposal.proposalId,
      startedAt: getNow(deps),
      status: "started",
      tripId: input.trip.id,
      tripUpdatedAtBeforeApply: input.trip.updatedAt,
    };
  }

  await migrateLegacyAppliedProposalRecordsToLedger(deps);
  const db = await getLocalDb();
  const startedAt = getNow(deps);

  await runLocalDbTransaction(db, async (transactionDb) => {
    await upsertApplyRecord(transactionDb, {
      conversationId: null,
      errorCode: null,
      errorMessage: null,
      failedStep: null,
      finishedAt: null,
      proposal: input.proposal,
      startedAt,
      status: "started",
      tripId: input.trip.id,
      tripUpdatedAtAfterApply: null,
      tripUpdatedAtBeforeApply: input.trip.updatedAt,
      turnId: null,
    });
    await upsertOperationLedgerRows(transactionDb, {
      finishedAt: null,
      operationIds: getProposalOperationIds(input.proposal),
      proposal: input.proposal,
      startedAt,
      status: "started",
      tripId: input.trip.id,
    });
  });

  return {
    operationIds: getProposalOperationIds(input.proposal),
    proposalId: input.proposal.proposalId,
    startedAt,
    status: "started",
    tripId: input.trip.id,
    tripUpdatedAtBeforeApply: input.trip.updatedAt,
  };
}

export async function recordFailedAgentProposalApply(
  input: {
    errorCode: string;
    errorMessage: string;
    failedStep?: AgentApplyFailureStep;
    proposal: TripEditProposal;
    trip?: Trip;
  },
  deps: AgentAppliedProposalDeps = {},
): Promise<AgentApplyLedgerRecord> {
  if (!isLocalDbSupported()) {
    const finishedAt = getNow(deps);
    const tripId = input.trip?.id ?? input.proposal.tripId;
    const tripUpdatedAtBeforeApply =
      input.trip?.updatedAt ?? input.proposal.expectedUpdatedAt;

    return {
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      failedStep: input.failedStep ?? "unknown",
      finishedAt,
      operationIds: getProposalOperationIds(input.proposal),
      proposalId: input.proposal.proposalId,
      startedAt: finishedAt,
      status: "failed",
      tripId,
      tripUpdatedAtBeforeApply,
    };
  }

  await migrateLegacyAppliedProposalRecordsToLedger(deps);
  const db = await getLocalDb();
  const finishedAt = getNow(deps);
  const tripId = input.trip?.id ?? input.proposal.tripId;
  const tripUpdatedAtBeforeApply =
    input.trip?.updatedAt ?? input.proposal.expectedUpdatedAt;

  await runLocalDbTransaction(db, async (transactionDb) => {
    await upsertApplyRecord(transactionDb, {
      conversationId: null,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      failedStep: input.failedStep ?? "unknown",
      finishedAt,
      proposal: input.proposal,
      startedAt: finishedAt,
      status: "failed",
      tripId,
      tripUpdatedAtAfterApply: null,
      tripUpdatedAtBeforeApply,
      turnId: null,
    });
    await upsertOperationLedgerRows(transactionDb, {
      finishedAt,
      operationIds: getProposalOperationIds(input.proposal),
      proposal: input.proposal,
      startedAt: finishedAt,
      status: "failed",
      tripId,
    });
  });

  return {
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    failedStep: input.failedStep ?? "unknown",
    finishedAt,
    operationIds: getProposalOperationIds(input.proposal),
    proposalId: input.proposal.proposalId,
    startedAt: finishedAt,
    status: "failed",
    tripId,
    tripUpdatedAtBeforeApply,
  };
}

export async function recordAppliedAgentProposal(
  input: {
    appliedOperationIds: string[];
    conversationId?: string;
    proposal: TripEditProposal;
    trip: Trip;
    turnId?: string;
  },
  deps: AgentAppliedProposalDeps = {},
): Promise<AppliedAgentProposalRecord[]> {
  if (!isLocalDbSupported()) {
    const records = await getWebAppliedAgentProposalRecords(deps);
    const appliedAt = getNow(deps);
    const appliedOperationIds = getUniqueOperationIds(
      input.appliedOperationIds.length > 0
        ? input.appliedOperationIds
        : getProposalOperationIds(input.proposal),
    );
    const nextRecord: AppliedAgentProposalRecord = {
      appliedAt,
      conversationId: input.conversationId,
      operationIds: appliedOperationIds,
      proposalId: input.proposal.proposalId,
      tripId: input.trip.id,
      tripUpdatedAtAfterApply: input.trip.updatedAt,
      turnId: input.turnId,
    };
    const nextRecords = [nextRecord, ...records]
      .filter(
        (record, index, array) =>
          array.findIndex((item) => item.proposalId === record.proposalId) ===
          index,
      )
      .slice(0, MAX_APPLIED_PROPOSAL_RECORDS);

    await saveWebAppliedAgentProposalRecords(nextRecords, deps);

    return nextRecords;
  }

  await migrateLegacyAppliedProposalRecordsToLedger(deps);
  const db = await getLocalDb();
  const appliedAt = getNow(deps);
  const appliedOperationIds = getUniqueOperationIds(
    input.appliedOperationIds.length > 0
      ? input.appliedOperationIds
      : getProposalOperationIds(input.proposal),
  );
  const committedRecord: AppliedAgentProposalRecord = {
    appliedAt,
    conversationId: input.conversationId,
    operationIds: appliedOperationIds,
    proposalId: input.proposal.proposalId,
    tripId: input.trip.id,
    tripUpdatedAtAfterApply: input.trip.updatedAt,
    turnId: input.turnId,
  };

  await runLocalDbTransaction(db, async (transactionDb) => {
    await upsertApplyRecord(transactionDb, {
      conversationId: input.conversationId ?? null,
      errorCode: null,
      errorMessage: null,
      failedStep: null,
      finishedAt: appliedAt,
      proposal: input.proposal,
      startedAt: appliedAt,
      status: "succeeded",
      tripId: input.trip.id,
      tripUpdatedAtAfterApply: input.trip.updatedAt,
      tripUpdatedAtBeforeApply: input.proposal.expectedUpdatedAt,
      turnId: input.turnId ?? null,
    });
    await upsertOperationLedgerRows(transactionDb, {
      finishedAt: appliedAt,
      operationIds: appliedOperationIds,
      proposal: input.proposal,
      startedAt: appliedAt,
      status: "succeeded",
      tripId: input.trip.id,
    });
  });

  // 事务提交后不再追加可能失败的读取，否则调用方会误判 receipt 未提交并回滚 Trip。
  return [committedRecord];
}

export async function clearAppliedAgentProposalLedger(
  deps: AgentAppliedProposalDeps = {},
): Promise<void> {
  const storage = deps.storage ?? getAgentLocalStorage();
  await storage.removeItem?.(AGENT_APPLIED_PROPOSALS_STORAGE_KEY);

  if (!isLocalDbSupported()) {
    return;
  }

  const db = await getLocalDb();

  await runLocalDbTransaction(db, async (transactionDb) => {
    await transactionDb.run("DELETE FROM agent_apply_operation_ledger");
    await transactionDb.run("DELETE FROM agent_apply_records");
  });
}

async function getWebAppliedAgentProposalRecords(
  deps: AgentAppliedProposalDeps,
): Promise<AppliedAgentProposalRecord[]> {
  const storage = deps.storage ?? getAgentLocalStorage();
  const rawValue = await storage.getItem(AGENT_APPLIED_PROPOSALS_STORAGE_KEY);

  return rawValue
    ? parseAppliedAgentProposalRecords(rawValue).slice(
        0,
        MAX_APPLIED_PROPOSAL_RECORDS,
      )
    : [];
}

async function saveWebAppliedAgentProposalRecords(
  records: AppliedAgentProposalRecord[],
  deps: AgentAppliedProposalDeps,
): Promise<void> {
  const storage = deps.storage ?? getAgentLocalStorage();

  await storage.setItem(
    AGENT_APPLIED_PROPOSALS_STORAGE_KEY,
    JSON.stringify(records.slice(0, MAX_APPLIED_PROPOSAL_RECORDS)),
  );
}

async function migrateLegacyAppliedProposalRecordsToLedger(
  deps: AgentAppliedProposalDeps,
): Promise<void> {
  const storage = deps.storage ?? getAgentLocalStorage();
  const rawValue = await storage.getItem(AGENT_APPLIED_PROPOSALS_STORAGE_KEY);

  if (!rawValue) {
    return;
  }

  const legacyRecords = parseAppliedAgentProposalRecords(rawValue);

  if (legacyRecords.length === 0) {
    return;
  }

  const db = await getLocalDb();

  await runLocalDbTransaction(db, async (transactionDb) => {
    for (const record of legacyRecords) {
      await insertLegacyApplyRecord(transactionDb, record);
    }
  });
  await storage.removeItem?.(AGENT_APPLIED_PROPOSALS_STORAGE_KEY);
}

async function insertLegacyApplyRecord(
  db: LocalDbExecutor,
  record: AppliedAgentProposalRecord,
): Promise<void> {
  await db.run(
    `INSERT OR IGNORE INTO agent_apply_records (
        record_id, proposal_id, trip_id, status, started_at, finished_at,
        trip_updated_at_before_apply, trip_updated_at_after_apply,
        failed_step, error_code, error_message
      )
      VALUES (?, ?, ?, 'succeeded', ?, ?, NULL, ?, NULL, NULL, NULL)`,
    [
      record.proposalId,
      record.proposalId,
      record.tripId,
      record.appliedAt,
      record.appliedAt,
      record.tripUpdatedAtAfterApply,
    ],
  );

  for (const operationId of record.operationIds) {
    await db.run(
      `INSERT OR IGNORE INTO agent_apply_operation_ledger (
          operation_id, proposal_id, trip_id, operation_type, status,
          started_at, finished_at
        )
        VALUES (?, ?, ?, 'legacy', 'succeeded', ?, ?)`,
      [
        operationId,
        record.proposalId,
        record.tripId,
        record.appliedAt,
        record.appliedAt,
      ],
    );
  }
}

async function upsertApplyRecord(
  db: LocalDbExecutor,
  input: {
    conversationId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    failedStep: AgentApplyFailureStep | null;
    finishedAt: string | null;
    proposal: TripEditProposal;
    startedAt: string;
    status: AgentApplyLedgerStatus;
    tripId: string;
    tripUpdatedAtAfterApply: string | null;
    tripUpdatedAtBeforeApply: string | null;
    turnId: string | null;
  },
): Promise<void> {
  await db.run(
    `INSERT INTO agent_apply_records (
        record_id, proposal_id, trip_id, conversation_id, turn_id,
        status, started_at, finished_at,
        trip_updated_at_before_apply, trip_updated_at_after_apply,
        failed_step, error_code, error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(proposal_id) DO UPDATE SET
        trip_id = excluded.trip_id,
        conversation_id = COALESCE(
          agent_apply_records.conversation_id,
          excluded.conversation_id
        ),
        turn_id = COALESCE(agent_apply_records.turn_id, excluded.turn_id),
        status = excluded.status,
        started_at = COALESCE(agent_apply_records.started_at, excluded.started_at),
        finished_at = excluded.finished_at,
        trip_updated_at_before_apply = COALESCE(
          agent_apply_records.trip_updated_at_before_apply,
          excluded.trip_updated_at_before_apply
        ),
        trip_updated_at_after_apply = excluded.trip_updated_at_after_apply,
        failed_step = excluded.failed_step,
        error_code = excluded.error_code,
        error_message = excluded.error_message
      WHERE agent_apply_records.status != 'succeeded'
        OR excluded.status = 'succeeded'`,
    [
      input.proposal.proposalId,
      input.proposal.proposalId,
      input.tripId,
      input.conversationId,
      input.turnId,
      input.status,
      input.startedAt,
      input.finishedAt,
      input.tripUpdatedAtBeforeApply,
      input.tripUpdatedAtAfterApply,
      input.failedStep,
      input.errorCode,
      input.errorMessage,
    ],
  );
}

async function upsertOperationLedgerRows(
  db: LocalDbExecutor,
  input: {
    finishedAt: string | null;
    operationIds: string[];
    proposal: TripEditProposal;
    startedAt: string;
    status: AgentApplyLedgerStatus;
    tripId: string;
  },
): Promise<void> {
  const operationsById = new Map(
    input.proposal.operations.map((operation) => [
      operation.operationId,
      operation,
    ]),
  );

  for (const operationId of input.operationIds) {
    const operation = operationsById.get(operationId);

    await db.run(
      `INSERT INTO agent_apply_operation_ledger (
          operation_id, proposal_id, trip_id, operation_type, status,
          started_at, finished_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(operation_id) DO UPDATE SET
          proposal_id = excluded.proposal_id,
          trip_id = excluded.trip_id,
          operation_type = excluded.operation_type,
          status = excluded.status,
          started_at = COALESCE(
            agent_apply_operation_ledger.started_at,
            excluded.started_at
          ),
          finished_at = excluded.finished_at
        WHERE agent_apply_operation_ledger.status != 'succeeded'
        `,
      [
        operationId,
        input.proposal.proposalId,
        input.tripId,
        operation?.type ?? "unknown",
        input.status,
        input.startedAt,
        input.finishedAt,
      ],
    );
  }
}

async function getSucceededOperationIdsByProposalId(
  db: LocalDbExecutor,
  proposalId: string,
): Promise<string[]> {
  const rows = await db.getAll<AgentApplyOperationRow>(
    `SELECT operation_id
      FROM agent_apply_operation_ledger
      WHERE proposal_id = ? AND status = 'succeeded'
      ORDER BY COALESCE(finished_at, started_at), operation_id`,
    [proposalId],
  );

  return rows.map((row) => row.operation_id);
}

function parseAppliedAgentProposalRecords(
  rawValue: string,
): AppliedAgentProposalRecord[] {
  try {
    const parsed = JSON.parse(rawValue);

    return Array.isArray(parsed)
      ? parsed
          .map(parseAppliedAgentProposalRecord)
          .filter(
            (record): record is AppliedAgentProposalRecord =>
              record !== undefined,
          )
      : [];
  } catch {
    return [];
  }
}

function parseAppliedAgentProposalRecord(
  value: unknown,
): AppliedAgentProposalRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const appliedAt = readString(value.appliedAt);
  const conversationId = readString(value.conversationId);
  const proposalId = readString(value.proposalId);
  const tripId = readString(value.tripId);
  const tripUpdatedAtAfterApply = readString(value.tripUpdatedAtAfterApply);
  const turnId = readString(value.turnId);
  const operationIds = Array.isArray(value.operationIds)
    ? getUniqueOperationIds(
        value.operationIds.filter(
          (operationId): operationId is string =>
            typeof operationId === "string" && operationId.trim().length > 0,
        ),
      )
    : [];

  if (
    !appliedAt ||
    !proposalId ||
    !tripId ||
    !tripUpdatedAtAfterApply ||
    operationIds.length === 0
  ) {
    return undefined;
  }

  return {
    appliedAt,
    conversationId,
    operationIds,
    proposalId,
    tripId,
    tripUpdatedAtAfterApply,
    turnId,
  };
}

function getNow(deps: AgentAppliedProposalDeps): string {
  return deps.clock?.() ?? new Date().toISOString();
}

function getProposalOperationIds(proposal: TripEditProposal): string[] {
  return getUniqueOperationIds(
    proposal.operations.map((operation) => operation.operationId),
  );
}

function getUniqueOperationIds(operationIds: string[]): string[] {
  return [
    ...new Set(operationIds.map((operationId) => operationId.trim())),
  ].filter((operationId) => operationId.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
