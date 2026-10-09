import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { AdminMemberRpcRow } from "@/lib/admin-types";
import {
  createProviderSeedDefinitions,
  decideSeedSecretImport,
  hasServiceConfigEncryptionKey,
  type ProviderSeedDefinition,
} from "@/lib/admin-service-config-initialize";
import type {
  AdminServiceConfigAuditLog,
  AdminServiceConfigDetail,
  AdminServiceConfigInitializeItem,
  AdminServiceConfigInitializeResult,
  AdminServiceConfigItem,
  AdminServiceConfigTestResult,
  AdminServiceConfigTestRun,
  AdminServiceConfigVersion,
  AdminServiceSecretStatus,
  AdminServiceTestStatus,
  AdminServiceType,
} from "@/lib/admin-service-config-types";

export const adminServiceTypes: AdminServiceType[] = [
  "agent",
  "database",
  "llm",
  "map",
  "poi",
  "notification",
  "monitoring",
  "weather",
];

type MutationContext = {
  adminClient: SupabaseClient;
  member: AdminMemberRpcRow;
  request: NextRequest;
  user: User;
};

type ServiceConfigRow = {
  base_url: string | null;
  config: unknown;
  created_at: string;
  created_by: string | null;
  default_model: string | null;
  display_name: string;
  enabled: boolean;
  id: string;
  last_test_message: string | null;
  last_test_status: string | null;
  last_tested_at: string | null;
  masked_secret: string | null;
  provider_key: string;
  secret_fingerprint: string | null;
  secret_ref: string | null;
  secret_updated_at: string | null;
  service_type: string;
  updated_at: string;
  updated_by: string | null;
};

type SecretRow = {
  encrypted_secret: string;
};

type VersionRow = {
  change_reason: string | null;
  created_at: string;
  created_by: string | null;
  id: number;
  snapshot: unknown;
  version_no: number;
};

type TestRunRow = {
  checked_payload: unknown;
  created_at: string;
  created_by: string | null;
  id: number;
  message: string | null;
  status: "failed" | "success";
};

type AuditLogRow = {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  id: number;
  payload: unknown;
};

type ParsedConfigPatch = {
  apiKey?: string;
  changeReason: string | null;
  patch: Record<string, unknown>;
  touchedNonSecret: boolean;
};

type ProviderTestInput = {
  config: AdminServiceConfigItem;
  secret?: string;
};

const requestTimeoutMs = 10_000;
const sensitiveConfigKeyPattern =
  /(?:api[_-]?key|secret|token|password|credential|private[_-]?key)/i;

export function mapServiceConfigRow(
  row: ServiceConfigRow,
): AdminServiceConfigItem {
  const lastTestStatus = readTestStatus(row.last_test_status);
  const secretStatus = readSecretStatus(row.masked_secret, lastTestStatus);

  return {
    baseUrl: row.base_url ?? null,
    config: row.config ?? {},
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    defaultModel: row.default_model ?? null,
    displayName: row.display_name,
    enabled: row.enabled,
    id: row.id,
    lastTestMessage: row.last_test_message ?? null,
    lastTestStatus,
    lastTestedAt: row.last_tested_at ?? null,
    maskedSecret: row.masked_secret ?? null,
    providerKey: row.provider_key,
    secretFingerprint: row.secret_fingerprint ?? null,
    secretStatus,
    secretUpdatedAt: row.secret_updated_at ?? null,
    serviceType: readServiceType(row.service_type) ?? "llm",
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null,
  };
}

export function mapServiceConfigVersion(
  row: VersionRow,
): AdminServiceConfigVersion {
  return {
    changeReason: row.change_reason ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    id: row.id,
    snapshot: row.snapshot ?? {},
    versionNo: row.version_no,
  };
}

export function mapServiceConfigTestRun(
  row: TestRunRow,
): AdminServiceConfigTestRun {
  return {
    checkedPayload: row.checked_payload ?? {},
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    id: row.id,
    message: row.message ?? null,
    status: row.status,
  };
}

export function mapServiceConfigAuditLog(
  row: AuditLogRow,
): AdminServiceConfigAuditLog {
  return {
    action: row.action,
    actorUserId: row.actor_user_id ?? null,
    createdAt: row.created_at,
    id: row.id,
    payload: row.payload ?? {},
  };
}

export async function readServiceConfigs(
  client: SupabaseClient,
  serviceType: AdminServiceType | "all" = "all",
) {
  const baseQuery = client
    .schema("admin")
    .from("service_provider_configs")
    .select("*");
  const query = (
    serviceType === "all"
      ? baseQuery
      : baseQuery.eq("service_type", serviceType)
  )
    .order("service_type", { ascending: true })
    .order("updated_at", { ascending: false })
    .returns<ServiceConfigRow[]>();

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `读取服务配置失败：${error.message}` },
      { status: 500 },
    );
  }

  return {
    configs: (data ?? []).map(mapServiceConfigRow),
    generatedAt: new Date().toISOString(),
    serviceType,
    warnings: [],
  };
}

export async function readServiceConfigDetail(
  client: SupabaseClient,
  configId: string,
): Promise<AdminServiceConfigDetail | NextResponse> {
  const { data, error } = await client
    .schema("admin")
    .from("service_provider_configs")
    .select("*")
    .eq("id", configId)
    .maybeSingle<ServiceConfigRow>();

  if (error) {
    return NextResponse.json(
      { error: `读取服务配置失败：${error.message}` },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "没有找到这个服务配置。" },
      { status: 404 },
    );
  }

  const [versions, testRuns, auditLogs] = await Promise.all([
    readServiceConfigVersions(client, configId),
    readServiceConfigTestRuns(client, configId),
    readServiceConfigAuditLogs(client, configId),
  ]);

  return {
    ...mapServiceConfigRow(data),
    auditLogs,
    testRuns,
    versions,
  };
}

export async function readServiceConfigAuditLogs(
  client: SupabaseClient,
  configId: string,
): Promise<AdminServiceConfigAuditLog[]> {
  const { data, error } = await client
    .schema("admin")
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,payload,created_at")
    .eq("target_type", "service_provider_config")
    .eq("target_id", configId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<AuditLogRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapServiceConfigAuditLog);
}

export async function createServiceConfig(
  context: MutationContext,
  body: unknown,
) {
  if (context.member.role !== "owner") {
    return NextResponse.json(
      { error: "只有 owner 可以新增服务 provider。" },
      { status: 403 },
    );
  }

  const parsed = parseServiceConfigCreateInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const configId = randomUUID();

  const { data, error } = await context.adminClient
    .schema("admin")
    .from("service_provider_configs")
    .insert({
      ...parsed.value.patch,
      created_by: context.user.id,
      id: configId,
      updated_by: context.user.id,
    })
    .select("*")
    .single<ServiceConfigRow>();

  if (error) {
    return NextResponse.json(
      { error: `新增服务配置失败：${error.message}` },
      { status: 500 },
    );
  }

  if (parsed.value.apiKey) {
    const now = new Date().toISOString();
    const secretResult = await upsertEncryptedSecret(
      context.adminClient,
      data.id,
      parsed.value.apiKey,
      context.user.id,
    );

    if (!secretResult.ok) {
      return NextResponse.json({ error: secretResult.error }, { status: 500 });
    }

    const secretRef = buildSecretRef(data.id);
    const { error: refError } = await context.adminClient
      .schema("admin")
      .from("service_provider_configs")
      .update({
        ...createSecretMetadataPatch(parsed.value.apiKey, now),
        secret_ref: secretRef,
        updated_by: context.user.id,
      })
      .eq("id", data.id);

    if (refError) {
      return NextResponse.json(
        { error: `保存密钥引用失败：${refError.message}` },
        { status: 500 },
      );
    }
  }

  const detail = await readServiceConfigDetail(context.adminClient, data.id);

  if (detail instanceof NextResponse) {
    return detail;
  }

  try {
    await recordServiceConfigAuditLog(context, {
      action: "service_config.create",
      after: sanitizeConfigForAudit(detail),
      meta: { secretRotated: Boolean(parsed.value.apiKey) },
      targetId: configId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "写入后台审计日志失败。",
      },
      { status: 500 },
    );
  }

  await Promise.all([
    recordServiceConfigVersion(context.adminClient, {
      changeReason: parsed.value.changeReason,
      config: detail,
      userId: context.user.id,
    }),
  ]);

  return detail;
}

export async function updateServiceConfig(
  context: MutationContext,
  configId: string,
  body: unknown,
) {
  const before = await readRawServiceConfig(context.adminClient, configId);

  if (!before) {
    return NextResponse.json(
      { error: "没有找到这个服务配置。" },
      { status: 404 },
    );
  }

  const parsed = parseServiceConfigPatchInput(body, context.member);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch = { ...parsed.value.patch };

  if (parsed.value.apiKey) {
    Object.assign(patch, createSecretMetadataPatch(parsed.value.apiKey, now), {
      secret_ref: buildSecretRef(configId),
    });
  }

  if (parsed.value.touchedNonSecret || parsed.value.apiKey) {
    Object.assign(patch, {
      last_test_message: null,
      last_test_status: "untested",
      last_tested_at: null,
      updated_by: context.user.id,
    });
  }

  if (!parsed.value.touchedNonSecret && !parsed.value.apiKey) {
    return readServiceConfigDetail(context.adminClient, configId);
  }

  if (parsed.value.touchedNonSecret || parsed.value.apiKey) {
    try {
      await recordServiceConfigAuditLog(context, {
        action: parsed.value.apiKey
          ? "service_config.update_with_secret"
          : "service_config.update",
        after: sanitizePatchForAudit(patch),
        before: sanitizeConfigForAudit(mapServiceConfigRow(before)),
        meta: { secretRotated: Boolean(parsed.value.apiKey) },
        targetId: configId,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "写入后台审计日志失败。",
        },
        { status: 500 },
      );
    }
  }

  if (parsed.value.apiKey) {
    const secretResult = await upsertEncryptedSecret(
      context.adminClient,
      configId,
      parsed.value.apiKey,
      context.user.id,
    );

    if (!secretResult.ok) {
      return NextResponse.json({ error: secretResult.error }, { status: 500 });
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await context.adminClient
      .schema("admin")
      .from("service_provider_configs")
      .update(patch)
      .eq("id", configId);

    if (error) {
      return NextResponse.json(
        { error: `保存服务配置失败：${error.message}` },
        { status: 500 },
      );
    }
  }

  const detail = await readServiceConfigDetail(context.adminClient, configId);

  if (detail instanceof NextResponse) {
    return detail;
  }

  await Promise.all([
    recordServiceConfigVersion(context.adminClient, {
      changeReason: parsed.value.changeReason,
      config: detail,
      userId: context.user.id,
    }),
  ]);

  return detail;
}

export async function clearServiceConfigSecret(
  context: MutationContext,
  configId: string,
  body: unknown,
) {
  if (context.member.role !== "owner") {
    return NextResponse.json(
      { error: "只有 owner 可以清空服务密钥。" },
      { status: 403 },
    );
  }

  const before = await readRawServiceConfig(context.adminClient, configId);

  if (!before) {
    return NextResponse.json(
      { error: "没有找到这个服务配置。" },
      { status: 404 },
    );
  }

  const parsed = parseClearSecretInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!before.masked_secret && !before.secret_ref) {
    return readServiceConfigDetail(context.adminClient, configId);
  }

  try {
    await recordServiceConfigAuditLog(context, {
      action: "service_config.clear_secret",
      after: createEmptySecretMetadataPatch(),
      before: {
        maskedSecret: before.masked_secret,
        secretFingerprint: before.secret_fingerprint,
        secretUpdatedAt: before.secret_updated_at,
      },
      targetId: configId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "写入后台审计日志失败。",
      },
      { status: 500 },
    );
  }

  const { error: secretError } = await context.adminClient
    .schema("admin")
    .from("service_provider_secrets")
    .delete()
    .eq("config_id", configId);

  if (secretError) {
    return NextResponse.json(
      { error: `清空服务密钥失败：${secretError.message}` },
      { status: 500 },
    );
  }

  const { error: configError } = await context.adminClient
    .schema("admin")
    .from("service_provider_configs")
    .update({
      ...createEmptySecretMetadataPatch(),
      last_test_message: null,
      last_test_status: "untested",
      last_tested_at: null,
      updated_by: context.user.id,
    })
    .eq("id", configId);

  if (configError) {
    return NextResponse.json(
      { error: `清空服务密钥状态失败：${configError.message}` },
      { status: 500 },
    );
  }

  const detail = await readServiceConfigDetail(context.adminClient, configId);

  if (detail instanceof NextResponse) {
    return detail;
  }

  await Promise.all([
    recordServiceConfigVersion(context.adminClient, {
      changeReason: parsed.value.changeReason,
      config: detail,
      userId: context.user.id,
    }),
  ]);

  return detail;
}

export async function rotateServiceConfigSecret(
  context: MutationContext,
  configId: string,
  body: unknown,
) {
  if (context.member.role !== "owner") {
    return NextResponse.json(
      { error: "只有 owner 可以轮换服务密钥。" },
      { status: 403 },
    );
  }

  const before = await readRawServiceConfig(context.adminClient, configId);

  if (!before) {
    return NextResponse.json(
      { error: "没有找到这个服务配置。" },
      { status: 404 },
    );
  }

  const parsed = parseRotateSecretInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await recordServiceConfigAuditLog(context, {
      action: "service_config.rotate_secret",
      after: createSecretMetadataPatch(
        parsed.value.apiKey,
        new Date().toISOString(),
      ),
      before: {
        maskedSecret: before.masked_secret,
        secretFingerprint: before.secret_fingerprint,
        secretUpdatedAt: before.secret_updated_at,
      },
      targetId: configId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "写入后台审计日志失败。",
      },
      { status: 500 },
    );
  }

  const secretResult = await upsertEncryptedSecret(
    context.adminClient,
    configId,
    parsed.value.apiKey,
    context.user.id,
  );

  if (!secretResult.ok) {
    return NextResponse.json({ error: secretResult.error }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error } = await context.adminClient
    .schema("admin")
    .from("service_provider_configs")
    .update({
      ...createSecretMetadataPatch(parsed.value.apiKey, now),
      last_test_message: null,
      last_test_status: "untested",
      last_tested_at: null,
      secret_ref: buildSecretRef(configId),
      updated_by: context.user.id,
    })
    .eq("id", configId);

  if (error) {
    return NextResponse.json(
      { error: `轮换服务密钥失败：${error.message}` },
      { status: 500 },
    );
  }

  const detail = await readServiceConfigDetail(context.adminClient, configId);

  if (detail instanceof NextResponse) {
    return detail;
  }

  await Promise.all([
    recordServiceConfigVersion(context.adminClient, {
      changeReason: parsed.value.changeReason,
      config: detail,
      userId: context.user.id,
    }),
  ]);

  return detail;
}

export async function testServiceConfig(
  context: MutationContext,
  configId: string,
) {
  if (context.member.role !== "owner" && context.member.role !== "admin") {
    return NextResponse.json(
      { error: "只有 owner/admin 可以测试服务连接。" },
      { status: 403 },
    );
  }

  const detail = await readServiceConfigDetail(context.adminClient, configId);

  if (detail instanceof NextResponse) {
    return detail;
  }

  const secret = await readDecryptedSecret(context.adminClient, configId);
  const result =
    !secret.ok && detail.maskedSecret
      ? {
          checkedPayload: { mode: "secret_decrypt" },
          message: secret.error,
          status: "failed" as const,
        }
      : await runProviderConnectionTest({
          config: detail,
          secret: secret.ok ? secret.value : undefined,
        });
  const checkedPayload = createTestAuditPayload(detail, result);
  const testedAt = new Date().toISOString();

  const [{ error: configError }, { error: runError }] = await Promise.all([
    context.adminClient
      .schema("admin")
      .from("service_provider_configs")
      .update({
        last_test_message: result.message,
        last_test_status: result.status,
        last_tested_at: testedAt,
        updated_by: context.user.id,
      })
      .eq("id", configId),
    context.adminClient
      .schema("admin")
      .from("service_provider_test_runs")
      .insert({
        checked_payload: checkedPayload,
        config_id: configId,
        created_by: context.user.id,
        message: result.message,
        status: result.status,
      }),
  ]);

  if (configError || runError) {
    return NextResponse.json(
      {
        error: `保存测试结果失败：${configError?.message ?? runError?.message}`,
      },
      { status: 500 },
    );
  }

  await recordServiceConfigAuditLog(context, {
    action: "service_config.test",
    after: {
      lastTestMessage: result.message,
      lastTestStatus: result.status,
      lastTestedAt: testedAt,
    },
    meta: checkedPayload,
    targetId: configId,
  });

  const nextConfig = await readRawServiceConfig(context.adminClient, configId);

  if (!nextConfig) {
    return NextResponse.json(
      { error: "测试后未找到服务配置。" },
      { status: 404 },
    );
  }

  return {
    config: mapServiceConfigRow(nextConfig),
    message: result.message,
    status: result.status,
  } satisfies AdminServiceConfigTestResult;
}

export function normalizeServiceConfigId(value: string) {
  return decodeURIComponent(value).trim();
}

export function readServiceTypeFilter(
  value: string | null,
): AdminServiceType | "all" {
  if (!value || value === "all") {
    return "all";
  }

  return adminServiceTypes.includes(value as AdminServiceType)
    ? (value as AdminServiceType)
    : "all";
}

export async function initializeServiceProviderConfigs(
  context: MutationContext,
): Promise<AdminServiceConfigInitializeResult | NextResponse> {
  if (context.member.role !== "owner") {
    return NextResponse.json(
      { error: "只有 owner 可以初始化服务 provider。" },
      { status: 403 },
    );
  }

  const items: AdminServiceConfigInitializeItem[] = [];
  const providerSeedDefinitions = createProviderSeedDefinitions();

  for (const seed of providerSeedDefinitions) {
    let row = await readRawServiceConfigByProvider(
      context.adminClient,
      seed.serviceType,
      seed.providerKey,
    );
    let created = false;

    if (!row) {
      const { data, error } = await context.adminClient
        .schema("admin")
        .from("service_provider_configs")
        .insert({
          base_url: seed.baseUrl,
          config: cleanSeedConfig(seed.config),
          created_by: context.user.id,
          default_model: seed.defaultModel,
          display_name: seed.displayName,
          enabled: false,
          provider_key: seed.providerKey,
          service_type: seed.serviceType,
          updated_by: context.user.id,
        })
        .select("*")
        .single<ServiceConfigRow>();

      if (error) {
        return NextResponse.json(
          { error: `初始化 ${seed.displayName} 失败：${error.message}` },
          { status: 500 },
        );
      }

      row = data;
      created = true;

      try {
        await recordServiceConfigAuditLog(context, {
          action: "service_config.initialize_provider",
          after: sanitizeConfigForAudit(mapServiceConfigRow(row)),
          meta: {
            envNames: seed.envNames,
            providerKey: seed.providerKey,
            serviceType: seed.serviceType,
          },
          targetId: row.id,
        });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error ? error.message : "写入后台审计日志失败。",
          },
          { status: 500 },
        );
      }
    }

    const secretAction = await importMissingSeedSecret(context, row, seed);

    if (secretAction instanceof NextResponse) {
      return secretAction;
    }

    if (secretAction.nextRow) {
      row = secretAction.nextRow;
    }

    if (created || secretAction.action === "imported") {
      await recordServiceConfigVersion(context.adminClient, {
        changeReason: created
          ? "初始化服务 provider"
          : "从服务端环境变量导入缺失密钥",
        config: mapServiceConfigRow(row),
        userId: context.user.id,
      });
    }

    items.push({
      created,
      displayName: seed.displayName,
      envName: secretAction.envName,
      providerKey: seed.providerKey,
      secretAction: secretAction.action,
      serviceType: seed.serviceType,
    });
  }

  return {
    createdCount: items.filter((item) => item.created).length,
    generatedAt: new Date().toISOString(),
    importedSecretCount: items.filter(
      (item) => item.secretAction === "imported",
    ).length,
    items,
    missingEnvCount: items.filter((item) => item.secretAction === "missing_env")
      .length,
    skippedExistingCount: items.filter((item) => !item.created).length,
    skippedSecretCount: items.filter(
      (item) => item.secretAction === "skipped_existing",
    ).length,
  };
}

async function readRawServiceConfig(
  client: SupabaseClient,
  configId: string,
): Promise<ServiceConfigRow | undefined> {
  const { data, error } = await client
    .schema("admin")
    .from("service_provider_configs")
    .select("*")
    .eq("id", configId)
    .maybeSingle<ServiceConfigRow>();

  if (error || !data) {
    return undefined;
  }

  return data;
}

async function readRawServiceConfigByProvider(
  client: SupabaseClient,
  serviceType: AdminServiceType,
  providerKey: string,
): Promise<ServiceConfigRow | undefined> {
  const { data, error } = await client
    .schema("admin")
    .from("service_provider_configs")
    .select("*")
    .eq("service_type", serviceType)
    .eq("provider_key", providerKey)
    .maybeSingle<ServiceConfigRow>();

  if (error || !data) {
    return undefined;
  }

  return data;
}

async function importMissingSeedSecret(
  context: MutationContext,
  row: ServiceConfigRow,
  seed: ProviderSeedDefinition,
): Promise<
  | {
      action: AdminServiceConfigInitializeItem["secretAction"];
      envName: string | null;
      nextRow?: ServiceConfigRow;
    }
  | NextResponse
> {
  if (seed.envNames.length === 0) {
    return { action: "not_applicable", envName: null };
  }

  const existingSecret = await hasServiceConfigSecret(context.adminClient, row);

  if (!existingSecret.ok) {
    return NextResponse.json({ error: existingSecret.error }, { status: 500 });
  }

  const decision = decideSeedSecretImport({
    canEncrypt: hasServiceConfigEncryptionKey(),
    env: process.env,
    hasExistingSecret: existingSecret.hasSecret,
    seed,
  });

  if (decision.action !== "imported") {
    return { action: decision.action, envName: decision.envName };
  }

  const secretResult = await upsertEncryptedSecret(
    context.adminClient,
    row.id,
    decision.secret,
    context.user.id,
  );

  if (!secretResult.ok) {
    if (secretResult.error.includes("ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY")) {
      return { action: "encryption_key_missing", envName: decision.envName };
    }

    return NextResponse.json({ error: secretResult.error }, { status: 500 });
  }

  const now = new Date().toISOString();
  const secretPatch = {
    ...createSecretMetadataPatch(decision.secret, now),
    secret_ref: buildSecretRef(row.id),
    updated_by: context.user.id,
  };
  const { data, error } = await context.adminClient
    .schema("admin")
    .from("service_provider_configs")
    .update(secretPatch)
    .eq("id", row.id)
    .select("*")
    .single<ServiceConfigRow>();

  if (error) {
    return NextResponse.json(
      { error: `保存 ${seed.displayName} 密钥状态失败：${error.message}` },
      { status: 500 },
    );
  }

  try {
    await recordServiceConfigAuditLog(context, {
      action: "service_config.import_secret_from_env",
      after: sanitizePatchForAudit(secretPatch),
      meta: {
        envName: decision.envName,
        providerKey: seed.providerKey,
        serviceType: seed.serviceType,
      },
      targetId: row.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "写入后台审计日志失败。",
      },
      { status: 500 },
    );
  }

  return { action: "imported", envName: decision.envName, nextRow: data };
}

async function hasServiceConfigSecret(
  client: SupabaseClient,
  row: ServiceConfigRow,
): Promise<{ hasSecret: boolean; ok: true } | { error: string; ok: false }> {
  if (row.masked_secret || row.secret_ref) {
    return { hasSecret: true, ok: true };
  }

  const { data, error } = await client
    .schema("admin")
    .from("service_provider_secrets")
    .select("id")
    .eq("config_id", row.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    return { error: `检查已有密钥失败：${error.message}`, ok: false };
  }

  return { hasSecret: Boolean(data?.id), ok: true };
}

async function readServiceConfigVersions(
  client: SupabaseClient,
  configId: string,
): Promise<AdminServiceConfigVersion[]> {
  const { data, error } = await client
    .schema("admin")
    .from("service_provider_versions")
    .select("id,version_no,snapshot,change_reason,created_by,created_at")
    .eq("config_id", configId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<VersionRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapServiceConfigVersion);
}

async function readServiceConfigTestRuns(
  client: SupabaseClient,
  configId: string,
): Promise<AdminServiceConfigTestRun[]> {
  const { data, error } = await client
    .schema("admin")
    .from("service_provider_test_runs")
    .select("id,status,message,checked_payload,created_by,created_at")
    .eq("config_id", configId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<TestRunRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map(mapServiceConfigTestRun);
}

async function recordServiceConfigVersion(
  client: SupabaseClient,
  input: {
    changeReason: string | null;
    config: AdminServiceConfigItem;
    userId: string;
  },
) {
  const { data } = await client
    .schema("admin")
    .from("service_provider_versions")
    .select("version_no")
    .eq("config_id", input.config.id)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_no: number }>();
  const versionNo = (data?.version_no ?? 0) + 1;

  await client
    .schema("admin")
    .from("service_provider_versions")
    .insert({
      change_reason: input.changeReason,
      config_id: input.config.id,
      created_by: input.userId,
      snapshot: sanitizeConfigForAudit(input.config),
      version_no: versionNo,
    });
}

async function recordServiceConfigAuditLog(
  context: MutationContext,
  input: {
    action: string;
    after?: unknown;
    before?: unknown;
    meta?: unknown;
    targetId: string;
  },
) {
  const { error } = await context.adminClient
    .schema("admin")
    .from("admin_audit_logs")
    .insert({
      action: input.action,
      actor_user_id: context.user.id,
      ip: getRequestIp(context.request),
      payload: {
        after: input.after ?? null,
        before: input.before ?? null,
        meta: input.meta ?? null,
      },
      target_id: input.targetId,
      target_type: "service_provider_config",
      user_agent: context.request.headers.get("user-agent"),
    });

  if (error) {
    throw new Error(`写入后台审计日志失败：${error.message}`);
  }
}

async function upsertEncryptedSecret(
  client: SupabaseClient,
  configId: string,
  secret: string,
  userId: string,
): Promise<{ ok: true } | { error: string; ok: false }> {
  const encryptedSecret = encryptSecret(secret);

  if (!encryptedSecret.ok) {
    return encryptedSecret;
  }

  const { error } = await client
    .schema("admin")
    .from("service_provider_secrets")
    .upsert(
      {
        config_id: configId,
        encrypted_secret: encryptedSecret.value,
        encryption_version: 1,
        updated_by: userId,
      },
      { onConflict: "config_id" },
    );

  if (error) {
    return { error: `保存服务密钥失败：${error.message}`, ok: false };
  }

  return { ok: true };
}

async function readDecryptedSecret(
  client: SupabaseClient,
  configId: string,
): Promise<{ ok: true; value: string } | { error: string; ok: false }> {
  const { data, error } = await client
    .schema("admin")
    .from("service_provider_secrets")
    .select("encrypted_secret")
    .eq("config_id", configId)
    .maybeSingle<SecretRow>();

  if (error) {
    return { error: `读取服务密钥失败：${error.message}`, ok: false };
  }

  if (!data?.encrypted_secret) {
    return { error: "未配置服务密钥。", ok: false };
  }

  return decryptSecret(data.encrypted_secret);
}

function parseServiceConfigCreateInput(
  body: unknown,
): { ok: true; value: ParsedConfigPatch } | { error: string; ok: false } {
  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  const serviceType = readServiceType(body.serviceType);
  const providerKey = readProviderKey(body.providerKey);
  const displayName = readTrimmedString(body.displayName);

  if (!serviceType) {
    return { error: "服务类型不正确。", ok: false };
  }

  if (!providerKey) {
    return {
      error:
        "Provider key 不能为空，且只能包含字母、数字、点、下划线和短横线。",
      ok: false,
    };
  }

  if (!displayName) {
    return { error: "Provider 名称不能为空。", ok: false };
  }

  const patchResult = parseCommonPatch(body);

  if (!patchResult.ok) {
    return patchResult;
  }

  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") {
      return { error: "启用状态必须是布尔值。", ok: false };
    }

    patchResult.value.patch.enabled = body.enabled;
  }

  return {
    ok: true,
    value: {
      ...patchResult.value,
      patch: {
        ...patchResult.value.patch,
        display_name: displayName,
        provider_key: providerKey,
        service_type: serviceType,
      },
      touchedNonSecret: true,
    },
  };
}

function parseServiceConfigPatchInput(
  body: unknown,
  member: AdminMemberRpcRow,
): { ok: true; value: ParsedConfigPatch } | { error: string; ok: false } {
  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  if (
    member.role !== "owner" &&
    member.role !== "admin" &&
    hasAnyKey(body, [
      "baseUrl",
      "changeReason",
      "config",
      "defaultModel",
      "displayName",
      "enabled",
    ])
  ) {
    return { error: "只有 owner/admin 可以编辑服务配置。", ok: false };
  }

  if (member.role !== "owner" && "enabled" in body) {
    return { error: "只有 owner 可以启用或禁用 provider。", ok: false };
  }

  if (member.role !== "owner" && "apiKey" in body) {
    return { error: "只有 owner 可以写入或轮换密钥。", ok: false };
  }

  const patchResult = parseCommonPatch(body);

  if (!patchResult.ok) {
    return patchResult;
  }

  if ("displayName" in body) {
    const displayName = readTrimmedString(body.displayName);

    if (!displayName) {
      return { error: "Provider 名称不能为空。", ok: false };
    }

    patchResult.value.patch.display_name = displayName;
  }

  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") {
      return { error: "启用状态必须是布尔值。", ok: false };
    }

    patchResult.value.patch.enabled = body.enabled;
  }

  return {
    ok: true,
    value: {
      ...patchResult.value,
      touchedNonSecret:
        patchResult.value.touchedNonSecret ||
        patchResult.value.patch.display_name !== undefined ||
        patchResult.value.patch.enabled !== undefined,
    },
  };
}

function parseCommonPatch(
  body: Record<string, unknown>,
): { ok: true; value: ParsedConfigPatch } | { error: string; ok: false } {
  const patch: Record<string, unknown> = {};
  let touchedNonSecret = false;

  if ("baseUrl" in body) {
    const baseUrlResult = readNullableUrl(body.baseUrl);

    if (!baseUrlResult.ok) {
      return baseUrlResult;
    }

    patch.base_url = baseUrlResult.value;
    touchedNonSecret = true;
  }

  if ("defaultModel" in body) {
    patch.default_model = readNullableString(body.defaultModel);
    touchedNonSecret = true;
  }

  if ("config" in body) {
    const configResult = readConfigObject(body.config);

    if (!configResult.ok) {
      return configResult;
    }

    patch.config = configResult.value;
    touchedNonSecret = true;
  }

  const apiKey = "apiKey" in body ? readTrimmedString(body.apiKey) : undefined;

  if ("apiKey" in body && !apiKey) {
    return { error: "新 API Key 不能为空。", ok: false };
  }

  return {
    ok: true,
    value: {
      apiKey,
      changeReason: readNullableString(body.changeReason),
      patch,
      touchedNonSecret,
    },
  };
}

function parseRotateSecretInput(body: unknown):
  | {
      ok: true;
      value: { apiKey: string; changeReason: string | null };
    }
  | { error: string; ok: false } {
  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  const apiKey = readTrimmedString(body.apiKey);

  if (!apiKey) {
    return { error: "新 API Key 不能为空。", ok: false };
  }

  return {
    ok: true,
    value: {
      apiKey,
      changeReason: readNullableString(body.changeReason),
    },
  };
}

function parseClearSecretInput(
  body: unknown,
):
  | { ok: true; value: { changeReason: string | null } }
  | { error: string; ok: false } {
  if (body === undefined) {
    return { ok: true, value: { changeReason: null } };
  }

  if (!isRecord(body)) {
    return { error: "请求体必须是对象。", ok: false };
  }

  return {
    ok: true,
    value: {
      changeReason: readNullableString(body.changeReason),
    },
  };
}

async function runProviderConnectionTest(input: ProviderTestInput): Promise<{
  checkedPayload: Record<string, unknown>;
  message: string;
  status: "failed" | "success";
}> {
  try {
    if (input.config.serviceType === "llm") {
      return await testOpenAiCompatibleProvider(input);
    }

    if (
      input.config.serviceType === "map" &&
      isAmapProvider(input.config.providerKey)
    ) {
      return await testAmapProvider(input, "geocode");
    }

    if (
      input.config.serviceType === "poi" &&
      isAmapProvider(input.config.providerKey)
    ) {
      return await testAmapProvider(input, "place");
    }

    if (
      input.config.serviceType === "notification" &&
      input.config.providerKey.includes("telegram")
    ) {
      return await testTelegramProvider(input);
    }

    if (input.config.serviceType === "monitoring") {
      return await testMonitoringProvider(input);
    }

    if (!input.secret) {
      return {
        checkedPayload: { mode: "secret_presence" },
        message: "未配置密钥，无法完成连接测试。",
        status: "failed",
      };
    }

    return {
      checkedPayload: { mode: "secret_presence" },
      message: "已完成密钥存在性检查；这个 provider 暂未接入专用测试。",
      status: "success",
    };
  } catch (error) {
    return {
      checkedPayload: { mode: "unexpected_error" },
      message: error instanceof Error ? error.message : "测试连接失败。",
      status: "failed",
    };
  }
}

async function testOpenAiCompatibleProvider(input: ProviderTestInput) {
  if (!input.secret) {
    return {
      checkedPayload: { mode: "openai_compatible_models" },
      message: "未配置 LLM API Key。",
      status: "failed" as const,
    };
  }

  const baseUrl = normalizeBaseUrl(input.config.baseUrl);

  if (!baseUrl) {
    return {
      checkedPayload: { mode: "openai_compatible_models" },
      message: "LLM Provider 需要配置 API Base URL。",
      status: "failed" as const,
    };
  }

  const url = new URL("/models", baseUrl);
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${input.secret}` },
  });

  if (!response.ok) {
    return {
      checkedPayload: {
        httpStatus: response.status,
        mode: "openai_compatible_models",
      },
      message: `LLM /models 测试失败：HTTP ${response.status}`,
      status: "failed" as const,
    };
  }

  return {
    checkedPayload: {
      httpStatus: response.status,
      mode: "openai_compatible_models",
    },
    message: "LLM /models 测试通过。",
    status: "success" as const,
  };
}

async function testAmapProvider(
  input: ProviderTestInput,
  mode: "geocode" | "place",
) {
  if (!input.secret) {
    return {
      checkedPayload: { mode: `amap_${mode}` },
      message: "未配置高德 Web 服务 API Key。",
      status: "failed" as const,
    };
  }

  const baseUrl =
    normalizeBaseUrl(input.config.baseUrl) ?? "https://restapi.amap.com";
  const url = new URL(
    mode === "geocode" ? "/v3/geocode/geo" : "/v3/place/text",
    baseUrl,
  );

  if (mode === "geocode") {
    url.searchParams.set("address", "北京市");
  } else {
    url.searchParams.set("keywords", "公园");
    url.searchParams.set("city", "北京");
    url.searchParams.set("offset", "1");
    url.searchParams.set("page", "1");
  }

  url.searchParams.set("key", input.secret);
  const response = await fetchWithTimeout(url);
  const payload = await response.json().catch(() => undefined);
  const status = isRecord(payload) ? String(payload.status ?? "") : "";
  const info = isRecord(payload) ? String(payload.info ?? "") : "";

  if (!response.ok || status !== "1") {
    return {
      checkedPayload: {
        amapInfo: info || null,
        httpStatus: response.status,
        mode: `amap_${mode}`,
      },
      message: `高德连接测试失败：${info || `HTTP ${response.status}`}`,
      status: "failed" as const,
    };
  }

  return {
    checkedPayload: {
      amapInfo: info || null,
      httpStatus: response.status,
      mode: `amap_${mode}`,
    },
    message: "高德连接测试通过。",
    status: "success" as const,
  };
}

async function testTelegramProvider(input: ProviderTestInput) {
  if (!input.secret) {
    return {
      checkedPayload: { mode: "telegram_get_me" },
      message: "未配置 Telegram Bot Token。",
      status: "failed" as const,
    };
  }

  const response = await fetchWithTimeout(
    `https://api.telegram.org/bot${input.secret}/getMe`,
  );
  const payload = await response.json().catch(() => undefined);
  const ok = isRecord(payload) && payload.ok === true;

  if (!response.ok || !ok) {
    return {
      checkedPayload: { httpStatus: response.status, mode: "telegram_get_me" },
      message: `Telegram getMe 测试失败：HTTP ${response.status}`,
      status: "failed" as const,
    };
  }

  return {
    checkedPayload: { httpStatus: response.status, mode: "telegram_get_me" },
    message: "Telegram Bot 测试通过。",
    status: "success" as const,
  };
}

async function testMonitoringProvider(input: ProviderTestInput) {
  const config = isRecord(input.config.config) ? input.config.config : {};
  const hasDsn = Boolean(readTrimmedString(config.dsn));
  const hasProject = Boolean(
    readTrimmedString(config.projectSlug) || readTrimmedString(config.project),
  );

  if (!input.secret) {
    return {
      checkedPayload: {
        hasDsn,
        hasProject,
        mode: "monitoring_config_presence",
      },
      message:
        hasDsn || hasProject
          ? "监控配置存在性检查通过；Sentry API 测试等待接入 token。"
          : "请至少配置 Sentry DSN 或项目标识。",
      status: hasDsn || hasProject ? ("success" as const) : ("failed" as const),
    };
  }

  const baseUrl = normalizeBaseUrl(input.config.baseUrl) ?? "https://sentry.io";
  const response = await fetchWithTimeout(
    new URL("/api/0/organizations/", baseUrl),
    {
      headers: { Authorization: `Bearer ${input.secret}` },
    },
  );

  return {
    checkedPayload: {
      hasDsn,
      hasProject,
      httpStatus: response.status,
      mode: "sentry_organizations",
    },
    message: response.ok
      ? "Sentry API 测试通过。"
      : `Sentry API 测试失败：HTTP ${response.status}`,
    status: response.ok ? ("success" as const) : ("failed" as const),
  };
}

function createTestAuditPayload(
  config: AdminServiceConfigItem,
  result: { checkedPayload: Record<string, unknown> },
) {
  return {
    ...result.checkedPayload,
    providerKey: config.providerKey,
    serviceType: config.serviceType,
  };
}

function createSecretMetadataPatch(secret: string, now: string) {
  return {
    last_test_message: null,
    last_test_status: "untested",
    last_tested_at: null,
    masked_secret: maskSecret(secret),
    secret_fingerprint: fingerprintSecret(secret),
    secret_updated_at: now,
  };
}

function createEmptySecretMetadataPatch() {
  return {
    masked_secret: null,
    secret_fingerprint: null,
    secret_ref: null,
    secret_updated_at: null,
  };
}

function encryptSecret(
  secret: string,
): { ok: true; value: string } | { error: string; ok: false } {
  const key = readEncryptionKey();

  if (!key) {
    return {
      error:
        "服务端 ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY 未配置，不能写入或轮换密钥。",
      ok: false,
    };
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ok: true,
    value: [
      "v1",
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":"),
  };
}

function decryptSecret(
  value: string,
): { ok: true; value: string } | { error: string; ok: false } {
  const key = readEncryptionKey();

  if (!key) {
    return {
      error:
        "服务端 ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY 未配置，不能读取密钥进行测试。",
      ok: false,
    };
  }

  const [version, ivValue, tagValue, encryptedValue] = value.split(":");

  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    return { error: "密钥密文格式不正确。", ok: false };
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64")),
      decipher.final(),
    ]);

    return { ok: true, value: decrypted.toString("utf8") };
  } catch {
    return { error: "密钥解密失败，请检查服务端加密 key。", ok: false };
  }
}

function readEncryptionKey() {
  const raw =
    process.env.ADMIN_SERVICE_CONFIG_ENCRYPTION_KEY?.trim() ||
    process.env.SERVICE_CONFIG_ENCRYPTION_KEY?.trim();

  if (!raw) {
    return undefined;
  }

  return createHash("sha256").update(raw).digest();
}

function maskSecret(secret: string) {
  const trimmed = secret.trim();

  return trimmed.length > 4 ? `****${trimmed.slice(-4)}` : "****";
}

function fingerprintSecret(secret: string) {
  return `sha256:${createHash("sha256").update(secret).digest("hex").slice(0, 16)}`;
}

function buildSecretRef(configId: string) {
  return `admin.service_provider_secrets:${configId}`;
}

function sanitizeConfigForAudit(config: AdminServiceConfigItem) {
  return {
    baseUrl: config.baseUrl,
    config: config.config,
    defaultModel: config.defaultModel,
    displayName: config.displayName,
    enabled: config.enabled,
    id: config.id,
    lastTestMessage: config.lastTestMessage,
    lastTestStatus: config.lastTestStatus,
    maskedSecret: config.maskedSecret,
    providerKey: config.providerKey,
    secretFingerprint: config.secretFingerprint,
    serviceType: config.serviceType,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

function sanitizePatchForAudit(patch: Record<string, unknown>) {
  const result: Record<string, unknown> = {};

  if ("base_url" in patch) {
    result.baseUrl = patch.base_url;
  }

  if ("config" in patch) {
    result.config = patch.config;
  }

  if ("default_model" in patch) {
    result.defaultModel = patch.default_model;
  }

  if ("display_name" in patch) {
    result.displayName = patch.display_name;
  }

  if ("enabled" in patch) {
    result.enabled = patch.enabled;
  }

  if ("last_test_message" in patch) {
    result.lastTestMessage = patch.last_test_message;
  }

  if ("last_test_status" in patch) {
    result.lastTestStatus = patch.last_test_status;
  }

  if ("last_tested_at" in patch) {
    result.lastTestedAt = patch.last_tested_at;
  }

  if ("masked_secret" in patch) {
    result.maskedSecret = patch.masked_secret;
  }

  if ("provider_key" in patch) {
    result.providerKey = patch.provider_key;
  }

  if ("secret_fingerprint" in patch) {
    result.secretFingerprint = patch.secret_fingerprint;
  }

  if ("secret_updated_at" in patch) {
    result.secretUpdatedAt = patch.secret_updated_at;
  }

  if ("service_type" in patch) {
    result.serviceType = patch.service_type;
  }

  if ("updated_by" in patch) {
    result.updatedBy = patch.updated_by;
  }

  return result;
}

function readServiceType(value: unknown): AdminServiceType | undefined {
  return adminServiceTypes.includes(value as AdminServiceType)
    ? (value as AdminServiceType)
    : undefined;
}

function readProviderKey(value: unknown) {
  const text = readTrimmedString(value)?.toLowerCase();

  return text && /^[a-z0-9._-]{2,64}$/.test(text) ? text : undefined;
}

function readTestStatus(value: unknown): AdminServiceTestStatus {
  return value === "failed" || value === "success" || value === "untested"
    ? value
    : "untested";
}

function readSecretStatus(
  maskedSecret: string | null | undefined,
  testStatus: AdminServiceTestStatus,
): AdminServiceSecretStatus {
  if (!maskedSecret) {
    return "missing";
  }

  return testStatus === "failed" ? "test_failed" : "configured";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanSeedConfig(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, childValue]) => childValue !== undefined),
  );
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNullableUrl(
  value: unknown,
): { ok: true; value: string | null } | { error: string; ok: false } {
  const text = readNullableString(value);

  if (!text) {
    return { ok: true, value: null };
  }

  try {
    const url = new URL(text);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { error: "API Base URL 必须是 http(s) 地址。", ok: false };
    }

    return { ok: true, value: url.toString().replace(/\/$/, "") };
  } catch {
    return { error: "API Base URL 格式不正确。", ok: false };
  }
}

function readConfigObject(
  value: unknown,
): { ok: true; value: Record<string, unknown> } | { error: string; ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(value)) {
    return { error: "非敏感 JSON 配置必须是对象。", ok: false };
  }

  if (containsSensitiveConfigKey(value)) {
    return {
      error:
        "非敏感 JSON 配置中不能包含 apiKey、secret、token、password 等敏感字段。",
      ok: false,
    };
  }

  return { ok: true, value };
}

function containsSensitiveConfigKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSensitiveConfigKey);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, childValue]) =>
      sensitiveConfigKeyPattern.test(key) ||
      containsSensitiveConfigKey(childValue),
  );
}

function normalizeBaseUrl(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value.endsWith("/") ? value : `${value}/`).toString();
  } catch {
    return undefined;
  }
}

function isAmapProvider(providerKey: string) {
  return providerKey.includes("amap") || providerKey.includes("gaode");
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function hasAnyKey(value: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => key in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const value = forwardedFor?.split(",")[0]?.trim();

  return value && /^[0-9a-f:.]+$/i.test(value) ? value : null;
}
