import {
  type AgentToolDefinition,
  type AgentToolRunContext,
  createAgentToolAudit,
  createAgentToolFailure,
  createAgentToolSuccess,
  getAgentToolClock,
  isRecord,
} from "./agent-tool-types";

export type AgentTimeNowInput = {
  locale?: string;
  timeZone?: string;
};

export type AgentTimeNowResult = {
  date: string;
  iso: string;
  locale: string;
  localDateTime: string;
  localTime: string;
  timeZone: string;
  unixMs: number;
  weekday: string;
};

const defaultLocale = "zh-CN";
const defaultTimeZone = "Asia/Shanghai";

export const timeNowTool: AgentToolDefinition<unknown, AgentTimeNowResult> = {
  description:
    "返回当前时间、日期、星期和时区。用于回答用户关于当前时间或相对日期的问题。",
  id: "time.now",
  inputSchema: {
    locale: "string?",
    timeZone: "string?",
  },
  readOnly: true,
  risk: "low",
  run: runTimeNowTool,
};

export function runTimeNowTool(
  input: unknown = {},
  context?: AgentToolRunContext,
) {
  const clock = getAgentToolClock(context);
  const startedAt = clock();
  const parsedInput = parseTimeNowInput(input);

  if (!parsedInput.ok) {
    const finishedAt = clock();

    return createAgentToolFailure(
      "time.now",
      "INVALID_TOOL_INPUT",
      parsedInput.message,
      createAgentToolAudit(startedAt, finishedAt, "runtime"),
    );
  }

  const timeZone =
    parsedInput.data.timeZone ?? context?.timeZone ?? defaultTimeZone;
  const locale = parsedInput.data.locale ?? context?.locale ?? defaultLocale;
  const now = clock();

  try {
    const data = createAgentTimeNowResult(now, { locale, timeZone });
    const finishedAt = clock();

    return createAgentToolSuccess(
      "time.now",
      data,
      createAgentToolAudit(startedAt, finishedAt, "runtime"),
    );
  } catch {
    const finishedAt = clock();

    return createAgentToolFailure(
      "time.now",
      "INVALID_TOOL_INPUT",
      "无法使用指定 locale 或 timeZone 格式化当前时间。",
      createAgentToolAudit(startedAt, finishedAt, "runtime"),
    );
  }
}

export function createAgentTimeNowResult(
  now: Date,
  options: { locale?: string; timeZone?: string } = {},
): AgentTimeNowResult {
  const locale = options.locale ?? defaultLocale;
  const timeZone = options.timeZone ?? defaultTimeZone;
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(now);
  const year = readDatePart(dateParts, "year");
  const month = readDatePart(dateParts, "month");
  const day = readDatePart(dateParts, "day");
  const date = `${year}-${month}-${day}`;
  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
  }).format(now);
  const localTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(now);
  const localDateTime = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    weekday: "long",
    year: "numeric",
  }).format(now);

  return {
    date,
    iso: now.toISOString(),
    locale,
    localDateTime,
    localTime,
    timeZone,
    unixMs: now.getTime(),
    weekday,
  };
}

function parseTimeNowInput(
  input: unknown,
): { ok: true; data: AgentTimeNowInput } | { ok: false; message: string } {
  if (input === undefined || input === null) {
    return { ok: true, data: {} };
  }

  if (!isRecord(input)) {
    return { ok: false, message: "time.now 输入必须是对象。" };
  }

  const locale = readOptionalString(input.locale);
  const timeZone = readOptionalString(input.timeZone);

  return {
    ok: true,
    data: {
      locale,
      timeZone,
    },
  };
}

function readDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? "00";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
