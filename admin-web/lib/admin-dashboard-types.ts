export type DashboardTone = "amber" | "blue" | "coral" | "green" | "slate";

export type DashboardSeverity = "attention" | "critical" | "ok" | "warning";

export type DashboardKpiKey =
  | "agentCalls"
  | "crashes"
  | "favoritePlaces"
  | "feedback"
  | "poiCache"
  | "profiles"
  | "trips";

export type DashboardDirection = "down" | "flat" | "up";

export type AdminDashboardKpi = {
  caption: string;
  deltaLabel: string;
  direction: DashboardDirection;
  key: DashboardKpiKey;
  label: string;
  statusLabel: string;
  tone: DashboardTone;
  value: number;
};

export type AdminDashboardTrendPoint = {
  label: string;
  value: number;
};

export type AdminDashboardTrend = {
  caption: string;
  key: string;
  points: AdminDashboardTrendPoint[];
  title: string;
  tone: DashboardTone;
  total: number;
};

export type AdminDashboardQueueItem = {
  description: string;
  href: string;
  key: "agent" | "crashes" | "feedback" | "poi";
  label: string;
  tone: DashboardTone;
  value: number;
};

export type AdminDashboardStatusSummary = {
  description: string;
  generatedAt: string;
  highRiskTotal: number;
  label: string;
  pendingTotal: number;
  rangeLabel: string;
  role: string;
  severity: DashboardSeverity;
};

export type AdminDashboardHealthSignal = {
  caption: string;
  href: string;
  key: "agent" | "crashes" | "feedback" | "poi";
  label: string;
  severity: DashboardSeverity;
  tone: DashboardTone;
  value: string;
};

export type AdminDashboardPriorityItem = {
  caption: string;
  description: string;
  href: string;
  key: "agent" | "crashes" | "feedback" | "poi";
  label: string;
  severity: DashboardSeverity;
  tone: DashboardTone;
  value: number;
};

export type AdminDashboardBusinessGroup = {
  description: string;
  key: "automation" | "growth" | "quality";
  metrics: AdminDashboardKpi[];
  title: string;
  trend: AdminDashboardTrend;
};

export type AdminDashboardFoundation = {
  dataScale: AdminDashboardScaleItem[];
  health: AdminDashboardHealthItem[];
  note: string;
};

export type AdminDashboardFeedbackItem = {
  appVersion: string | null;
  contactMethod: string | null;
  contactValue: string | null;
  createdAt: string;
  description: string;
  id: string;
  platform: string | null;
  userId: string | null;
};

export type AdminDashboardCrashItem = {
  createdAt: string;
  environment: string | null;
  id: string;
  level: string | null;
  platform: string | null;
  release: string | null;
  sentryUrl: string | null;
  title: string;
  userId: string | null;
};

export type AdminDashboardScaleItem = {
  description: string;
  label: string;
  tone: DashboardTone;
  value: number;
};

export type AdminDashboardHealthItem = {
  description: string;
  label: string;
  status: "error" | "ok" | "warning";
  value: string;
};

export type AdminDashboardResourceMetric = {
  description: string;
  key: string;
  label: string;
  limitLabel?: string;
  status: "error" | "ok" | "warning";
  tone: DashboardTone;
  usagePercent?: number;
  value: string;
};

export type AdminDashboardSystemOverview = {
  database: {
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
  metrics: AdminDashboardResourceMetric[];
};

export type AdminDashboardCostOverview = {
  note: string;
  quotas: AdminDashboardResourceMetric[];
};

export type AdminDashboardData = {
  businessGroups: AdminDashboardBusinessGroup[];
  costOverview: AdminDashboardCostOverview;
  dataScale: AdminDashboardScaleItem[];
  foundation: AdminDashboardFoundation;
  generatedAt: string;
  health: AdminDashboardHealthItem[];
  healthSignals: AdminDashboardHealthSignal[];
  kpis: AdminDashboardKpi[];
  latestCrashes: AdminDashboardCrashItem[];
  latestFeedback: AdminDashboardFeedbackItem[];
  priorityItems: AdminDashboardPriorityItem[];
  queues: AdminDashboardQueueItem[];
  rangeLabel: string;
  statusSummary: AdminDashboardStatusSummary;
  systemOverview: AdminDashboardSystemOverview;
  trends: AdminDashboardTrend[];
  warnings: string[];
};
