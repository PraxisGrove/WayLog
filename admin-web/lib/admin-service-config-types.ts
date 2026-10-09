export type AdminServiceType =
  | "agent"
  | "database"
  | "llm"
  | "map"
  | "monitoring"
  | "notification"
  | "poi"
  | "weather";

export type AdminServiceTestStatus = "failed" | "success" | "untested";

export type AdminServiceSecretStatus = "configured" | "missing" | "test_failed";

export type AdminServiceConfigAuditLog = {
  action: string;
  actorUserId: string | null;
  createdAt: string;
  id: number;
  payload: unknown;
};

export type AdminServiceConfigVersion = {
  changeReason: string | null;
  createdAt: string;
  createdBy: string | null;
  id: number;
  snapshot: unknown;
  versionNo: number;
};

export type AdminServiceConfigTestRun = {
  checkedPayload: unknown;
  createdAt: string;
  createdBy: string | null;
  id: number;
  message: string | null;
  status: Exclude<AdminServiceTestStatus, "untested">;
};

export type AdminServiceConfigItem = {
  baseUrl: string | null;
  config: unknown;
  createdAt: string;
  createdBy: string | null;
  defaultModel: string | null;
  displayName: string;
  enabled: boolean;
  id: string;
  lastTestMessage: string | null;
  lastTestStatus: AdminServiceTestStatus;
  lastTestedAt: string | null;
  maskedSecret: string | null;
  providerKey: string;
  secretFingerprint: string | null;
  secretStatus: AdminServiceSecretStatus;
  secretUpdatedAt: string | null;
  serviceType: AdminServiceType;
  updatedAt: string;
  updatedBy: string | null;
};

export type AdminServiceConfigListData = {
  configs: AdminServiceConfigItem[];
  generatedAt: string;
  serviceType: AdminServiceType | "all";
  warnings: string[];
};

export type AdminServiceConfigDetail = AdminServiceConfigItem & {
  auditLogs: AdminServiceConfigAuditLog[];
  testRuns: AdminServiceConfigTestRun[];
  versions: AdminServiceConfigVersion[];
};

export type AdminServiceConfigListOptions = {
  serviceType?: AdminServiceType | "all";
};

export type AdminServiceConfigUpsertInput = {
  apiKey?: string | null;
  baseUrl?: string | null;
  changeReason?: string | null;
  config?: unknown;
  defaultModel?: string | null;
  displayName?: string;
  enabled?: boolean;
  providerKey?: string;
  serviceType?: AdminServiceType;
};

export type AdminServiceConfigRotateSecretInput = {
  apiKey: string;
  changeReason?: string | null;
};

export type AdminServiceConfigClearSecretInput = {
  changeReason?: string | null;
};

export type AdminServiceConfigTestResult = {
  config: AdminServiceConfigItem;
  message: string;
  status: Exclude<AdminServiceTestStatus, "untested">;
};

export type AdminServiceConfigInitializeItem = {
  created: boolean;
  displayName: string;
  envName: string | null;
  providerKey: string;
  secretAction:
    | "imported"
    | "encryption_key_missing"
    | "missing_env"
    | "not_applicable"
    | "skipped_existing";
  serviceType: AdminServiceType;
};

export type AdminServiceConfigInitializeResult = {
  createdCount: number;
  generatedAt: string;
  importedSecretCount: number;
  items: AdminServiceConfigInitializeItem[];
  missingEnvCount: number;
  skippedExistingCount: number;
  skippedSecretCount: number;
};
