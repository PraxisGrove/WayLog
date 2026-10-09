import { getSupabaseConfig } from "../auth/supabase";
import { getTripsWithSeed } from "../trips/storage";
import type { Trip } from "../trips/types";
import { getAgentLocalStorage } from "./agent-local-storage";
import { requestAgentServiceStatus } from "./agent-service-status";
import type { AgentUiEvent } from "./agent-ui-events";
import {
  createAgentTripTargetSummaries,
  resolveAgentTripTarget,
} from "./global-trip-target";
import { createPiProxyStreamFn } from "./pi-proxy-stream";
import {
  type ProposalGenerationDeps,
  type ProposalGenerationResult,
  type ResumeProposalGenerationInput,
  type ResumeTripDraftProposalGenerationInput,
  type RetryProposalGenerationInput,
  resumeProposalGeneration,
  resumeTripDraftProposalGeneration,
  runProposalGeneration,
  retryProposalGeneration,
} from "./proposal-generation";
import { createProductionProposalGenerationReadTools } from "./proposal-generation-read-tools";

export async function requestProposalGenerationViaPi(input: {
  accessToken: string;
  accountId: string;
  conversationId?: string;
  hasSelectedTrip?: boolean;
  onEvent?: (event: AgentUiEvent) => void;
  selectedTrip?: Trip;
  userMessage: string;
}): Promise<ProposalGenerationResult> {
  const accessToken = input.accessToken.trim();

  if (!accessToken) {
    throw new Error("请先登录后使用旅行助手");
  }

  const appVersion = await readAgentAppVersion();

  return runProposalGeneration(
    {
      accountId: input.accountId,
      conversationId: input.conversationId,
      pageContext: {
        hasSelectedTrip: Boolean(input.hasSelectedTrip),
        surface: "agent_conversation",
      },
      selectedTrip: input.selectedTrip,
      timeZone: readDeviceTimeZone(),
      userMessage: input.userMessage,
    },
    createProductionProposalGenerationDeps(
      accessToken,
      input.onEvent,
      appVersion,
      input.userMessage,
    ),
  );
}

function readDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  } catch {
    return "Asia/Shanghai";
  }
}

export async function resumeTripDraftProposalGenerationViaPi(
  input: ResumeTripDraftProposalGenerationInput & {
    accessToken: string;
    onEvent?: (event: AgentUiEvent) => void;
  },
): Promise<ProposalGenerationResult> {
  const accessToken = input.accessToken.trim();
  if (!accessToken) throw new Error("请先登录后使用旅行助手");
  const appVersion = await readAgentAppVersion();
  return resumeTripDraftProposalGeneration(
    input,
    createProductionProposalGenerationDeps(
      accessToken,
      input.onEvent,
      appVersion,
    ),
  );
}

export async function resumeProposalGenerationViaPi(
  input: ResumeProposalGenerationInput & {
    accessToken: string;
    onEvent?: (event: AgentUiEvent) => void;
  },
): Promise<ProposalGenerationResult> {
  const accessToken = input.accessToken.trim();

  if (!accessToken) {
    throw new Error("请先登录后使用旅行助手");
  }

  const appVersion = await readAgentAppVersion();
  return resumeProposalGeneration(
    input,
    createProductionProposalGenerationDeps(
      accessToken,
      input.onEvent,
      appVersion,
    ),
  );
}

export async function retryProposalGenerationViaPi(
  input: RetryProposalGenerationInput & {
    accessToken: string;
    onEvent?: (event: AgentUiEvent) => void;
  },
): Promise<ProposalGenerationResult> {
  const accessToken = input.accessToken.trim();
  if (!accessToken) throw new Error("请先登录后使用旅行助手");
  const appVersion = await readAgentAppVersion();
  return retryProposalGeneration(
    input,
    createProductionProposalGenerationDeps(
      accessToken,
      input.onEvent,
      appVersion,
    ),
  );
}

function createProductionProposalGenerationDeps(
  accessToken: string,
  onEvent?: (event: AgentUiEvent) => void,
  appVersion = "0",
  userMessage?: string,
): ProposalGenerationDeps {
  const config = getSupabaseConfig();
  const createModel = (
    phase: "itinerary_edit" | "route_selector" | "trip_draft" | "waylog_qa",
    promptVersion: string,
  ) =>
    createPiProxyStreamFn({
      accessToken,
      anonKey: config.anonKey,
      appVersion,
      phase,
      promptVersion,
      url: `${config.url}/functions/v1/agent-llm-proxy`,
    });

  return {
    clock: () => new Date().toISOString(),
    onEvent,
    resolveTrip: resolveTripForProposalGeneration,
    resolveToolsForUserMessage: (retryUserMessage) =>
      createProductionProposalGenerationReadTools({
        accessToken,
        userMessage: retryUserMessage,
      }),
    routeModel: createModel("route_selector", "route-selector.v2"),
    skillModel: createModel("waylog_qa", "waylog-qa.v1"),
    skillModels: {
      "itinerary.edit": createModel("itinerary_edit", "itinerary-edit.v1"),
      "trip.draft": createModel("trip_draft", "trip-draft.v1"),
    },
    storage: getAgentLocalStorage(),
    tools: createProductionProposalGenerationReadTools({
      accessToken,
      userMessage,
    }),
  };
}

export async function requestCurrentAgentServiceStatus(accessToken: string) {
  const config = getSupabaseConfig();
  const appVersion = await readAgentAppVersion();
  return requestAgentServiceStatus({
    accessToken,
    anonKey: config.anonKey,
    appVersion,
    url: `${config.url}/functions/v1/agent-llm-proxy`,
  });
}

async function readAgentAppVersion(): Promise<string> {
  const constantsModule = await import("expo-constants");
  const constants = constantsModule.default as unknown as {
    expoConfig?: { version?: string };
  };
  return constants.expoConfig?.version ?? "0";
}

export { isUserTriggeredWebSearch } from "./proposal-generation-read-tools";

async function resolveTripForProposalGeneration(userMessage: string) {
  const trips = await getTripsWithSeed();
  const summaries = createAgentTripTargetSummaries(
    trips.map((trip) => ({
      dayCount: trip.days.length,
      destination: trip.destination,
      endDate: trip.endDate,
      id: trip.id,
      startDate: trip.startDate,
      status: trip.status,
      title: trip.title,
    })),
  );
  const resolution = resolveAgentTripTarget(userMessage, summaries);

  if (resolution.status !== "resolved") {
    return resolution;
  }

  const trip = trips.find(
    (candidate) => candidate.id === resolution.candidate.id,
  );

  return trip
    ? { status: "selected" as const, trip }
    : { reason: "目标行程已不存在", status: "not_found" as const };
}
