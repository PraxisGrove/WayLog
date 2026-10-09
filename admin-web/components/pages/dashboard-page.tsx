"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  ApiOutlined,
  ArrowRightOutlined,
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DollarCircleOutlined,
  EnvironmentOutlined,
  LineChartOutlined,
  MessageOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Bar, Column, Line, Pie } from "@ant-design/charts";
import { ProCard, StatisticCard } from "@ant-design/pro-components";
import {
  Alert,
  Button,
  Empty,
  Progress,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import type { ReactNode } from "react";

import { fetchAdminDashboard } from "@/lib/admin-dashboard";
import type {
  AdminDashboardBusinessGroup,
  AdminDashboardCostOverview,
  AdminDashboardCrashItem,
  AdminDashboardData,
  AdminDashboardFeedbackItem,
  AdminDashboardHealthItem,
  AdminDashboardHealthSignal,
  AdminDashboardPriorityItem,
  AdminDashboardResourceMetric,
  AdminDashboardScaleItem,
  AdminDashboardStatusSummary,
  AdminDashboardTrend,
  DashboardSeverity,
  DashboardTone,
} from "@/lib/admin-dashboard-types";
import { useAsyncValue } from "@/lib/use-async-value";

const signalIconMap: Record<AdminDashboardHealthSignal["key"], ReactNode> = {
  agent: <ApiOutlined />,
  crashes: <BugOutlined />,
  feedback: <MessageOutlined />,
  poi: <EnvironmentOutlined />,
};

const priorityIconMap: Record<AdminDashboardPriorityItem["key"], ReactNode> = {
  agent: <ApiOutlined />,
  crashes: <BugOutlined />,
  feedback: <MessageOutlined />,
  poi: <EnvironmentOutlined />,
};

const severityCopy: Record<DashboardSeverity, string> = {
  attention: "关注",
  critical: "高风险",
  ok: "正常",
  warning: "待处理",
};

const dashboardSkeletonKeys = [
  "status",
  "tabs",
  "donut",
  "bars",
  "line",
  "queue",
];

const chartPalette: Record<DashboardTone, string> = {
  amber: "#f2b544",
  blue: "#2d7ff9",
  coral: "#e45b4f",
  green: "#18a76d",
  slate: "#59636b",
};

type ChartDatum = {
  caption?: string;
  key: string;
  label: string;
  tone: DashboardTone;
  value: number;
};

type PieDatum = ChartDatum & {
  type: string;
};

type SeriesDatum = {
  label: string;
  metric: string;
  value: number;
};

export function DashboardPage() {
  return <DashboardContent />;
}

function DashboardContent() {
  const dashboard = useAsyncValue<AdminDashboardData>(fetchAdminDashboard);

  function handleRefresh() {
    dashboard.reload();
  }

  if (dashboard.loading && !dashboard.value) {
    return <DashboardSkeleton />;
  }

  if (dashboard.error) {
    return (
      <div className="dashboard-page owner-dashboard">
        <Alert
          action={
            <Button onClick={handleRefresh} size="small">
              重新加载
            </Button>
          }
          message="仪表盘加载失败"
          showIcon
          type="error"
          description={dashboard.error.message}
        />
      </div>
    );
  }

  if (!dashboard.value) {
    return <DashboardSkeleton />;
  }

  const data = dashboard.value;

  return (
    <div className="dashboard-page owner-dashboard">
      <DashboardHeader
        loading={dashboard.loading}
        onRefresh={handleRefresh}
        summary={data.statusSummary}
      />

      {data.warnings.length > 0 ? (
        <Alert
          className="dashboard-warning"
          message="部分数据源读取异常"
          showIcon
          type="warning"
          description={data.warnings.slice(0, 2).join("；")}
        />
      ) : null}

      <Tabs
        className="dashboard-tabs"
        defaultActiveKey="overview"
        items={[
          {
            children: <OverviewTab data={data} />,
            key: "overview",
            label: (
              <DashboardTabLabel icon={<DashboardOutlined />} text="总览" />
            ),
          },
          {
            children: <OperationsTab data={data} />,
            key: "operations",
            label: (
              <DashboardTabLabel icon={<LineChartOutlined />} text="运营" />
            ),
          },
          {
            children: <QualityTab data={data} />,
            key: "quality",
            label: <DashboardTabLabel icon={<BugOutlined />} text="质量" />,
          },
          {
            children: <SystemTab data={data} />,
            key: "system",
            label: (
              <DashboardTabLabel icon={<DatabaseOutlined />} text="系统" />
            ),
          },
          {
            children: <CostTab costOverview={data.costOverview} />,
            key: "cost",
            label: (
              <DashboardTabLabel icon={<DollarCircleOutlined />} text="成本" />
            ),
          },
        ]}
      />
    </div>
  );
}

function DashboardHeader({
  loading,
  onRefresh,
  summary,
}: {
  loading: boolean;
  onRefresh: () => void;
  summary: AdminDashboardStatusSummary;
}) {
  return (
    <section className={`dashboard-header-panel severity-${summary.severity}`}>
      <div className="dashboard-header-copy">
        <span className="dashboard-eyebrow">Owner Dashboard</span>
        <div>
          <span
            className={`dashboard-status-dot severity-${summary.severity}`}
          />
          <h1>WayLog 运营仪表盘</h1>
          <Tag
            className={`dashboard-severity-tag severity-${summary.severity}`}
          >
            {summary.label}
          </Tag>
        </div>
        <p>{summary.description}</p>
      </div>

      <StatisticCard.Group
        className="dashboard-header-stat-group"
        direction="row"
      >
        <StatisticCard
          statistic={{ title: "待处理", value: summary.pendingTotal }}
        />
        <StatisticCard
          statistic={{ title: "高风险", value: summary.highRiskTotal }}
        />
        <StatisticCard statistic={{ title: "权限", value: summary.role }} />
      </StatisticCard.Group>

      <Space className="dashboard-header-actions" size={10}>
        <Tag className="dashboard-range-tag" icon={<ClockCircleOutlined />}>
          {summary.rangeLabel}
        </Tag>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={onRefresh}
          type="primary"
        >
          刷新
        </Button>
      </Space>
    </section>
  );
}

function DashboardTabLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="dashboard-tab-label">
      {icon}
      {text}
    </span>
  );
}

function OverviewTab({ data }: { data: AdminDashboardData }) {
  const prioritySegments = data.priorityItems.map((item) => ({
    caption: item.caption,
    key: item.key,
    label: item.label,
    tone: item.tone,
    type: item.label,
    value: item.value,
  }));
  const kpiBars = data.kpis.map((item) => ({
    caption: item.statusLabel,
    key: item.key,
    label: item.label,
    tone: item.tone,
    value: item.value,
  }));

  return (
    <div className="dashboard-tab-page dashboard-overview-tab">
      <section
        className={`dashboard-status-hero severity-${data.statusSummary.severity}`}
      >
        <div>
          <span className="dashboard-section-kicker">当前状态</span>
          <h2>{data.statusSummary.label}</h2>
          <p>{data.statusSummary.description}</p>
        </div>
        <div className="dashboard-status-score">
          <strong>
            {data.statusSummary.pendingTotal.toLocaleString("zh-CN")}
          </strong>
          <span>待处理总数</span>
          <em>{severityCopy[data.statusSummary.severity]}</em>
        </div>
      </section>

      <ChartPanel
        caption="按当前待处理入口拆分，帮助 owner 判断先处理哪类问题。"
        className="dashboard-priority-donut-panel"
        title="待处理分布"
      >
        <PieDashboardChart data={prioritySegments} innerRadius={0.68} />
      </ChartPanel>

      <ChartPanel
        caption="将关键规模指标降级为横向对比，避免 KPI 卡片占满首屏。"
        className="dashboard-kpi-bars-panel"
        title="核心规模对比"
      >
        <ColumnDashboardChart data={kpiBars} />
      </ChartPanel>

      <section className="dashboard-signal-strip" aria-label="项目健康信号">
        {data.healthSignals.map((signal) => (
          <Link
            className={`dashboard-signal-card tone-${signal.tone} severity-${signal.severity}`}
            href={signal.href}
            key={signal.key}
          >
            <span className="dashboard-signal-icon">
              {signalIconMap[signal.key]}
            </span>
            <span className="dashboard-signal-copy">
              <strong>{signal.label}</strong>
              <span>{signal.caption}</span>
            </span>
            <span className="dashboard-signal-value">{signal.value}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function OperationsTab({ data }: { data: AdminDashboardData }) {
  return (
    <div className="dashboard-tab-page dashboard-operations-tab">
      <div className="dashboard-chart-grid dashboard-chart-grid-three">
        {data.businessGroups.map((group) => (
          <BusinessGroupPanel group={group} key={group.key} />
        ))}
      </div>

      <ChartPanel
        caption="最近 7 天新增用户、行程、Agent、质量信号的趋势。"
        title="全局趋势"
      >
        <LineDashboardChart data={buildTrendSeries(data.trends)} />
      </ChartPanel>
    </div>
  );
}

function BusinessGroupPanel({ group }: { group: AdminDashboardBusinessGroup }) {
  const bars = group.metrics.map((metric) => ({
    caption: metric.caption,
    key: metric.key,
    label: metric.label,
    tone: metric.tone,
    value: metric.value,
  }));

  return (
    <ChartPanel caption={group.description} title={group.title}>
      <LineDashboardChart data={buildTrendSeries([group.trend])} compact />
      <BarDashboardChart data={bars} compact />
    </ChartPanel>
  );
}

function QualityTab({ data }: { data: AdminDashboardData }) {
  const supportTrend =
    data.trends.find((trend) => trend.key === "support") ?? data.trends[0];
  const queueBars = data.priorityItems.map((item) => ({
    caption: item.caption,
    key: item.key,
    label: item.label,
    tone: item.tone,
    value: item.value,
  }));

  return (
    <div className="dashboard-tab-page dashboard-quality-tab">
      <ChartPanel
        caption="队列数字越高，越应该进入对应模块闭环。"
        title="队列柱状图"
      >
        <ColumnDashboardChart data={queueBars} />
      </ChartPanel>

      <section
        className="dashboard-action-panel"
        aria-labelledby="dashboard-action-title"
      >
        <div className="dashboard-panel-heading">
          <div>
            <Typography.Text id="dashboard-action-title" strong>
              优先处理入口
            </Typography.Text>
            <span>高风险优先，其次处理待审与反馈。</span>
          </div>
        </div>
        <div className="dashboard-priority-list">
          {data.priorityItems.map((item) => (
            <Link
              className={`dashboard-priority-item tone-${item.tone} severity-${item.severity}`}
              href={item.href}
              key={item.key}
            >
              <span className="dashboard-priority-icon">
                {priorityIconMap[item.key]}
              </span>
              <span className="dashboard-priority-copy">
                <span>
                  <strong>{item.label}</strong>
                  <Tag
                    className={`dashboard-severity-tag severity-${item.severity}`}
                  >
                    {item.caption}
                  </Tag>
                </span>
                <em>{item.description}</em>
              </span>
              <span className="dashboard-priority-value">
                {item.value.toLocaleString("zh-CN")}
                <ArrowRightOutlined />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <ChartPanel caption={supportTrend.caption} title="质量趋势">
        <LineDashboardChart data={buildTrendSeries([supportTrend])} />
      </ChartPanel>

      <RecentSignals
        latestCrashes={data.latestCrashes}
        latestFeedback={data.latestFeedback}
      />
    </div>
  );
}

function SystemTab({ data }: { data: AdminDashboardData }) {
  const healthSegments = buildResourceStatusSegments(
    data.systemOverview.metrics,
  );
  const databaseBars: ChartDatum[] = [
    {
      key: "active-connections",
      label: "活跃连接",
      tone: "green",
      value: data.systemOverview.database.activeConnections,
    },
    {
      key: "idle-connections",
      label: "空闲连接",
      tone: "slate",
      value: data.systemOverview.database.idleConnections,
    },
    {
      key: "daily-transactions",
      label: "日均事务",
      tone: "blue",
      value: data.systemOverview.database.dailyAverageTransactions,
    },
  ];

  return (
    <div className="dashboard-tab-page dashboard-system-tab">
      <ChartPanel
        caption="数据库、权限和后台基础能力按状态汇总。"
        title="系统状态占比"
      >
        <PieDashboardChart
          data={healthSegments.map((item) => ({ ...item, type: item.label }))}
        />
      </ChartPanel>

      <ChartPanel
        caption="Telegram 日报同源的连接与事务指标，辅助判断后端负载。"
        title="数据库运行指标"
      >
        <BarDashboardChart data={databaseBars} />
      </ChartPanel>

      <ResourceMetricsPanel
        caption="数据库体积、缓存命中率、连接和基础健康检查。"
        icon={<DatabaseOutlined />}
        items={data.systemOverview.metrics}
        title="系统指标"
      />
      <DataScalePanel items={data.foundation.dataScale} />
      <HealthPanel items={data.foundation.health} />
    </div>
  );
}

function CostTab({
  costOverview,
}: {
  costOverview: AdminDashboardCostOverview;
}) {
  const quotaBars = costOverview.quotas
    .filter((item) => typeof item.usagePercent === "number")
    .map(resourceMetricToDatum);
  const statusSegments = buildResourceStatusSegments(costOverview.quotas);

  return (
    <div className="dashboard-tab-page dashboard-cost-tab">
      <ChartPanel caption={costOverview.note} title="免费额度占用">
        <ColumnDashboardChart data={quotaBars} />
      </ChartPanel>

      <ChartPanel
        caption="按额度状态汇总，后续可加入高德、模型和短信等外部账单。"
        title="成本风险分布"
      >
        <PieDashboardChart
          data={statusSegments.map((item) => ({ ...item, type: item.label }))}
        />
      </ChartPanel>

      <ResourceMetricsPanel
        caption="当前先展示 Supabase 免费层与 Edge Functions 粗估，真实费用流水后续接入。"
        icon={<DollarCircleOutlined />}
        items={costOverview.quotas}
        title="额度明细"
      />
    </div>
  );
}

function RecentSignals({
  latestCrashes,
  latestFeedback,
}: {
  latestCrashes: AdminDashboardCrashItem[];
  latestFeedback: AdminDashboardFeedbackItem[];
}) {
  return (
    <section className="dashboard-recent-panel" aria-label="最新质量信号">
      <div className="dashboard-panel-heading slim">
        <div>
          <Typography.Text strong>最新质量信号</Typography.Text>
          <span>反馈与崩溃合并查看，方便判断优先级。</span>
        </div>
      </div>

      <div className="dashboard-recent-columns">
        <LatestFeedbackList items={latestFeedback} />
        <LatestCrashList items={latestCrashes} />
      </div>
    </section>
  );
}

function LatestFeedbackList({
  items,
}: {
  items: AdminDashboardFeedbackItem[];
}) {
  return (
    <div className="dashboard-feed-list">
      <div className="dashboard-feed-heading">
        <MessageOutlined />
        <strong>反馈</strong>
        <Link href="/feedback">查看</Link>
      </div>
      {items.length > 0 ? (
        items.slice(0, 4).map((item) => (
          <div className="dashboard-feed-item" key={item.id}>
            <span className="dashboard-feed-time">
              {formatDateTime(item.createdAt)}
            </span>
            <strong>{truncateText(item.description, 52)}</strong>
            <span>
              {[item.platform, item.appVersion, item.contactMethod]
                .filter(Boolean)
                .join(" · ") || "未提供上下文"}
            </span>
          </div>
        ))
      ) : (
        <Empty description="暂无反馈" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );
}

function LatestCrashList({ items }: { items: AdminDashboardCrashItem[] }) {
  return (
    <div className="dashboard-feed-list">
      <div className="dashboard-feed-heading">
        <BugOutlined />
        <strong>崩溃</strong>
        <Link href="/diagnostics">查看</Link>
      </div>
      {items.length > 0 ? (
        items.slice(0, 4).map((item) => (
          <div className="dashboard-feed-item crash" key={item.id}>
            <span className="dashboard-feed-time">
              {formatDateTime(item.createdAt)}
            </span>
            <strong>{truncateText(item.title, 52)}</strong>
            <span>
              {[item.level, item.platform, item.release]
                .filter(Boolean)
                .join(" · ") || "未提供发布上下文"}
            </span>
          </div>
        ))
      ) : (
        <Empty
          description="暂无崩溃报告"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
}

function DataScalePanel({ items }: { items: AdminDashboardScaleItem[] }) {
  return (
    <section className="dashboard-foundation-panel">
      <div className="dashboard-panel-heading">
        <div>
          <Typography.Text strong>数据明细</Typography.Text>
          <span>当前后台可读核心表。</span>
        </div>
        <DatabaseOutlined />
      </div>
      <BarDashboardChart data={items.map(scaleItemToDatum)} compact />
    </section>
  );
}

function HealthPanel({ items }: { items: AdminDashboardHealthItem[] }) {
  return (
    <section className="dashboard-foundation-panel">
      <div className="dashboard-panel-heading">
        <div>
          <Typography.Text strong>系统明细</Typography.Text>
          <span>身份、数据库读取与日志保留状态。</span>
        </div>
        <CheckCircleOutlined />
      </div>
      <div className="dashboard-health-list">
        {items.map((item) => (
          <div className="dashboard-health-item" key={item.label}>
            <span className={`dashboard-health-dot status-${item.status}`} />
            <div>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </div>
            <Tag>{item.value}</Tag>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourceMetricsPanel({
  caption,
  icon,
  items,
  title,
}: {
  caption: string;
  icon: ReactNode;
  items: AdminDashboardResourceMetric[];
  title: string;
}) {
  return (
    <section className="dashboard-resource-panel">
      <div className="dashboard-panel-heading">
        <div>
          <Typography.Text strong>{title}</Typography.Text>
          <span>{caption}</span>
        </div>
        {icon}
      </div>
      <div className="dashboard-resource-list">
        {items.map((item) => (
          <div
            className={`dashboard-resource-item tone-${item.tone} status-${item.status}`}
            key={item.key}
          >
            <div className="dashboard-resource-item-header">
              <span className={`dashboard-health-dot status-${item.status}`} />
              <strong>{item.label}</strong>
              <Tag>{item.value}</Tag>
            </div>
            <p>{item.description}</p>
            {typeof item.usagePercent === "number" ? (
              <Progress
                percent={Number(item.usagePercent.toFixed(1))}
                showInfo={false}
                size="small"
                status={
                  item.status === "error"
                    ? "exception"
                    : item.status === "warning"
                      ? "active"
                      : "normal"
                }
                strokeColor={chartPalette[item.tone]}
              />
            ) : null}
            {item.limitLabel ? (
              <span className="dashboard-resource-limit">
                上限 {item.limitLabel}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
function ChartPanel({
  caption,
  children,
  className,
  title,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <ProCard
      className={["dashboard-chart-panel", className].filter(Boolean).join(" ")}
      title={title}
      bordered
    >
      <p className="dashboard-panel-caption">{caption}</p>
      {children}
    </ProCard>
  );
}

function PieDashboardChart({
  data,
  innerRadius = 0.62,
}: {
  data: PieDatum[];
  innerRadius?: number;
}) {
  return (
    <div className="dashboard-chart-frame dashboard-pie-frame">
      <Pie
        angleField="value"
        colorField="type"
        data={data}
        height={220}
        innerRadius={innerRadius}
        label={{ text: "value", position: "outside" }}
        legend={{
          color: { position: "bottom", layout: { justifyContent: "center" } },
        }}
        scale={{
          color: {
            range: data.map((item) => chartPalette[item.tone]),
          },
        }}
        tooltip={{ title: "type" }}
      />
    </div>
  );
}

function ColumnDashboardChart({ data }: { data: ChartDatum[] }) {
  return (
    <div className="dashboard-chart-frame">
      <Column
        colorField="tone"
        data={data}
        height={220}
        scale={{
          color: { range: data.map((item) => chartPalette[item.tone]) },
        }}
        tooltip={{ title: "label" }}
        xField="label"
        yField="value"
        axis={{
          x: { labelAutoRotate: false, labelAutoHide: true },
          y: { labelFormatter: "~s" },
        }}
      />
    </div>
  );
}

function BarDashboardChart({
  compact,
  data,
}: {
  compact?: boolean;
  data: ChartDatum[];
}) {
  return (
    <div className="dashboard-chart-frame">
      <Bar
        colorField="tone"
        data={data}
        height={compact ? 156 : 220}
        scale={{
          color: { range: data.map((item) => chartPalette[item.tone]) },
        }}
        tooltip={{ title: "label" }}
        xField="value"
        yField="label"
        axis={{ x: { labelFormatter: "~s" } }}
      />
    </div>
  );
}

function LineDashboardChart({
  compact,
  data,
}: {
  compact?: boolean;
  data: SeriesDatum[];
}) {
  return (
    <div className="dashboard-chart-frame">
      <Line
        colorField="metric"
        data={data}
        height={compact ? 150 : 240}
        legend={compact ? false : { color: { position: "bottom" } }}
        point={{ shapeField: "circle", sizeField: 3 }}
        tooltip={{ title: "label" }}
        xField="label"
        yField="value"
        axis={{ y: { labelFormatter: "~s" } }}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-page owner-dashboard">
      <div className="dashboard-header-panel">
        <Skeleton active paragraph={{ rows: 1 }} title />
      </div>
      <div className="dashboard-skeleton-tabs">
        <Skeleton.Button active block />
      </div>
      <div className="dashboard-skeleton-grid">
        {dashboardSkeletonKeys.map((key) => (
          <div className="dashboard-skeleton-card" key={key}>
            <Skeleton active paragraph={{ rows: 3 }} title={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

function buildTrendSeries(trends: AdminDashboardTrend[]): SeriesDatum[] {
  return trends.flatMap((trend) =>
    trend.points.map((point) => ({
      label: point.label,
      metric: trend.title,
      value: point.value,
    })),
  );
}

function scaleItemToDatum(item: AdminDashboardScaleItem): ChartDatum {
  return {
    caption: item.description,
    key: item.label,
    label: item.label,
    tone: item.tone,
    value: item.value,
  };
}

function resourceMetricToDatum(item: AdminDashboardResourceMetric): ChartDatum {
  return {
    caption: item.limitLabel ? `上限 ${item.limitLabel}` : item.description,
    key: item.key,
    label: item.label,
    tone: item.tone,
    value: Math.round(item.usagePercent ?? 0),
  };
}

function buildResourceStatusSegments(
  items: AdminDashboardResourceMetric[],
): ChartDatum[] {
  const counts = { error: 0, ok: 0, warning: 0 };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return [
    {
      key: "ok",
      label: "正常",
      tone: "green",
      value: counts.ok,
    },
    {
      key: "warning",
      label: "关注",
      tone: "amber",
      value: counts.warning,
    },
    {
      key: "error",
      label: "风险",
      tone: "coral",
      value: counts.error,
    },
  ];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function truncateText(value: string, maxLength: number) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}...`;
}
