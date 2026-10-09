import * as Sentry from "npm:@sentry/deno";

type ServerLogLevel = "debug" | "error" | "info" | "warn";

type ServerLogContext = Record<string, unknown>;

type SanitizedLogValue =
  | null
  | string
  | number
  | boolean
  | SanitizedLogValue[]
  | { [key: string]: SanitizedLogValue | undefined }
  | undefined;

type SanitizedLogContext = Record<string, SanitizedLogValue>;

type ServerLogInput = {
  context?: ServerLogContext;
  error?: unknown;
  event: string;
  level?: ServerLogLevel;
  message?: string;
  scope: string;
};

type EdgeHandler = (request: Request) => Response | Promise<Response>;

const redactedKeyPattern = /authorization|cookie|key|password|secret|token/i;

let sentryInitialized = false;

function getEnv(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

function normalizeEnvironment(): string {
  return getEnv("SENTRY_ENVIRONMENT") ?? getEnv("DENO_DEPLOYMENT_ID") ?? "production";
}

function isLogObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeContextValue(
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
    return value.length > 2_000 ? `${value.slice(0, 2_000)}...<trimmed>` : value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Error) {
    return {
      message: "Error captured",
      name: value.name,
      stack: value.stack,
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

function sanitizeContext(
  context: ServerLogContext | undefined,
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

function toSentryLevel(level: ServerLogLevel): Sentry.SeverityLevel {
  return level === "warn" ? "warning" : level;
}

function getCaptureException(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

export function initializeServerSentry(): void {
  if (sentryInitialized) {
    return;
  }

  sentryInitialized = true;
  const dsn = getEnv("SENTRY_DSN");

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: normalizeEnvironment(),
    release: getEnv("SENTRY_RELEASE"),
    tracesSampleRate: 0.1,
  });
}

export function logServerDiagnosticEvent(input: ServerLogInput): void {
  initializeServerSentry();

  const { context, error, event, level = "info", message = event, scope } = input;

  if (level === "debug" && normalizeEnvironment() === "production") {
    return;
  }

  const sanitizedContext = sanitizeContext(context);
  const sentryLevel = toSentryLevel(level);

  Sentry.addBreadcrumb({
    category: scope,
    data: {
      ...(sanitizedContext ?? {}),
      event,
    },
    level: sentryLevel,
    message,
  });

  if (level !== "error") {
    return;
  }

  Sentry.withScope((sentryScope) => {
    sentryScope.setLevel("error");
    sentryScope.setTag("event", event);
    sentryScope.setTag("scope", scope);
    sentryScope.setContext("waylog", {
      ...(sanitizedContext ?? {}),
      event,
      scope,
    });
    Sentry.captureException(getCaptureException(error, message));
  });
}

export function createServerLogger(scope: string) {
  return {
    debug(event: string, context?: ServerLogContext, message?: string) {
      logServerDiagnosticEvent({ context, event, level: "debug", message, scope });
    },
    error(
      event: string,
      error?: unknown,
      context?: ServerLogContext,
      message?: string,
    ) {
      logServerDiagnosticEvent({
        context,
        error,
        event,
        level: "error",
        message,
        scope,
      });
    },
    info(event: string, context?: ServerLogContext, message?: string) {
      logServerDiagnosticEvent({ context, event, level: "info", message, scope });
    },
    warn(event: string, context?: ServerLogContext, message?: string) {
      logServerDiagnosticEvent({ context, event, level: "warn", message, scope });
    },
  };
}

export function withSentry(handler: EdgeHandler, scope: string): EdgeHandler {
  return async (request) => {
    initializeServerSentry();

    try {
      return await handler(request);
    } catch (error) {
      logServerDiagnosticEvent({
        context: {
          method: request.method,
          url: request.url,
        },
        error,
        event: "unhandled_edge_function_error",
        level: "error",
        message: "Unhandled Edge Function error.",
        scope,
      });

      throw error;
    }
  };
}
