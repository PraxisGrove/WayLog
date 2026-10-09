"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  ApiOutlined,
  ArrowLeftOutlined,
  BugOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  MessageOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  List,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useCallback } from "react";

import { fetchAdminUserDetail } from "@/lib/admin-users";
import type {
  AdminUserDetail,
  AdminUserFavoriteItem,
  AdminUserMetric,
  AdminUserTripItem,
} from "@/lib/admin-users-types";
import { useAsyncValue } from "@/lib/use-async-value";

const metricIconMap: Record<AdminUserMetric["key"], React.ReactNode> = {
  agent: <ApiOutlined />,
  crashes: <BugOutlined />,
  favorites: <EnvironmentOutlined />,
  feedback: <MessageOutlined />,
  trips: <CompassOutlined />,
};

const tripColumns: ColumnsType<AdminUserTripItem> = [
  {
    dataIndex: "title",
    render: (value: string, row) => (
      <div className="user-detail-table-title">
        <strong>{value || "未命名行程"}</strong>
        <span>{row.destination || "暂无目的地"}</span>
      </div>
    ),
    title: "行程",
  },
  {
    dataIndex: "status",
    render: (value: string) => <Tag>{value || "unknown"}</Tag>,
    title: "状态",
    width: 110,
  },
  {
    dataIndex: "updatedAt",
    render: formatDateTime,
    title: "更新时间",
    width: 150,
  },
  {
    dataIndex: "version",
    render: (value: number) => `v${value}`,
    title: "版本",
    width: 80,
  },
];

const favoriteColumns: ColumnsType<AdminUserFavoriteItem> = [
  {
    dataIndex: "name",
    render: (value: string, row) => (
      <div className="user-detail-table-title">
        <strong>{value || "未命名地点"}</strong>
        <span>
          {[row.category, row.area].filter(Boolean).join(" · ") || "暂无分类"}
        </span>
      </div>
    ),
    title: "地点",
  },
  {
    dataIndex: "providerPlaceId",
    render: (value: string | null) =>
      value ? (
        <Link href={`/poi?q=${encodeURIComponent(value)}&status=all`}>
          <Button icon={<EnvironmentOutlined />} size="small">
            {value}
          </Button>
        </Link>
      ) : (
        "暂无"
      ),
    title: "Provider ID",
    width: 180,
  },
  {
    dataIndex: "updatedAt",
    render: formatDateTime,
    title: "更新时间",
    width: 150,
  },
];

export function UserDetailPage({ userId }: { userId: string }) {
  return <UserDetailContent userId={userId} />;
}

function UserDetailContent({ userId }: { userId: string }) {
  const loader = useCallback(() => fetchAdminUserDetail(userId), [userId]);
  const detail = useAsyncValue<AdminUserDetail>(loader);

  if (detail.loading && !detail.value) {
    return (
      <Card className="panel-card">
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  if (detail.error) {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Link href="/users">
          <Button icon={<ArrowLeftOutlined />}>返回用户列表</Button>
        </Link>
        <Alert
          action={<Button onClick={detail.reload}>重试</Button>}
          message={detail.error.message}
          showIcon
          type="error"
        />
      </Space>
    );
  }

  if (!detail.value) {
    return null;
  }

  const user = detail.value;
  const displayName = user.profile?.displayName ?? user.email ?? "未命名用户";

  return (
    <>
      <div className="page-heading user-detail-heading">
        <div>
          <Link href="/users">
            <Button icon={<ArrowLeftOutlined />}>返回用户列表</Button>
          </Link>
          <span className="eyebrow-label">用户详情</span>
          <h1>{displayName}</h1>
          <p>{user.email ?? user.phone ?? user.id}</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={detail.reload}>
          刷新
        </Button>
      </div>

      {user.warnings.length ? (
        <Alert
          message={user.warnings.slice(0, 3).join(" / ")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className="user-detail-grid">
        <Card className="panel-card user-profile-card">
          <div className="user-profile-head">
            <Avatar src={user.profile?.avatarUrl} size={64}>
              {displayName.slice(0, 1).toUpperCase()}
            </Avatar>
            <div>
              <Typography.Title level={3}>{displayName}</Typography.Title>
              <Typography.Text copyable>{user.id}</Typography.Text>
            </div>
          </div>

          <Descriptions column={1} size="small">
            <Descriptions.Item label="邮箱">
              {user.email ?? "暂无"}
            </Descriptions.Item>
            <Descriptions.Item label="手机号">
              {user.phone ?? "暂无"}
            </Descriptions.Item>
            <Descriptions.Item label="城市">
              {user.profile?.homeCity ?? "暂无"}
            </Descriptions.Item>
            <Descriptions.Item label="最近登录">
              {formatDateTime(user.lastSignInAt)}
            </Descriptions.Item>
            <Descriptions.Item label="最后 Agent">
              {formatDateTime(user.agentCalls.lastCalledAt)}
            </Descriptions.Item>
          </Descriptions>

          <Space size={[6, 6]} wrap>
            {user.identities.length > 0 ? (
              user.identities.map((identity) => (
                <Tag key={identity.provider} color="blue">
                  {identity.provider}
                </Tag>
              ))
            ) : (
              <Tag>无身份记录</Tag>
            )}
          </Space>
        </Card>

        <div className="user-metric-grid">
          {user.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      </div>

      <div className="user-detail-sections">
        <Card className="panel-card" title="最近行程">
          <Table<AdminUserTripItem>
            columns={tripColumns}
            dataSource={user.trips}
            locale={{
              emptyText: (
                <Empty
                  description="暂无行程"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 760 }}
          />
        </Card>

        <Card className="panel-card" title="最近收藏">
          <Table<AdminUserFavoriteItem>
            columns={favoriteColumns}
            dataSource={user.favoritePlaces}
            locale={{
              emptyText: (
                <Empty
                  description="暂无收藏"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 700 }}
          />
        </Card>
      </div>

      <div className="user-detail-sections two-column">
        <Card className="panel-card" title="最近反馈">
          <TimelineList
            emptyText="暂无反馈"
            items={user.feedback.map((item) => ({
              meta: [
                formatDateTime(item.createdAt),
                item.platform,
                item.appVersion,
              ]
                .filter(Boolean)
                .join(" · "),
              text: item.description,
              title: item.contactValue ?? item.contactMethod ?? "用户反馈",
            }))}
          />
        </Card>

        <Card className="panel-card" title="最近崩溃">
          <TimelineList
            emptyText="暂无崩溃"
            items={user.crashes.map((item) => ({
              href: item.sentryUrl,
              meta: [
                formatDateTime(item.createdAt),
                item.level,
                item.environment,
                item.release,
              ]
                .filter(Boolean)
                .join(" · "),
              text: item.title,
              title: item.level ?? "crash",
            }))}
          />
        </Card>
      </div>
    </>
  );
}

function MetricCard({ metric }: { metric: AdminUserMetric }) {
  return (
    <Card className="user-metric-card">
      <span className="user-metric-card-icon">{metricIconMap[metric.key]}</span>
      <div>
        <span>{metric.label}</span>
        <strong>{metric.value.toLocaleString("zh-CN")}</strong>
        <p>{metric.description}</p>
      </div>
    </Card>
  );
}

function TimelineList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: {
    href?: string | null;
    meta: string;
    text: string;
    title: string;
  }[];
}) {
  if (items.length === 0) {
    return (
      <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  }

  return (
    <List
      className="user-timeline-list"
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            description={
              <div>
                <p>{item.text}</p>
                <span>{item.meta}</span>
              </div>
            }
            title={
              item.href ? (
                <a href={item.href} rel="noreferrer" target="_blank">
                  {item.title}
                </a>
              ) : (
                item.title
              )
            }
          />
        </List.Item>
      )}
    />
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
