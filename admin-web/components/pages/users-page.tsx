"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  EyeOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { fetchAdminUsers } from "@/lib/admin-users";
import type { AdminUsersData, AdminUserSummary } from "@/lib/admin-users-types";
import { useAsyncValue } from "@/lib/use-async-value";

const defaultPageSize = 20;

export function UsersPage() {
  return <UsersContent />;
}

function UsersContent() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const loader = useCallback(
    () =>
      fetchAdminUsers({
        page,
        pageSize: defaultPageSize,
        query: submittedQuery,
      }),
    [page, submittedQuery],
  );
  const users = useAsyncValue<AdminUsersData>(loader);
  const columns = useMemo(() => createColumns(), []);

  function handleSearch(nextQuery = query) {
    setPage(1);
    setSubmittedQuery(nextQuery.trim());
  }

  return (
    <>
      <div className="page-heading users-heading">
        <div>
          <span className="eyebrow-label">auth.users + public.profiles</span>
          <h1>用户搜索</h1>
          <p>
            搜索账号、查看资料和排查用户维度的行程、反馈、Agent 调用上下文。
          </p>
        </div>
        <Tag color="green">已接入</Tag>
      </div>

      <Card className="panel-card users-search-panel">
        <div className="users-search-row">
          <Input.Search
            allowClear
            enterButton={
              <Button icon={<SearchOutlined />} type="primary">
                搜索
              </Button>
            }
            onChange={(event) => setQuery(event.target.value)}
            onSearch={handleSearch}
            placeholder="搜索邮箱、手机号、UUID、昵称"
            size="large"
            value={query}
          />
          <Button icon={<ReloadOutlined />} onClick={users.reload} size="large">
            刷新
          </Button>
        </div>

        <div className="users-search-meta">
          <span>
            {submittedQuery
              ? `当前关键词：${submittedQuery}`
              : "默认显示最近创建的后台可见用户"}
          </span>
          <span>
            共 {users.value?.total ?? 0} 个匹配用户，数据来自服务端聚合接口
          </span>
        </div>
      </Card>

      {users.error ? (
        <Alert
          action={
            <Button onClick={users.reload} size="small">
              重试
            </Button>
          }
          message={users.error.message}
          showIcon
          type="error"
        />
      ) : null}

      {users.value?.warnings.length ? (
        <Alert
          message={users.value.warnings.slice(0, 2).join(" / ")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className="users-table-shell">
        <Table<AdminUserSummary>
          columns={columns}
          dataSource={users.value?.users ?? []}
          loading={users.loading}
          locale={{
            emptyText: (
              <Empty
                description="没有找到匹配用户"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={{
            current: page,
            onChange: setPage,
            pageSize: defaultPageSize,
            showSizeChanger: false,
            total: users.value?.total ?? 0,
          }}
          rowKey="id"
          scroll={{ x: 980 }}
        />
      </div>
    </>
  );
}

function createColumns(): ColumnsType<AdminUserSummary> {
  return [
    {
      dataIndex: "displayName",
      fixed: "left",
      render: (_value, row) => <UserIdentityCell user={row} />,
      title: "用户",
      width: 300,
    },
    {
      dataIndex: "providers",
      render: (_value, row) => (
        <Space size={[6, 6]} wrap>
          {row.providers.length > 0 ? (
            row.providers.slice(0, 3).map((provider) => (
              <Tag key={`${row.id}-${provider.provider}`} color="blue">
                {provider.provider}
              </Tag>
            ))
          ) : (
            <Tag>未知</Tag>
          )}
        </Space>
      ),
      title: "登录方式",
      width: 160,
    },
    {
      dataIndex: "trips",
      render: (_value, row) => (
        <MetricCell
          icon={<TeamOutlined />}
          items={[
            ["行程", row.trips],
            ["收藏", row.favoritePlaces],
          ]}
        />
      ),
      title: "旅行资产",
      width: 180,
    },
    {
      dataIndex: "feedbackCount",
      render: (_value, row) => (
        <MetricCell
          icon={<MessageOutlined />}
          items={[
            ["反馈", row.feedbackCount],
            ["Agent", row.agentCalls3d],
          ]}
        />
      ),
      title: "排障信号",
      width: 180,
    },
    {
      dataIndex: "createdAt",
      render: (value: string | null) => formatDateTime(value),
      title: "注册时间",
      width: 150,
    },
    {
      dataIndex: "lastSignInAt",
      render: (value: string | null) => formatDateTime(value),
      title: "最近登录",
      width: 150,
    },
    {
      key: "actions",
      render: (_value, row) => (
        <Link href={`/users/${row.id}`}>
          <Button icon={<EyeOutlined />} type="primary">
            详情
          </Button>
        </Link>
      ),
      title: "操作",
      width: 110,
    },
  ];
}

function UserIdentityCell({ user }: { user: AdminUserSummary }) {
  const displayName = user.displayName ?? user.email ?? "未命名用户";

  return (
    <div className="users-identity-cell">
      <Avatar src={user.avatarUrl} size={42}>
        {displayName.slice(0, 1).toUpperCase()}
      </Avatar>
      <div>
        <Typography.Text strong>{displayName}</Typography.Text>
        <span>{user.email ?? user.phone ?? user.id}</span>
        <code>{user.id}</code>
      </div>
    </div>
  );
}

function MetricCell({
  icon,
  items,
}: {
  icon: React.ReactNode;
  items: [string, number][];
}) {
  return (
    <div className="users-metric-cell">
      <span className="users-metric-icon">{icon}</span>
      <div>
        {items.map(([label, value]) => (
          <span key={label}>
            {label} <strong>{value.toLocaleString("zh-CN")}</strong>
          </span>
        ))}
      </div>
    </div>
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
