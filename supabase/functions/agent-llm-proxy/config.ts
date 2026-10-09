export type AgentLLMConfig = {
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  model: string;
  provider: string;
  temperature: number;
};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

export const agentTurnMinuteLimit = readPositiveIntegerEnv(
  "AGENT_TURN_RATE_LIMIT_PER_MINUTE",
  6,
);
export const agentTurnDailyLimit = readPositiveIntegerEnv(
  "AGENT_TURN_RATE_LIMIT_PER_DAY",
  60,
);
export const agentRateLimitTimeoutMs = readPositiveIntegerEnv(
  "AGENT_RATE_LIMIT_TIMEOUT_MS",
  3000,
);
export const agentLLMTimeoutMs = readPositiveIntegerEnv(
  "AGENT_LLM_TIMEOUT_MS",
  30000,
);
export function readAgentLLMConfig(): AgentLLMConfig | undefined {
  const apiKey = readEnv("AGENT_LLM_API_KEY");
  const baseUrl = normalizeUrl(readEnv("AGENT_LLM_BASE_URL"));
  const model = readEnv("AGENT_LLM_MODEL");

  if (!apiKey || !baseUrl || !model) {
    return undefined;
  }

  return {
    apiKey,
    baseUrl,
    maxTokens: readPositiveIntegerEnv("AGENT_LLM_MAX_TOKENS", 1200),
    model,
    provider: readEnv("AGENT_LLM_PROVIDER") || "openai-compatible",
    temperature: readNumberEnv("AGENT_LLM_TEMPERATURE", 0.2),
  };
}

export function readEnv(name: string): string {
  if (typeof Deno !== "undefined") {
    return Deno.env.get(name)?.trim() ?? "";
  }

  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return nodeEnv?.[name]?.trim() ?? "";
}

export function readNumberEnv(name: string, fallback: number): number {
  const value = Number(readEnv(name));

  return Number.isFinite(value) ? value : fallback;
}

export function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(readEnv(name));

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function normalizeUrl(value: string): string {
  return value.replace(/\/+$/g, "");
}
