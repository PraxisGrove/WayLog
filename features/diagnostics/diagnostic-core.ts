export type DiagnosticLogLevel = "debug" | "error" | "info" | "warn";

export type DiagnosticLogContext = Record<string, unknown>;

export type SanitizedLogValue =
  | null
  | string
  | number
  | boolean
  | SanitizedLogValue[]
  | { [key: string]: SanitizedLogValue | undefined }
  | undefined;

export type SanitizedLogContext = Record<string, SanitizedLogValue>;

export type DiagnosticLogEntry = {
  context?: SanitizedLogContext;
  event: string;
  level: DiagnosticLogLevel;
  message: string;
  scope: string;
  timestamp: string;
};

export type DiagnosticBundle = {
  appVersion?: string;
  entries: DiagnosticLogEntry[];
  environment: string;
  generatedAt: string;
  platform: string;
  release?: string;
};

const DIAGNOSTIC_BUNDLE_TEXT_MAX_CHARS = 60_000;
const redactedKeyPattern = /authorization|cookie|key|password|secret|token/i;

export function isLogObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeContextValue(
  value: unknown,
  seen = new WeakSet<object>(),
): SanitizedLogValue {
  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 2_000
      ? `${value.slice(0, 2_000)}...<trimmed>`
      : value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Error) {
    return {
      message: "Error captured",
      name: value.name,
      stack: value.stack
        ? value.stack.length > 2_000
          ? `${value.stack.slice(0, 2_000)}...<trimmed>`
          : value.stack
        : undefined,
    };
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContextValue(item, seen));
  }

  if (isLogObject(value)) {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);

    const sanitized: SanitizedLogContext = {};

    for (const key in value) {
      sanitized[key] = redactedKeyPattern.test(key)
        ? "[redacted]"
        : sanitizeContextValue(value[key], seen);
    }

    return sanitized;
  }

  return String(value);
}

export function sanitizeContext(
  context: DiagnosticLogContext | undefined,
): SanitizedLogContext | undefined {
  if (!context) {
    return undefined;
  }

  const sanitized: SanitizedLogContext = {};

  for (const key in context) {
    sanitized[key] = redactedKeyPattern.test(key)
      ? "[redacted]"
      : sanitizeContextValue(context[key]);
  }

  return sanitized;
}

export function extractError(value: unknown): Error | undefined {
  if (value instanceof Error) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractError).find(Boolean);
  }

  if (isLogObject(value)) {
    for (const key in value) {
      const nestedError = extractError(value[key]);

      if (nestedError) {
        return nestedError;
      }
    }
  }

  return undefined;
}

export function appendDiagnosticEntry(
  entries: DiagnosticLogEntry[],
  entry: DiagnosticLogEntry,
  limit: number,
): DiagnosticLogEntry[] {
  const nextEntries = [...entries, entry];

  return nextEntries.length <= limit ? nextEntries : nextEntries.slice(-limit);
}

export function formatDiagnosticBundleText(bundle: DiagnosticBundle): string {
  const headerLines = [
    "WayLog diagnostic context",
    `generatedAt=${bundle.generatedAt}`,
    `environment=${bundle.environment}`,
    `platform=${bundle.platform}`,
    bundle.release ? `release=${bundle.release}` : undefined,
    bundle.appVersion ? `appVersion=${bundle.appVersion}` : undefined,
    `entryCount=${bundle.entries.length}`,
    "",
  ].filter((line): line is string => Boolean(line));

  const entryLines = bundle.entries.map((entry) => {
    const context = entry.context
      ? `\n${JSON.stringify(entry.context, null, 2)}`
      : "";

    return [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      `[${entry.scope}]`,
      `[${entry.event}]`,
      entry.message,
      context,
    ].join(" ");
  });

  const text = [...headerLines, ...entryLines].join("\n");

  return text.length <= DIAGNOSTIC_BUNDLE_TEXT_MAX_CHARS
    ? text
    : `${text.slice(0, DIAGNOSTIC_BUNDLE_TEXT_MAX_CHARS)}\n...<trimmed>`;
}
