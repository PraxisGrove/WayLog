import type { CurrentAuthUser } from "../auth/types";
import {
  appendDiagnosticEntry,
  type DiagnosticBundle,
  type DiagnosticLogContext,
  type DiagnosticLogEntry,
  type DiagnosticLogLevel,
  extractError,
  formatDiagnosticBundleText,
  sanitizeContext,
} from "./diagnostic-core";

export type AppLogLevel = DiagnosticLogLevel;

export type AppLogContext = DiagnosticLogContext;

type DiagnosticLogInput = {
  context?: AppLogContext;
  event: string;
  level?: AppLogLevel;
  message?: string;
  scope: string;
};

const SENTRY_TRACES_SAMPLE_RATE = 0.1;
const SENTRY_PROFILES_SAMPLE_RATE = 0.1;
const DIAGNOSTIC_RING_BUFFER_LIMIT = 80;
const DIAGNOSTIC_RING_BUFFER_STORAGE_KEY = "waylog.diagnostics.ring-buffer.v1";
const DIAGNOSTIC_RING_BUFFER_PERSIST_DELAY_MS = 750;

type SentrySeverityLevel =
  | "debug"
  | "error"
  | "fatal"
  | "info"
  | "log"
  | "warning";

type SentryClient = {
  addBreadcrumb(input: {
    category?: string;
    data?: Record<string, unknown>;
    level?: SentrySeverityLevel;
    message?: string;
  }): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
  init(options: Record<string, unknown>): void;
  setUser(user: { id?: string; username?: string } | null): void;
};

type DiagnosticStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type RuntimeMetadata = {
  appVersion?: string;
  platform: string;
  release?: string;
};

let sentryInitialized = false;
let sentryClientPromise: Promise<SentryClient | null> | null = null;
let sentryInitPromise: Promise<SentryClient | null> | null = null;
let diagnosticStoragePromise: Promise<DiagnosticStorage | null> | null = null;
let runtimeMetadataPromise: Promise<RuntimeMetadata> | null = null;
let runtimeMetadata: RuntimeMetadata = {
  platform: "unknown",
};
let runtimeExtra: Record<string, unknown> | undefined;
let diagnosticRingBuffer: DiagnosticLogEntry[] = [];
let diagnosticRingBufferLoadPromise: Promise<void> | null = null;
let diagnosticRingBufferPersistTimer: ReturnType<typeof setTimeout> | null =
  null;

function getSentryDsn(): string | undefined {
  const extra = getCachedExpoExtra();
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? extra?.sentryDsn;

  return typeof dsn === "string" && dsn.trim() ? dsn.trim() : undefined;
}

function getAppEnvironment(): string {
  const extra = getCachedExpoExtra();
  const environment =
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? extra?.sentryEnvironment;

  if (typeof environment === "string" && environment.trim()) {
    return environment.trim();
  }

  return isDevelopmentRuntime() ? "development" : "production";
}

function toSentryLevel(level: AppLogLevel): SentrySeverityLevel {
  return level === "warn" ? "warning" : level;
}

function isDevelopmentRuntime(): boolean {
  return typeof __DEV__ === "boolean"
    ? __DEV__
    : process.env.NODE_ENV !== "production";
}

function getCaptureException(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function getCachedExpoExtra(): Record<string, unknown> | undefined {
  return runtimeExtra;
}

async function loadRuntimeMetadata(): Promise<RuntimeMetadata> {
  if (!runtimeMetadataPromise) {
    runtimeMetadataPromise = (async () => {
      const [constantsModule, platformModule] = await Promise.all([
        import("expo-constants").catch(() => null),
        import("react-native").catch(() => null),
      ]);
      const constants = constantsModule?.default as
        | {
            expoConfig?: {
              extra?: Record<string, unknown>;
              version?: string;
            };
            platform?: {
              android?: { versionCode?: number | string };
              ios?: { buildNumber?: string };
            };
          }
        | undefined;
      const platform = platformModule?.Platform as
        | {
            OS?: string;
          }
        | undefined;
      const platformOS = platform?.OS ?? "unknown";
      const version = constants?.expoConfig?.version;
      runtimeExtra = constants?.expoConfig?.extra;
      const buildNumber =
        platformOS === "android"
          ? constants?.platform?.android?.versionCode?.toString()
          : platformOS === "ios"
            ? constants?.platform?.ios?.buildNumber
            : undefined;

      runtimeMetadata = {
        appVersion: version,
        platform: platformOS,
        release:
          version && buildNumber
            ? `waylog@${version}+${buildNumber}`
            : version
              ? `waylog@${version}`
              : undefined,
      };

      return runtimeMetadata;
    })();
  }

  return runtimeMetadataPromise;
}

async function loadDiagnosticStorage(): Promise<DiagnosticStorage | null> {
  if (!diagnosticStoragePromise) {
    diagnosticStoragePromise = import(
      "@react-native-async-storage/async-storage"
    )
      .then((module) => {
        const candidate = (module.default ?? module) as unknown;

        return typeof candidate === "object" &&
          candidate !== null &&
          "getItem" in candidate &&
          "setItem" in candidate
          ? (candidate as DiagnosticStorage)
          : null;
      })
      .catch(() => null);
  }

  return diagnosticStoragePromise;
}

async function loadSentryClient(): Promise<SentryClient | null> {
  if (!sentryClientPromise) {
    sentryClientPromise = import("@sentry/react-native")
      .then((module) => module as unknown as SentryClient)
      .catch(() => null);
  }

  return sentryClientPromise;
}

async function initializeSentryClient(): Promise<SentryClient | null> {
  if (!sentryInitPromise) {
    sentryInitPromise = (async () => {
      const metadata = await loadRuntimeMetadata();
      const dsn = getSentryDsn();

      if (!dsn) {
        return null;
      }

      const client = await loadSentryClient();

      if (!client) {
        return null;
      }

      client.init({
        dsn,
        enableNative: metadata.platform !== "web",
        environment: getAppEnvironment(),
        profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
        release: metadata.release,
        tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
      });

      return client;
    })();
  }

  return sentryInitPromise;
}

function withSentryClient(callback: (client: SentryClient) => void): void {
  void initializeSentryClient().then((client) => {
    if (client) {
      callback(client);
    }
  });
}

function normalizeStoredEntry(value: unknown): DiagnosticLogEntry | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;

  if (
    typeof source.event !== "string" ||
    typeof source.message !== "string" ||
    typeof source.scope !== "string" ||
    typeof source.timestamp !== "string"
  ) {
    return undefined;
  }

  if (
    source.level !== "debug" &&
    source.level !== "error" &&
    source.level !== "info" &&
    source.level !== "warn"
  ) {
    return undefined;
  }

  return {
    context: sanitizeContext(
      typeof source.context === "object" &&
        source.context !== null &&
        !Array.isArray(source.context)
        ? (source.context as AppLogContext)
        : undefined,
    ),
    event: source.event,
    level: source.level,
    message: source.message,
    scope: source.scope,
    timestamp: source.timestamp,
  };
}

function trimDiagnosticRingBuffer(entries: DiagnosticLogEntry[]) {
  return entries.slice(-DIAGNOSTIC_RING_BUFFER_LIMIT);
}

function loadDiagnosticRingBuffer(): Promise<void> {
  if (!diagnosticRingBufferLoadPromise) {
    diagnosticRingBufferLoadPromise = (async () => {
      try {
        const storage = await loadDiagnosticStorage();

        if (!storage) {
          return;
        }

        const rawStore = await storage.getItem(
          DIAGNOSTIC_RING_BUFFER_STORAGE_KEY,
        );

        if (!rawStore) {
          return;
        }

        const source = JSON.parse(rawStore) as {
          entries?: unknown;
        };
        const loadedEntries = Array.isArray(source.entries)
          ? source.entries
              .map(normalizeStoredEntry)
              .filter((entry): entry is DiagnosticLogEntry => Boolean(entry))
          : [];

        diagnosticRingBuffer = trimDiagnosticRingBuffer([
          ...loadedEntries,
          ...diagnosticRingBuffer,
        ]);
      } catch {
        diagnosticRingBuffer = trimDiagnosticRingBuffer(diagnosticRingBuffer);
      }
    })();
  }

  return diagnosticRingBufferLoadPromise;
}

function schedulePersistDiagnosticRingBuffer(): void {
  if (diagnosticRingBufferPersistTimer) {
    return;
  }

  diagnosticRingBufferPersistTimer = setTimeout(() => {
    diagnosticRingBufferPersistTimer = null;
    void persistDiagnosticRingBuffer();
  }, DIAGNOSTIC_RING_BUFFER_PERSIST_DELAY_MS);
}

async function persistDiagnosticRingBuffer(): Promise<void> {
  await loadDiagnosticRingBuffer();
  const storage = await loadDiagnosticStorage();

  if (!storage) {
    return;
  }

  await storage
    .setItem(
      DIAGNOSTIC_RING_BUFFER_STORAGE_KEY,
      JSON.stringify({
        entries: diagnosticRingBuffer,
        version: 1,
      }),
    )
    .catch(() => {
      // 诊断日志不能影响主流程，持久化失败时只保留内存缓冲。
    });
}

export function initializePersistentAppLogger(): void {
  if (sentryInitialized) {
    void loadDiagnosticRingBuffer();
    return;
  }

  sentryInitialized = true;

  void loadRuntimeMetadata();
  void initializeSentryClient();
  void loadDiagnosticRingBuffer();
}

export function logDiagnosticEvent(input: DiagnosticLogInput): void {
  initializePersistentAppLogger();

  const { context, event, level = "info", message = event, scope } = input;

  if (level === "debug" && !isDevelopmentRuntime()) {
    return;
  }

  const sanitizedContext = sanitizeContext(context);
  const entry: DiagnosticLogEntry = {
    context: sanitizedContext,
    event,
    level,
    message,
    scope,
    timestamp: new Date().toISOString(),
  };
  const sentryLevel = toSentryLevel(level);
  const originalError = extractError(context);

  diagnosticRingBuffer = appendDiagnosticEntry(
    diagnosticRingBuffer,
    entry,
    DIAGNOSTIC_RING_BUFFER_LIMIT,
  );
  schedulePersistDiagnosticRingBuffer();

  withSentryClient((client) => {
    client.addBreadcrumb({
      category: scope,
      data: {
        ...(sanitizedContext ?? {}),
        event,
      },
      level: sentryLevel,
      message,
    });

    if (level === "error") {
      const captureContext = {
        contexts: {
          waylog: {
            ...(sanitizedContext ?? {}),
            event,
            scope,
          },
        },
        level: "error" as const,
        tags: {
          event,
          scope,
        },
      };
      client.captureException(
        getCaptureException(originalError, message),
        captureContext,
      );
    }
  });
}

export function configureDiagnosticUser(
  currentUser: CurrentAuthUser | null | undefined,
): void {
  initializePersistentAppLogger();

  if (!currentUser) {
    withSentryClient((client) => client.setUser(null));
    return;
  }

  withSentryClient((client) =>
    client.setUser({
      id: currentUser.user.id,
      username: currentUser.user.displayName,
    }),
  );
}

export function getDiagnosticBundle(): DiagnosticBundle {
  return {
    appVersion: runtimeMetadata.appVersion,
    entries: [...diagnosticRingBuffer],
    environment: getAppEnvironment(),
    generatedAt: new Date().toISOString(),
    platform: runtimeMetadata.platform,
    release: runtimeMetadata.release,
  };
}

export function getDiagnosticBundleText(): string {
  return formatDiagnosticBundleText(getDiagnosticBundle());
}

export async function getDiagnosticBundleAsync(): Promise<DiagnosticBundle> {
  await loadRuntimeMetadata();
  await loadDiagnosticRingBuffer();
  return getDiagnosticBundle();
}

export async function getDiagnosticBundleTextAsync(): Promise<string> {
  return formatDiagnosticBundleText(await getDiagnosticBundleAsync());
}

export function clearDiagnosticRingBufferForTests(): void {
  diagnosticRingBuffer = [];
  diagnosticRingBufferLoadPromise = null;
  sentryInitPromise = null;

  if (diagnosticRingBufferPersistTimer) {
    clearTimeout(diagnosticRingBufferPersistTimer);
    diagnosticRingBufferPersistTimer = null;
  }
}

export function createDiagnosticLogger(scope: string) {
  return {
    debug(event: string, context?: AppLogContext, message?: string) {
      logDiagnosticEvent({ context, event, level: "debug", message, scope });
    },
    error(event: string, context?: AppLogContext, message?: string) {
      logDiagnosticEvent({ context, event, level: "error", message, scope });
    },
    info(event: string, context?: AppLogContext, message?: string) {
      logDiagnosticEvent({ context, event, level: "info", message, scope });
    },
    warn(event: string, context?: AppLogContext, message?: string) {
      logDiagnosticEvent({ context, event, level: "warn", message, scope });
    },
  };
}
