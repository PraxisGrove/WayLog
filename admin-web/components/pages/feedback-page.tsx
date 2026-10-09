"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminFeedbackDetail,
  fetchAdminFeedbackEntries,
  updateAdminFeedbackEntry,
} from "@/lib/admin-feedback";
import type {
  AdminFeedbackDetail,
  AdminFeedbackItem,
  AdminFeedbackListData,
  AdminFeedbackSeverity,
  AdminFeedbackStatus,
  AdminFeedbackUpdateInput,
} from "@/lib/admin-feedback-types";
import { useAsyncValue } from "@/lib/use-async-value";

const defaultPageSize = 20;

const statusOptions: {
  color: string;
  icon?: React.ReactNode;
  label: string;
  value: AdminFeedbackStatus;
}[] = [
  {
    color: "gold",
    icon: <ClockCircleOutlined />,
    label: "待处理",
    value: "pending",
  },
  {
    color: "blue",
    icon: <MessageOutlined />,
    label: "处理中",
    value: "in_progress",
  },
  {
    color: "green",
    icon: <CheckCircleOutlined />,
    label: "已解决",
    value: "resolved",
  },
  {
    color: "default",
    icon: <CloseCircleOutlined />,
    label: "忽略",
    value: "ignored",
  },
];

const severityOptions: {
  color: string;
  icon?: React.ReactNode;
  label: string;
  value: AdminFeedbackSeverity;
}[] = [
  { color: "default", label: "普通", value: "normal" },
  {
    color: "orange",
    icon: <ExclamationCircleOutlined />,
    label: "重要",
    value: "important",
  },
  {
    color: "red",
    icon: <ExclamationCircleOutlined />,
    label: "阻断",
    value: "blocking",
  },
];

const statusLabelMap = new Map(statusOptions.map((item) => [item.value, item]));
const severityLabelMap = new Map(
  severityOptions.map((item) => [item.value, item]),
);

type FeedbackEditorValues = {
  adminNote?: string;
  assignedTo?: string;
  relatedAgentCallId?: number | null;
  relatedPoiId?: string;
  relatedTripId?: string;
  replyMessage?: string;
  severity: AdminFeedbackSeverity;
  sourcePage?: string;
  status: AdminFeedbackStatus;
};

export function FeedbackPage() {
  return <FeedbackContent />;
}

function FeedbackContent() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState<AdminFeedbackStatus | "all">("pending");
  const [severity, setSeverity] = useState<AdminFeedbackSeverity | "all">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string>();
  const [quickUpdatingId, setQuickUpdatingId] = useState<string>();
  const loader = useCallback(
    () =>
      fetchAdminFeedbackEntries({
        page,
        pageSize: defaultPageSize,
        query: submittedQuery,
        severity,
        status,
      }),
    [page, severity, status, submittedQuery],
  );
  const feedback = useAsyncValue<AdminFeedbackListData>(loader);
  const columns = createFeedbackColumns({
    onOpen: setSelectedFeedbackId,
    onQuickStatus: handleQuickStatus,
    quickUpdatingId,
  });

  function handleSearch(nextQuery = query) {
    setPage(1);
    setSubmittedQuery(nextQuery.trim());
  }

  function handleStatusChange(nextStatus: AdminFeedbackStatus | "all") {
    setPage(1);
    setStatus(nextStatus);
  }

  function handleSeverityChange(nextSeverity: AdminFeedbackSeverity | "all") {
    setPage(1);
    setSeverity(nextSeverity);
  }

  async function handleQuickStatus(
    item: AdminFeedbackItem,
    nextStatus: AdminFeedbackStatus,
  ) {
    setQuickUpdatingId(item.id);

    try {
      await updateAdminFeedbackEntry(item.id, {
        adminNote: buildQuickStatusNote(item, nextStatus),
        status: nextStatus,
      });
      feedback.reload();
      message.success(
        `反馈已更新为${statusLabelMap.get(nextStatus)?.label ?? "新状态"}`,
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "反馈状态更新失败",
      );
    } finally {
      setQuickUpdatingId(undefined);
    }
  }

  return (
    <>
      <div className="page-heading feedback-heading">
        <div>
          <span className="eyebrow-label">public.feedback</span>
          <h1>反馈处理中心</h1>
          <p>
            查看用户主动提交的问题、建议和诊断上下文，把反馈流转为可追踪的处理状态。
          </p>
        </div>
        <Space className="feedback-heading-actions" size={10} wrap>
          <Tag color="blue">已接入</Tag>
          <Button icon={<ReloadOutlined />} onClick={feedback.reload}>
            刷新
          </Button>
        </Space>
      </div>

      <Card className="panel-card feedback-filter-panel">
        <div className="feedback-filter-row">
          <Input.Search
            allowClear
            enterButton={
              <Button icon={<SearchOutlined />} type="primary">
                搜索
              </Button>
            }
            onChange={(event) => setQuery(event.target.value)}
            onSearch={handleSearch}
            placeholder="搜索反馈内容、联系方式、平台、关联 POI 或行程"
            size="large"
            value={query}
          />
          <Select
            onChange={handleStatusChange}
            options={[
              { label: "全部状态", value: "all" },
              ...statusOptions.map((item) => ({
                label: item.label,
                value: item.value,
              })),
            ]}
            size="large"
            value={status}
          />
          <Select
            onChange={handleSeverityChange}
            options={[
              { label: "全部级别", value: "all" },
              ...severityOptions.map((item) => ({
                label: item.label,
                value: item.value,
              })),
            ]}
            size="large"
            value={severity}
          />
        </div>

        <div className="feedback-status-strip">
          {statusOptions.map((item) => (
            <button
              className={status === item.value ? "active" : ""}
              key={item.value}
              onClick={() => handleStatusChange(item.value)}
              type="button"
            >
              <span>{item.label}</span>
              <strong>
                {(feedback.value?.statusCounts[item.value] ?? 0).toLocaleString(
                  "zh-CN",
                )}
              </strong>
            </button>
          ))}
        </div>

        <div className="feedback-filter-meta">
          <span>
            {submittedQuery
              ? `当前关键词：${submittedQuery}`
              : "默认显示待处理反馈，按最近更新时间排序"}
          </span>
          <span>共 {feedback.value?.total ?? 0} 条匹配反馈</span>
        </div>
      </Card>

      {feedback.error ? (
        <Alert
          action={<Button onClick={feedback.reload}>重试</Button>}
          message={feedback.error.message}
          showIcon
          type="error"
        />
      ) : null}

      {feedback.value?.warnings.length ? (
        <Alert
          message={feedback.value.warnings.slice(0, 3).join(" / ")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className="feedback-table-shell">
        <Table<AdminFeedbackItem>
          columns={columns}
          dataSource={feedback.value?.feedback ?? []}
          loading={feedback.loading}
          locale={{
            emptyText: (
              <Empty
                description="没有找到匹配反馈"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={{
            current: page,
            onChange: setPage,
            pageSize: defaultPageSize,
            showSizeChanger: false,
            total: feedback.value?.total ?? 0,
          }}
          rowKey="id"
          scroll={{ x: 1180 }}
        />
      </div>

      <FeedbackDetailDrawer
        feedbackId={selectedFeedbackId}
        onClose={() => setSelectedFeedbackId(undefined)}
        onSaved={() => {
          feedback.reload();
        }}
      />
    </>
  );
}

function createFeedbackColumns({
  onOpen,
  onQuickStatus,
  quickUpdatingId,
}: {
  onOpen: (feedbackId: string) => void;
  onQuickStatus: (
    item: AdminFeedbackItem,
    nextStatus: AdminFeedbackStatus,
  ) => void;
  quickUpdatingId?: string;
}): ColumnsType<AdminFeedbackItem> {
  return [
    {
      dataIndex: "description",
      fixed: "left",
      render: (_value, row) => <FeedbackSummaryCell item={row} />,
      title: "反馈",
      width: 390,
    },
    {
      dataIndex: "status",
      render: (value: AdminFeedbackStatus) => <StatusTag status={value} />,
      title: "状态",
      width: 120,
    },
    {
      dataIndex: "severity",
      render: (value: AdminFeedbackSeverity) => (
        <SeverityTag severity={value} />
      ),
      title: "级别",
      width: 110,
    },
    {
      dataIndex: "user",
      render: (_value, row) => <FeedbackUserCell item={row} />,
      title: "用户",
      width: 220,
    },
    {
      dataIndex: "platform",
      render: (_value, row) => (
        <Space size={[6, 6]} wrap>
          {row.platform ? (
            <Tag>{formatPlatform(row.platform)}</Tag>
          ) : (
            <Tag>未知</Tag>
          )}
          {row.appVersion ? <Tag color="blue">{row.appVersion}</Tag> : null}
        </Space>
      ),
      title: "客户端",
      width: 180,
    },
    {
      dataIndex: "createdAt",
      render: formatDateTime,
      title: "提交时间",
      width: 150,
    },
    {
      fixed: "right",
      key: "actions",
      render: (_value, row) => (
        <FeedbackRowActions
          item={row}
          loading={quickUpdatingId === row.id}
          onOpen={() => onOpen(row.id)}
          onQuickStatus={(nextStatus) => onQuickStatus(row, nextStatus)}
        />
      ),
      title: "操作",
      width: 260,
    },
  ];
}

function FeedbackSummaryCell({ item }: { item: AdminFeedbackItem }) {
  return (
    <div className="feedback-summary-cell">
      <strong>{item.description || "空反馈"}</strong>
      <span>
        {[
          item.contactMethod && item.contactValue
            ? `${item.contactMethod}: ${item.contactValue}`
            : null,
          item.sourcePage ? `页面：${item.sourcePage}` : null,
          item.relatedPoiId ? `POI：${item.relatedPoiId}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "未提供联系方式或关联对象"}
      </span>
      <Typography.Text copyable>{item.id}</Typography.Text>
    </div>
  );
}

function FeedbackUserCell({ item }: { item: AdminFeedbackItem }) {
  if (!item.userId) {
    return (
      <Space size={6}>
        <UserOutlined />
        <span className="feedback-muted">游客</span>
      </Space>
    );
  }

  const label =
    item.user?.displayName ??
    item.user?.email ??
    item.user?.phone ??
    item.userId;

  return (
    <Space direction="vertical" size={2}>
      <Link href={`/users/${encodeURIComponent(item.userId)}`}>{label}</Link>
      <Typography.Text className="feedback-muted" copyable>
        {item.userId}
      </Typography.Text>
    </Space>
  );
}

function FeedbackRowActions({
  item,
  loading,
  onOpen,
  onQuickStatus,
}: {
  item: AdminFeedbackItem;
  loading: boolean;
  onOpen: () => void;
  onQuickStatus: (nextStatus: AdminFeedbackStatus) => void;
}) {
  return (
    <Space className="feedback-row-actions" size={6} wrap>
      <Button
        icon={<MessageOutlined />}
        onClick={onOpen}
        size="small"
        type="primary"
      >
        处理
      </Button>
      <Button
        disabled={item.status === "in_progress"}
        loading={loading}
        onClick={() => onQuickStatus("in_progress")}
        size="small"
      >
        跟进
      </Button>
      <Button
        disabled={item.status === "resolved"}
        icon={<CheckCircleOutlined />}
        loading={loading}
        onClick={() => onQuickStatus("resolved")}
        size="small"
      >
        解决
      </Button>
      <Popconfirm
        cancelText="取消"
        okText="忽略"
        onConfirm={() => onQuickStatus("ignored")}
        title="确认忽略这条反馈？"
      >
        <Button
          danger
          disabled={item.status === "ignored"}
          icon={<CloseCircleOutlined />}
          loading={loading}
          size="small"
        >
          忽略
        </Button>
      </Popconfirm>
    </Space>
  );
}

function FeedbackDetailDrawer({
  feedbackId,
  onClose,
  onSaved,
}: {
  feedbackId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<FeedbackEditorValues>();
  const [saving, setSaving] = useState(false);
  const loader = useCallback(() => {
    if (!feedbackId) {
      return Promise.resolve(undefined);
    }

    return fetchAdminFeedbackDetail(feedbackId);
  }, [feedbackId]);
  const detail = useAsyncValue<AdminFeedbackDetail | undefined>(loader);
  const currentDetail =
    detail.value?.id === feedbackId ? detail.value : undefined;

  useEffect(() => {
    if (!currentDetail) {
      return;
    }

    form.setFieldsValue(createEditorValues(currentDetail));
  }, [currentDetail, form]);

  async function handleSave(values: FeedbackEditorValues) {
    if (!feedbackId) {
      return;
    }

    const input = createUpdateInput(values);

    setSaving(true);

    try {
      const nextDetail = await updateAdminFeedbackEntry(feedbackId, input);
      form.setFieldsValue(createEditorValues(nextDetail));
      detail.reload();
      onSaved();
      message.success("反馈已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDetailStatus(nextStatus: AdminFeedbackStatus) {
    if (!feedbackId || !currentDetail) {
      return;
    }

    setSaving(true);

    try {
      const nextDetail = await updateAdminFeedbackEntry(feedbackId, {
        adminNote: buildQuickStatusNote(currentDetail, nextStatus),
        status: nextStatus,
      });
      form.setFieldsValue(createEditorValues(nextDetail));
      detail.reload();
      onSaved();
      message.success(
        `反馈已更新为${statusLabelMap.get(nextStatus)?.label ?? "新状态"}`,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      destroyOnClose
      extra={
        <Space className="feedback-drawer-actions" wrap>
          <Button icon={<ReloadOutlined />} onClick={detail.reload}>
            刷新
          </Button>
          <Button
            disabled={!currentDetail || currentDetail.status === "in_progress"}
            loading={saving}
            onClick={() => handleDetailStatus("in_progress")}
          >
            跟进
          </Button>
          <Button
            disabled={!currentDetail || currentDetail.status === "resolved"}
            icon={<CheckCircleOutlined />}
            loading={saving}
            onClick={() => handleDetailStatus("resolved")}
          >
            解决
          </Button>
          <Popconfirm
            cancelText="取消"
            okText="忽略"
            onConfirm={() => handleDetailStatus("ignored")}
            title="确认忽略这条反馈？"
          >
            <Button
              danger
              disabled={!currentDetail || currentDetail.status === "ignored"}
              icon={<CloseCircleOutlined />}
              loading={saving}
            >
              忽略
            </Button>
          </Popconfirm>
        </Space>
      }
      onClose={onClose}
      open={Boolean(feedbackId)}
      title={currentDetail ? "反馈详情" : "加载反馈"}
      width={760}
    >
      {detail.error ? (
        <Alert
          action={<Button onClick={detail.reload}>重试</Button>}
          message={detail.error.message}
          showIcon
          type="error"
        />
      ) : null}

      {currentDetail ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card className="panel-card feedback-original-card">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space size={[8, 8]} wrap>
                <StatusTag status={currentDetail.status} />
                <SeverityTag severity={currentDetail.severity} />
                {currentDetail.platform ? (
                  <Tag>{formatPlatform(currentDetail.platform)}</Tag>
                ) : null}
                {currentDetail.appVersion ? (
                  <Tag color="blue">{currentDetail.appVersion}</Tag>
                ) : null}
              </Space>
              <Typography.Paragraph className="feedback-description">
                {currentDetail.description}
              </Typography.Paragraph>
              <Typography.Text className="feedback-muted" copyable>
                {currentDetail.id}
              </Typography.Text>
            </Space>
          </Card>

          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="提交时间">
              {formatDateTime(currentDetail.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {formatDateTime(currentDetail.updatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {currentDetail.userId ? (
                <Space direction="vertical" size={2}>
                  <Link
                    href={`/users/${encodeURIComponent(currentDetail.userId)}`}
                  >
                    {currentDetail.user?.displayName ??
                      currentDetail.user?.email ??
                      currentDetail.user?.phone ??
                      currentDetail.userId}
                  </Link>
                  <Typography.Text copyable>
                    {currentDetail.userId}
                  </Typography.Text>
                </Space>
              ) : (
                "游客"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="联系方式">
              {currentDetail.contactMethod && currentDetail.contactValue
                ? `${currentDetail.contactMethod}: ${currentDetail.contactValue}`
                : "未提供"}
            </Descriptions.Item>
            <Descriptions.Item label="处理人">
              {currentDetail.handledBy ?? "暂无"} ·{" "}
              {formatDateTime(currentDetail.handledAt)}
            </Descriptions.Item>
          </Descriptions>

          <Form<FeedbackEditorValues>
            form={form}
            layout="vertical"
            onFinish={handleSave}
            requiredMark={false}
          >
            <div className="feedback-form-grid">
              <Form.Item label="状态" name="status">
                <Select
                  options={statusOptions.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
              <Form.Item label="严重程度" name="severity">
                <Select
                  options={severityOptions.map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
              <Form.Item label="来源页面" name="sourcePage">
                <Input placeholder="/trip/xxx 或 place-detail" />
              </Form.Item>
              <Form.Item label="关联 POI" name="relatedPoiId">
                <Input placeholder="amap_poi_id" />
              </Form.Item>
              <Form.Item label="关联 Agent 调用" name="relatedAgentCallId">
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item label="关联行程" name="relatedTripId">
                <Input placeholder="user_trips.id" />
              </Form.Item>
              <Form.Item label="负责人" name="assignedTo">
                <Input placeholder="管理员 user_id" />
              </Form.Item>
            </div>

            <Form.Item label="处理备注" name="adminNote">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item label="用户回复草稿" name="replyMessage">
              <Input.TextArea
                rows={4}
                placeholder="后续接 App 消息系统时，可把这里的内容发送给用户"
              />
            </Form.Item>

            <Space>
              <Button htmlType="submit" loading={saving} type="primary">
                保存处理
              </Button>
              {currentDetail.relatedPoiId ? (
                <Link
                  href={`/poi?q=${encodeURIComponent(currentDetail.relatedPoiId)}`}
                >
                  <Button icon={<LinkOutlined />}>查看 POI</Button>
                </Link>
              ) : null}
              {currentDetail.userId ? (
                <Link
                  href={`/users/${encodeURIComponent(currentDetail.userId)}`}
                >
                  <Button icon={<UserOutlined />}>查看用户</Button>
                </Link>
              ) : null}
            </Space>
          </Form>

          <Card className="panel-card" title="诊断上下文">
            {currentDetail.diagnosticContext ? (
              <pre className="feedback-diagnostic-text">
                {currentDetail.diagnosticContext}
              </pre>
            ) : (
              <Empty
                description="暂无诊断上下文"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>

          <Card className="panel-card" title="设备信息">
            {currentDetail.deviceInfo ? (
              <pre className="feedback-diagnostic-text">
                {stringifyJson(currentDetail.deviceInfo)}
              </pre>
            ) : (
              <Empty
                description="暂无设备信息"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>

          <Card className="panel-card" title="审计日志">
            {currentDetail.auditLogs.length > 0 ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {currentDetail.auditLogs.map((log) => (
                  <div className="feedback-audit-item" key={log.id}>
                    <strong>{log.action}</strong>
                    <span>
                      {formatDateTime(log.createdAt)} ·{" "}
                      {log.actorUserId ?? "未知管理员"}
                    </span>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty
                description="暂无审计记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Space>
      ) : (
        <Empty
          description="正在加载反馈"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Drawer>
  );
}

function StatusTag({ status }: { status: AdminFeedbackStatus }) {
  const meta = statusLabelMap.get(status) ?? statusLabelMap.get("pending");

  return (
    <Tag color={meta?.color} icon={meta?.icon}>
      {meta?.label ?? status}
    </Tag>
  );
}

function SeverityTag({ severity }: { severity: AdminFeedbackSeverity }) {
  const meta = severityLabelMap.get(severity) ?? severityLabelMap.get("normal");

  return (
    <Tag color={meta?.color} icon={meta?.icon}>
      {meta?.label ?? severity}
    </Tag>
  );
}

function createEditorValues(
  feedback: AdminFeedbackDetail,
): FeedbackEditorValues {
  return {
    adminNote: feedback.adminNote ?? undefined,
    assignedTo: feedback.assignedTo ?? undefined,
    relatedAgentCallId: feedback.relatedAgentCallId,
    relatedPoiId: feedback.relatedPoiId ?? undefined,
    relatedTripId: feedback.relatedTripId ?? undefined,
    replyMessage: feedback.replyMessage ?? undefined,
    severity: feedback.severity,
    sourcePage: feedback.sourcePage ?? undefined,
    status: feedback.status,
  };
}

function createUpdateInput(
  values: FeedbackEditorValues,
): AdminFeedbackUpdateInput {
  return {
    adminNote: emptyToNull(values.adminNote),
    assignedTo: emptyToNull(values.assignedTo),
    relatedAgentCallId: values.relatedAgentCallId ?? null,
    relatedPoiId: emptyToNull(values.relatedPoiId),
    relatedTripId: emptyToNull(values.relatedTripId),
    replyMessage: emptyToNull(values.replyMessage),
    severity: values.severity,
    sourcePage: emptyToNull(values.sourcePage),
    status: values.status,
  };
}

function buildQuickStatusNote(
  item: AdminFeedbackItem,
  nextStatus: AdminFeedbackStatus,
) {
  const label = statusLabelMap.get(nextStatus)?.label ?? nextStatus;
  const existing = item.adminNote?.trim();
  const note = `后台快捷操作：${label}`;

  return existing ? `${existing}\n${note}` : note;
}

function formatPlatform(value: string) {
  switch (value) {
    case "android":
      return "Android";
    case "ios":
      return "iOS";
    case "web":
      return "Web";
    default:
      return value;
  }
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

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}

function stringifyJson(value: unknown) {
  if (value == null) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}
