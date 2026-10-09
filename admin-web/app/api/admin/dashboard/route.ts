import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type {
  AdminDashboardBusinessGroup,
  AdminDashboardCrashItem,
  AdminDashboardData,
  AdminDashboardFeedbackItem,
  AdminDashboardFoundation,
  AdminDashboardHealthItem,
  AdminDashboardHealthSignal,
  AdminDashboardKpi,
  AdminDashboardCostOverview,
  AdminDashboardPriorityItem,
  AdminDashboardQueueItem,
  AdminDashboardScaleItem,
  AdminDashboardStatusSummary,
  AdminDashboardSystemOverview,
  AdminDashboardTrend,
  AdminDashboardTrendPoint,
  DashboardKpiKey,
  DashboardSeverity,
  DashboardTone,
} from "@/lib/admin-dashboard-types";
import { authorizeAdminRequest } from "@/lib/admin-server";
import type { AdminMemberRpcRow } from "@/lib/admin-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CountOptions = {
  dateColumn?: string;
  from?: Date;
  label: string;
  notDeletedColumn?: string;
  table: string;
  to?: Date;
};

type CounterSnapshot = {
  current: number;
  previous: number;
  total: number;
};

type DailyTrendOptions = {
  dateColumn: string;
  label: string;
  notDeletedColumn?: string;
  table: string;
};

type DatabaseTelemetry = {
  activeConnections: number;
  cacheHitRatio: number | null;
  dailyAverageTransactions: number;
  idleConnections: number;
  sizeBytes: number;
  sizeLabel: string;
  storageLimitBytes: number;
  storageUsagePercent: number;
  totalConnections: number;
  totalTransactions: number;
  uptimeSeconds: number;
};

type SqlResultRow = Record<string, string | null>;

type PoiReviewCounts = {
  confirmed: number;
  ignored: number;
  merged: number;
  needsFix: number;
  pending: number;
};

const oneDayMs = 24 * 60 * 60 * 1000;
const supabaseFreeLimits = {
  databaseStorageBytes: 500 * 1024 * 1024,
  edgeFunctions: 500_000,
  monthlyActiveUsers: 50_000,
  storageGb: 1,
};
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric",
});
const dayLabelFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Shanghai",
});

export async function GET(request: NextRequest) {
  const authorized = await authorizeAdminRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const data = await buildDashboardData({
    adminClient: authorized.context.adminClient,
    member: authorized.context.member,
    userEmail: authorized.context.user.email ?? null,
  });

  return NextResponse.json(data);
}

async function buildDashboardData({
  adminClient,
  member,
  userEmail,
}: {
  adminClient: SupabaseClient;
  member: AdminMemberRpcRow;
  userEmail: string | null;
}): Promise<AdminDashboardData> {
  const now = new Date();
  const currentStart = new Date(now.getTime() - oneDayMs);
  const previousStart = new Date(now.getTime() - 2 * oneDayMs);
  const warnings: string[] = [];

  const [
    profiles,
    trips,
    favoritePlaces,
    agentCalls,
    feedback,
    crashes,
    poiCache,
    poiReview,
    profileTrend,
    tripTrend,
    agentTrend,
    feedbackTrend,
    crashTrend,
    latestFeedback,
    latestCrashes,
    databaseTelemetry,
  ] = await Promise.all([
    readCounter(adminClient, warnings, {
      dateColumn: "created_at",
      label: "用户资料",
      table: "profiles",
    }),
    readCounter(adminClient, warnings, {
      dateColumn: "created_at",
      label: "有效行程",
      notDeletedColumn: "deleted_at",
      table: "user_trips",
    }),
    readCounter(adminClient, warnings, {
      dateColumn: "created_at",
      label: "收藏地点",
      notDeletedColumn: "deleted_at",
      table: "user_favorite_places",
    }),
    readCounter(adminClient, warnings, {
      dateColumn: "called_at",
      label: "Agent 调用",
      table: "agent_calls",
    }),
    readCounter(adminClient, warnings, {
      dateColumn: "created_at",
      label: "用户反馈",
      table: "feedback",
    }),
    readCounter(adminClient, warnings, {
      dateColumn: "created_at",
      label: "崩溃报告",
      table: "crash_reports",
    }),
    readCounter(adminClient, warnings, {
      label: "POI 缓存",
      table: "poi_cache",
    }),
    readPoiReviewCounts(adminClient, warnings),
    readDailyTrend(adminClient, warnings, {
      dateColumn: "created_at",
      label: "用户资料趋势",
      table: "profiles",
    }),
    readDailyTrend(adminClient, warnings, {
      dateColumn: "created_at",
      label: "行程趋势",
      notDeletedColumn: "deleted_at",
      table: "user_trips",
    }),
    readDailyTrend(adminClient, warnings, {
      dateColumn: "called_at",
      label: "Agent 调用趋势",
      table: "agent_calls",
    }),
    readDailyTrend(adminClient, warnings, {
      dateColumn: "created_at",
      label: "反馈趋势",
      table: "feedback",
    }),
    readDailyTrend(adminClient, warnings, {
      dateColumn: "created_at",
      label: "崩溃趋势",
      table: "crash_reports",
    }),
    readLatestFeedback(adminClient, warnings),
    readLatestCrashes(adminClient, warnings),
    readDatabaseTelemetry(adminClient, warnings),
  ]);

  const kpis: AdminDashboardKpi[] = [
    createKpi({
      caption: createWindowCaption(profiles.current, profiles.previous),
      current: profiles.current,
      key: "profiles",
      label: "用户资料",
      previous: profiles.previous,
      statusLabel: "Auth 用户画像",
      tone: "blue",
      value: profiles.total,
    }),
    createKpi({
      caption: createWindowCaption(trips.current, trips.previous),
      current: trips.current,
      key: "trips",
      label: "有效行程",
      previous: trips.previous,
      statusLabel: "同步数据",
      tone: "green",
      value: trips.total,
    }),
    createKpi({
      caption: createWindowCaption(
        favoritePlaces.current,
        favoritePlaces.previous,
      ),
      current: favoritePlaces.current,
      key: "favoritePlaces",
      label: "收藏地点",
      previous: favoritePlaces.previous,
      statusLabel: "用户资产",
      tone: "amber",
      value: favoritePlaces.total,
    }),
    createKpi({
      caption: `近 24h ${agentCalls.current} 次，Agent 调用日志保留 3 天`,
      current: agentCalls.current,
      key: "agentCalls",
      label: "Agent 24h",
      previous: agentCalls.previous,
      statusLabel: "成本观察",
      tone: "blue",
      value: agentCalls.current,
    }),
    createKpi({
      caption: createWindowCaption(feedback.current, feedback.previous),
      current: feedback.current,
      key: "feedback",
      label: "新增反馈",
      previous: feedback.previous,
      statusLabel: feedback.current > 0 ? "需要处理" : "暂无新增",
      tone: feedback.current > 0 ? "amber" : "green",
      value: feedback.current,
    }),
    createKpi({
      caption: createWindowCaption(crashes.current, crashes.previous),
      current: crashes.current,
      key: "crashes",
      label: "崩溃 24h",
      previous: crashes.previous,
      statusLabel: crashes.current > 0 ? "需要排查" : "稳定",
      tone: crashes.current > 0 ? "coral" : "green",
      value: crashes.current,
    }),
    createKpi({
      caption: `待审 ${poiReview.pending}，需修正 ${poiReview.needsFix}`,
      current: poiReview.pending + poiReview.needsFix,
      key: "poiCache",
      label: "POI 审查",
      previous: 0,
      statusLabel: "地点底座",
      tone: poiReview.needsFix > 0 ? "amber" : "slate",
      value: poiCache.total,
    }),
  ];

  const trends: AdminDashboardTrend[] = [
    {
      caption: "最近 7 天新增用户画像",
      key: "profiles",
      points: profileTrend,
      title: "用户增长",
      tone: "blue",
      total: sumTrend(profileTrend),
    },
    {
      caption: "最近 7 天新增有效行程",
      key: "trips",
      points: tripTrend,
      title: "行程沉淀",
      tone: "green",
      total: sumTrend(tripTrend),
    },
    {
      caption: "Agent 日志目前按 3 天保留",
      key: "agent",
      points: agentTrend,
      title: "Agent 调用",
      tone: "blue",
      total: sumTrend(agentTrend),
    },
    {
      caption: "反馈与崩溃是当前最重要的待处理信号",
      key: "support",
      points: mergeTrends(feedbackTrend, crashTrend),
      title: "反馈 + 崩溃",
      tone: "coral",
      total: sumTrend(feedbackTrend) + sumTrend(crashTrend),
    },
  ];

  const queues = createLegacyQueues({
    agentCalls,
    crashes,
    feedback,
    poiCache,
    poiReview,
  });
  const statusSummary = createStatusSummary({
    crashes,
    feedback,
    member,
    now,
    poiReview,
    rangeLabel: "近 24 小时",
    warnings,
  });
  const healthSignals = createHealthSignals({
    agentCalls,
    crashes,
    feedback,
    poiReview,
  });
  const priorityItems = createPriorityItems({
    agentCalls,
    crashes,
    feedback,
    poiReview,
  });

  const dataScale: AdminDashboardScaleItem[] = [
    {
      description: "用户资料表，可作为现阶段用户总量近似值",
      label: "Profiles",
      tone: "blue",
      value: profiles.total,
    },
    {
      description: "未软删除的行程记录",
      label: "Trips",
      tone: "green",
      value: trips.total,
    },
    {
      description: "未软删除的用户收藏地点",
      label: "Favorites",
      tone: "amber",
      value: favoritePlaces.total,
    },
    {
      description: `已确认 ${poiReview.confirmed}，合并 ${poiReview.merged}，忽略 ${poiReview.ignored}`,
      label: "POI Cache",
      tone: "slate",
      value: poiCache.total,
    },
  ];

  const health: AdminDashboardHealthItem[] = [
    {
      description: userEmail ?? member.display_name ?? "当前管理员",
      label: "管理员身份",
      status: "ok",
      value: member.role,
    },
    {
      description:
        warnings.length > 0
          ? warnings[0]
          : "Service role 仅在服务端 API 使用，浏览器不可见",
      label: "数据库读取",
      status: warnings.length > 0 ? "warning" : "ok",
      value: warnings.length > 0 ? "部分异常" : "正常",
    },
    {
      description: "public.agent_calls 每小时清理 3 天前数据",
      label: "Agent 日志",
      status: "ok",
      value: "3 天保留",
    },
    {
      description: "当前仪表盘 no-store，每次刷新读取最新数据",
      label: "刷新时间",
      status: "ok",
      value: dateTimeFormatter.format(now),
    },
  ];

  const businessGroups: AdminDashboardBusinessGroup[] = [
    {
      description: "先看用户与旅行资产是否继续沉淀，再进入用户模块钻取个体。",
      key: "growth",
      metrics: [kpis[0], kpis[1], kpis[2]],
      title: "用户与旅行资产",
      trend: trends[0],
    },
    {
      description: "Agent 调用与 POI 质量决定产品自动化体验和后续成本走势。",
      key: "automation",
      metrics: [kpis[3], kpis[6]],
      title: "Agent 与 POI 自动化",
      trend: trends[2],
    },
    {
      description: "反馈和崩溃是当前最直接的体验风险信号，应优先闭环。",
      key: "quality",
      metrics: [kpis[4], kpis[5]],
      title: "质量与支持",
      trend: trends[3],
    },
  ];

  const foundation: AdminDashboardFoundation = {
    dataScale,
    health,
    note: "系统与数据底座默认折叠，owner 需要排查权限、表规模或数据源异常时再展开。",
  };
  const systemOverview = createSystemOverview(databaseTelemetry, health);
  const costOverview = createCostOverview({
    databaseTelemetry,
    totalUsers: profiles.total,
  });

  return {
    businessGroups,
    costOverview,
    dataScale,
    foundation,
    generatedAt: now.toISOString(),
    health,
    healthSignals,
    kpis,
    latestCrashes,
    latestFeedback,
    priorityItems,
    queues,
    rangeLabel: statusSummary.rangeLabel,
    statusSummary,
    systemOverview,
    trends,
    warnings,
  };

  async function readCounter(
    client: SupabaseClient,
    warningBucket: string[],
    options: CountOptions,
  ): Promise<CounterSnapshot> {
    if (!options.dateColumn) {
      const total = await countRows(client, warningBucket, options);

      return { current: 0, previous: 0, total };
    }

    const [total, current, previous] = await Promise.all([
      countRows(client, warningBucket, options),
      countRows(client, warningBucket, {
        ...options,
        from: currentStart,
        label: `${options.label} 近 24h`,
        to: now,
      }),
      countRows(client, warningBucket, {
        ...options,
        from: previousStart,
        label: `${options.label} 前 24h`,
        to: currentStart,
      }),
    ]);

    return { current, previous, total };
  }
}

async function countRows(
  client: SupabaseClient,
  warnings: string[],
  options: CountOptions,
) {
  let query = client.from(options.table).select("*", {
    count: "exact",
    head: true,
  });

  if (options.notDeletedColumn) {
    query = query.is(options.notDeletedColumn, null);
  }

  if (options.dateColumn && options.from) {
    query = query.gte(options.dateColumn, options.from.toISOString());
  }

  if (options.dateColumn && options.to) {
    query = query.lt(options.dateColumn, options.to.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    warnings.push(`${options.label}: ${error.message}`);
    return 0;
  }

  return count ?? 0;
}

async function readPoiReviewCounts(
  client: SupabaseClient,
  warnings: string[],
): Promise<PoiReviewCounts> {
  const [pending, needsFix, confirmed, merged, ignored] = await Promise.all([
    countPoiReviewStatus(client, warnings, "pending", "POI 待审"),
    countPoiReviewStatus(client, warnings, "needs_fix", "POI 需修正"),
    countPoiReviewStatus(client, warnings, "confirmed", "POI 已确认"),
    countPoiReviewStatus(client, warnings, "merged", "POI 已合并"),
    countPoiReviewStatus(client, warnings, "ignored", "POI 已忽略"),
  ]);

  return { confirmed, ignored, merged, needsFix, pending };
}

async function countPoiReviewStatus(
  client: SupabaseClient,
  warnings: string[],
  status: string,
  label: string,
) {
  const { count, error } = await client
    .from("poi_cache")
    .select("*", { count: "exact", head: true })
    .eq("review_status", status);

  if (error) {
    warnings.push(`${label}: ${error.message}`);
    return 0;
  }

  return count ?? 0;
}

async function readDailyTrend(
  client: SupabaseClient,
  warnings: string[],
  options: DailyTrendOptions,
): Promise<AdminDashboardTrendPoint[]> {
  const now = new Date();
  const buckets = createRecentDayBuckets(now, 7);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const since = new Date(now.getTime() - 8 * oneDayMs);

  let query = client
    .from(options.table)
    .select(options.dateColumn)
    .gte(options.dateColumn, since.toISOString());

  if (options.notDeletedColumn) {
    query = query.is(options.notDeletedColumn, null);
  }

  const { data, error } = await query;

  if (error) {
    warnings.push(`${options.label}: ${error.message}`);
    return buckets.map((bucket) => ({ label: bucket.label, value: 0 }));
  }

  for (const row of data ?? []) {
    const rawValue = (row as unknown as Record<string, unknown>)[
      options.dateColumn
    ];

    if (typeof rawValue !== "string") {
      continue;
    }

    const key = dayKeyFormatter.format(new Date(rawValue));

    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: counts.get(bucket.key) ?? 0,
  }));
}

async function readLatestFeedback(
  client: SupabaseClient,
  warnings: string[],
): Promise<AdminDashboardFeedbackItem[]> {
  const { data, error } = await client
    .from("feedback")
    .select(
      "id,description,contact_method,contact_value,platform,app_version,user_id,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    warnings.push(`最新反馈: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    appVersion: row.app_version ?? null,
    contactMethod: row.contact_method ?? null,
    contactValue: row.contact_value ?? null,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    platform: row.platform ?? null,
    userId: row.user_id ?? null,
  }));
}

async function readLatestCrashes(
  client: SupabaseClient,
  warnings: string[],
): Promise<AdminDashboardCrashItem[]> {
  const { data, error } = await client
    .from("crash_reports")
    .select(
      "id,title,level,platform,environment,release,user_id,sentry_url,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    warnings.push(`最新崩溃: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    createdAt: row.created_at,
    environment: row.environment ?? null,
    id: row.id,
    level: row.level ?? null,
    platform: row.platform ?? null,
    release: row.release ?? null,
    sentryUrl: row.sentry_url ?? null,
    title: row.title,
    userId: row.user_id ?? null,
  }));
}

async function readDatabaseTelemetry(
  client: SupabaseClient,
  warnings: string[],
): Promise<DatabaseTelemetry> {
  const fallback: DatabaseTelemetry = {
    activeConnections: 0,
    cacheHitRatio: null,
    dailyAverageTransactions: 0,
    idleConnections: 0,
    sizeBytes: 0,
    sizeLabel: "未知",
    storageLimitBytes: supabaseFreeLimits.databaseStorageBytes,
    storageUsagePercent: 0,
    totalConnections: 0,
    totalTransactions: 0,
    uptimeSeconds: 0,
  };

  try {
    const [sizeRows, connRows, txnRows, cacheRows] = await Promise.all([
      execSql<SqlResultRow>(
        client,
        "SELECT pg_database_size(current_database())::text AS db_size_bytes",
      ),
      execSql<SqlResultRow>(
        client,
        `SELECT
          count(*) FILTER (WHERE state = 'active')::text AS active,
          count(*) FILTER (WHERE state = 'idle')::text AS idle,
          count(*)::text AS total
        FROM pg_stat_activity
        WHERE datname = current_database()`,
      ),
      execSql<SqlResultRow>(
        client,
        `SELECT
          d.xact_commit::text AS committed,
          EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::integer::text AS uptime_seconds
        FROM pg_stat_database d
        WHERE d.datname = current_database()
        LIMIT 1`,
      ),
      execSql<SqlResultRow>(
        client,
        `SELECT
          CASE WHEN blks_hit + blks_read = 0 THEN '100'
               ELSE round(100.0 * blks_hit / (blks_hit + blks_read), 1)::text
          END AS hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()`,
      ),
    ]);

    const sizeBytes = readNumber(sizeRows[0]?.db_size_bytes);
    const uptimeSeconds = readNumber(txnRows[0]?.uptime_seconds);
    const totalTransactions = readNumber(txnRows[0]?.committed);
    const uptimeDays = Math.max(uptimeSeconds / 86400, 1);

    return {
      activeConnections: readNumber(connRows[0]?.active),
      cacheHitRatio: readNullableNumber(cacheRows[0]?.hit_ratio),
      dailyAverageTransactions: Math.round(totalTransactions / uptimeDays),
      idleConnections: readNumber(connRows[0]?.idle),
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      storageLimitBytes: supabaseFreeLimits.databaseStorageBytes,
      storageUsagePercent: calculatePercent(
        sizeBytes,
        supabaseFreeLimits.databaseStorageBytes,
      ),
      totalConnections: readNumber(connRows[0]?.total),
      totalTransactions,
      uptimeSeconds,
    };
  } catch (error) {
    warnings.push(
      `数据库遥测: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback;
  }
}

async function execSql<T>(client: SupabaseClient, sql: string): Promise<T[]> {
  const { data, error } = await client.rpc("exec_sql", {
    query: sql.trim().replace(/\s+/g, " "),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

function createSystemOverview(
  database: DatabaseTelemetry,
  health: AdminDashboardHealthItem[],
): AdminDashboardSystemOverview {
  return {
    database,
    metrics: [
      {
        description: "Supabase Postgres 当前数据库体积。",
        key: "database-storage",
        label: "数据库体积",
        limitLabel: formatBytes(database.storageLimitBytes),
        status: metricStatus(database.storageUsagePercent, 50, 80),
        tone: database.storageUsagePercent > 80 ? "coral" : "blue",
        usagePercent: database.storageUsagePercent,
        value: database.sizeLabel,
      },
      {
        description: "Postgres block cache 命中率，低于 95% 需要观察。",
        key: "cache-hit-ratio",
        label: "缓存命中率",
        status:
          database.cacheHitRatio == null
            ? "warning"
            : database.cacheHitRatio >= 99
              ? "ok"
              : database.cacheHitRatio >= 95
                ? "warning"
                : "error",
        tone:
          database.cacheHitRatio != null && database.cacheHitRatio < 95
            ? "coral"
            : "green",
        value:
          database.cacheHitRatio == null
            ? "未知"
            : `${database.cacheHitRatio.toFixed(1)}%`,
      },
      {
        description: "当前数据库连接数，包含 active 和 idle。",
        key: "connections",
        label: "数据库连接",
        status: database.totalConnections > 40 ? "warning" : "ok",
        tone: database.totalConnections > 40 ? "amber" : "green",
        value: `${database.activeConnections} 活跃 / ${database.idleConnections} 空闲`,
      },
      {
        description: "Postgres 累计事务折算日均，辅助判断后端负载走势。",
        key: "transactions",
        label: "日均事务",
        status: "ok",
        tone: "slate",
        value: database.dailyAverageTransactions.toLocaleString("zh-CN"),
      },
      ...health.map(
        (item): AdminDashboardSystemOverview["metrics"][number] => ({
          description: item.description,
          key: `health-${item.label}`,
          label: item.label,
          status: item.status,
          tone:
            item.status === "error"
              ? "coral"
              : item.status === "warning"
                ? "amber"
                : "green",
          value: item.value,
        }),
      ),
    ],
  };
}

function createCostOverview({
  databaseTelemetry,
  totalUsers,
}: {
  databaseTelemetry: DatabaseTelemetry;
  totalUsers: number;
}): AdminDashboardCostOverview {
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).getDate();
  const estimatedMonthlyFnCalls = Math.round(20 * daysInMonth);
  const edgeUsagePercent = calculatePercent(
    estimatedMonthlyFnCalls,
    supabaseFreeLimits.edgeFunctions,
  );
  const mauUsagePercent = calculatePercent(
    totalUsers,
    supabaseFreeLimits.monthlyActiveUsers,
  );

  return {
    note: "当前成本页沿用 Telegram 日报口径。Edge Functions 仍是粗估，后续需要接入真实调用流水。",
    quotas: [
      {
        description: "Supabase 免费层 Postgres 存储上限。",
        key: "database-storage",
        label: "数据库存储",
        limitLabel: formatBytes(supabaseFreeLimits.databaseStorageBytes),
        status: metricStatus(databaseTelemetry.storageUsagePercent, 50, 80),
        tone: databaseTelemetry.storageUsagePercent > 80 ? "coral" : "blue",
        usagePercent: databaseTelemetry.storageUsagePercent,
        value: `${databaseTelemetry.storageUsagePercent.toFixed(1)}%`,
      },
      {
        description: "基于当前日期的粗略月调用预估，真实成本统计后续接入。",
        key: "edge-functions",
        label: "Edge Functions",
        limitLabel: `${supabaseFreeLimits.edgeFunctions.toLocaleString("zh-CN")} 次/月`,
        status: metricStatus(edgeUsagePercent, 50, 80),
        tone: edgeUsagePercent > 80 ? "coral" : "green",
        usagePercent: edgeUsagePercent,
        value: `约 ${estimatedMonthlyFnCalls.toLocaleString("zh-CN")} 次`,
      },
      {
        description: "以 profiles 近似估算月活上限占用。",
        key: "monthly-active-users",
        label: "月活用户",
        limitLabel: `${supabaseFreeLimits.monthlyActiveUsers.toLocaleString("zh-CN")} MAU`,
        status: metricStatus(mauUsagePercent, 50, 80),
        tone: mauUsagePercent > 80 ? "coral" : "blue",
        usagePercent: mauUsagePercent,
        value: totalUsers.toLocaleString("zh-CN"),
      },
      {
        description: "Supabase 免费层对象存储额度；当前未接入 bucket 使用量。",
        key: "object-storage",
        label: "对象存储",
        limitLabel: `${supabaseFreeLimits.storageGb} GB`,
        status: "warning",
        tone: "amber",
        value: "待接入",
      },
    ],
  };
}

function calculatePercent(current: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, (current / limit) * 100);
}

function metricStatus(
  value: number,
  warningAt: number,
  errorAt: number,
): "error" | "ok" | "warning" {
  if (value >= errorAt) {
    return "error";
  }

  if (value >= warningAt) {
    return "warning";
  }

  return "ok";
}

function readNumber(value: string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function readNullableNumber(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}
function createLegacyQueues({
  agentCalls,
  crashes,
  feedback,
  poiReview,
}: {
  agentCalls: CounterSnapshot;
  crashes: CounterSnapshot;
  feedback: CounterSnapshot;
  poiCache: CounterSnapshot;
  poiReview: PoiReviewCounts;
}): AdminDashboardQueueItem[] {
  return [
    {
      description:
        feedback.current > 0
          ? `近 24h 新增 ${feedback.current} 条，建议优先查看`
          : "近 24h 暂无新增反馈",
      href: "/feedback",
      key: "feedback",
      label: "反馈处理",
      tone: feedback.current > 0 ? "amber" : "green",
      value: feedback.current,
    },
    {
      description:
        crashes.current > 0
          ? `近 24h 捕获 ${crashes.current} 条崩溃`
          : "崩溃报告暂无新增",
      href: "/diagnostics",
      key: "crashes",
      label: "崩溃排障",
      tone: crashes.current > 0 ? "coral" : "green",
      value: crashes.current,
    },
    {
      description: "当前仅接入调用量，成本维度待补充",
      href: "/agent",
      key: "agent",
      label: "Agent 成本",
      tone: "blue",
      value: agentCalls.current,
    },
    {
      description: `待审 ${poiReview.pending} 条，需修正 ${poiReview.needsFix} 条`,
      href: "/poi",
      key: "poi",
      label: "POI 审查",
      tone: poiReview.needsFix > 0 ? "amber" : "slate",
      value: poiReview.pending + poiReview.needsFix,
    },
  ];
}

function createStatusSummary({
  crashes,
  feedback,
  member,
  now,
  poiReview,
  rangeLabel,
  warnings,
}: {
  crashes: CounterSnapshot;
  feedback: CounterSnapshot;
  member: AdminMemberRpcRow;
  now: Date;
  poiReview: PoiReviewCounts;
  rangeLabel: string;
  warnings: string[];
}): AdminDashboardStatusSummary {
  const pendingTotal =
    crashes.current + feedback.current + poiReview.pending + poiReview.needsFix;
  const highRiskTotal = crashes.current + poiReview.needsFix + warnings.length;
  const severity = getProjectSeverity({
    highRiskTotal,
    pendingTotal,
    warnings,
  });
  const label =
    severity === "critical"
      ? "需要立即处理"
      : severity === "warning"
        ? "存在待处理事项"
        : "运行正常";
  const description =
    severity === "critical"
      ? "优先处理崩溃、数据读取异常或 POI 需修正项。"
      : severity === "warning"
        ? "项目无高危阻断，但仍有反馈或 POI 待审需要推进。"
        : "关键数据源正常，近 24 小时暂无高优先级异常。";

  return {
    description,
    generatedAt: now.toISOString(),
    highRiskTotal,
    label,
    pendingTotal,
    rangeLabel,
    role: member.role,
    severity,
  };
}

function createHealthSignals({
  agentCalls,
  crashes,
  feedback,
  poiReview,
}: {
  agentCalls: CounterSnapshot;
  crashes: CounterSnapshot;
  feedback: CounterSnapshot;
  poiReview: PoiReviewCounts;
}): AdminDashboardHealthSignal[] {
  const agentSpike =
    agentCalls.current >= 10 &&
    agentCalls.current > Math.max(1, agentCalls.previous) * 2;

  return [
    {
      caption: crashes.current > 0 ? "近 24h 有崩溃" : "近 24h 无新增崩溃",
      href: "/diagnostics",
      key: "crashes",
      label: "稳定性",
      severity: crashes.current > 0 ? "critical" : "ok",
      tone: crashes.current > 0 ? "coral" : "green",
      value: crashes.current.toLocaleString("zh-CN"),
    },
    {
      caption:
        poiReview.needsFix > 0
          ? "存在需修正地点"
          : poiReview.pending > 0
            ? "存在待审地点"
            : "地点审查已清空",
      href: "/poi",
      key: "poi",
      label: "POI 质量",
      severity:
        poiReview.needsFix > 0
          ? "warning"
          : poiReview.pending > 0
            ? "attention"
            : "ok",
      tone: poiReview.needsFix > 0 || poiReview.pending > 0 ? "amber" : "green",
      value: (poiReview.pending + poiReview.needsFix).toLocaleString("zh-CN"),
    },
    {
      caption: feedback.current > 0 ? "近 24h 有新增反馈" : "暂无新增反馈",
      href: "/feedback",
      key: "feedback",
      label: "用户声音",
      severity: feedback.current > 0 ? "attention" : "ok",
      tone: feedback.current > 0 ? "amber" : "green",
      value: feedback.current.toLocaleString("zh-CN"),
    },
    {
      caption: agentSpike ? "调用量较前窗放大" : "调用量处于观察范围",
      href: "/agent",
      key: "agent",
      label: "Agent 成本",
      severity: agentSpike ? "attention" : "ok",
      tone: agentSpike ? "amber" : "blue",
      value: agentCalls.current.toLocaleString("zh-CN"),
    },
  ];
}

function createPriorityItems({
  agentCalls,
  crashes,
  feedback,
  poiReview,
}: {
  agentCalls: CounterSnapshot;
  crashes: CounterSnapshot;
  feedback: CounterSnapshot;
  poiReview: PoiReviewCounts;
}): AdminDashboardPriorityItem[] {
  const agentSpike =
    agentCalls.current >= 10 &&
    agentCalls.current > Math.max(1, agentCalls.previous) * 2;

  return [
    {
      caption: crashes.current > 0 ? "高风险" : "稳定",
      description:
        crashes.current > 0
          ? "先确认是否影响主流程，再进入诊断模块定位版本与平台。"
          : "近 24h 未捕获新增崩溃。",
      href: "/diagnostics",
      key: "crashes",
      label: "崩溃排障",
      severity: crashes.current > 0 ? "critical" : "ok",
      tone: crashes.current > 0 ? "coral" : "green",
      value: crashes.current,
    },
    {
      caption: `${poiReview.pending} 待审 / ${poiReview.needsFix} 修正`,
      description:
        poiReview.pending + poiReview.needsFix > 0
          ? "优先处理 needs_fix，再批量确认可信 POI。"
          : "POI 审查队列当前为空。",
      href: "/poi",
      key: "poi",
      label: "POI 审查",
      severity:
        poiReview.needsFix > 0
          ? "warning"
          : poiReview.pending > 0
            ? "attention"
            : "ok",
      tone: poiReview.needsFix > 0 || poiReview.pending > 0 ? "amber" : "green",
      value: poiReview.pending + poiReview.needsFix,
    },
    {
      caption: feedback.current > 0 ? "需要回复" : "暂无新增",
      description:
        feedback.current > 0
          ? "把新增反馈转成 bug、产品问题或用户沟通任务。"
          : "近 24h 没有新的用户反馈。",
      href: "/feedback",
      key: "feedback",
      label: "用户反馈",
      severity: feedback.current > 0 ? "attention" : "ok",
      tone: feedback.current > 0 ? "amber" : "green",
      value: feedback.current,
    },
    {
      caption: agentSpike ? "调用放大" : "观察成本",
      description: agentSpike
        ? "调用量较前 24h 明显放大，建议检查异常入口或高频用户。"
        : "当前仅接入调用量指标，token、失败原因和模型成本待补充。",
      href: "/agent",
      key: "agent",
      label: "Agent 调用",
      severity: agentSpike ? "attention" : "ok",
      tone: agentSpike ? "amber" : "blue",
      value: agentCalls.current,
    },
  ];
}

function getProjectSeverity({
  highRiskTotal,
  pendingTotal,
  warnings,
}: {
  highRiskTotal: number;
  pendingTotal: number;
  warnings: string[];
}): DashboardSeverity {
  if (highRiskTotal > 0 || warnings.length > 0) {
    return "critical";
  }

  if (pendingTotal > 0) {
    return "warning";
  }

  return "ok";
}

function createKpi(input: {
  caption: string;
  current: number;
  key: DashboardKpiKey;
  label: string;
  previous: number;
  statusLabel: string;
  tone: DashboardTone;
  value: number;
}): AdminDashboardKpi {
  const delta = input.current - input.previous;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return {
    caption: input.caption,
    deltaLabel:
      delta === 0
        ? "持平"
        : `${delta > 0 ? "+" : ""}${delta.toLocaleString("zh-CN")}`,
    direction,
    key: input.key,
    label: input.label,
    statusLabel: input.statusLabel,
    tone: input.tone,
    value: input.value,
  };
}

function createWindowCaption(current: number, previous: number) {
  return `近 24h ${current.toLocaleString("zh-CN")}，前 24h ${previous.toLocaleString("zh-CN")}`;
}

function createRecentDayBuckets(now: Date, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - index - 1) * oneDayMs);

    return {
      key: dayKeyFormatter.format(date),
      label: dayLabelFormatter.format(date),
    };
  });
}

function mergeTrends(
  first: AdminDashboardTrendPoint[],
  second: AdminDashboardTrendPoint[],
): AdminDashboardTrendPoint[] {
  return first.map((point, index) => ({
    label: point.label,
    value: point.value + (second[index]?.value ?? 0),
  }));
}

function sumTrend(points: AdminDashboardTrendPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0);
}
