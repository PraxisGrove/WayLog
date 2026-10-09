"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  CheckCircleOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  ImportOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
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
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

import { useAdminSession } from "@/components/admin-session-provider";
import {
  clearAdminServiceConfigSecret,
  createAdminServiceConfig,
  fetchAdminServiceConfigDetail,
  fetchAdminServiceConfigs,
  initializeAdminServiceConfigs,
  replaceServiceConfigItem,
  rotateAdminServiceConfigSecret,
  testAdminServiceConfig,
  updateAdminServiceConfig,
} from "@/lib/admin-service-configs";
import type {
  AdminServiceConfigDetail,
  AdminServiceConfigInitializeResult,
  AdminServiceConfigItem,
  AdminServiceConfigListData,
  AdminServiceConfigUpsertInput,
  AdminServiceSecretStatus,
  AdminServiceTestStatus,
  AdminServiceType,
} from "@/lib/admin-service-config-types";
import type { AdminMember } from "@/lib/admin-types";
import { useAsyncValue } from "@/lib/use-async-value";

const serviceTypeOptions: {
  description: string;
  label: string;
  value: AdminServiceType;
}[] = [
  { description: "Agent 编排、工具和模型入口", label: "Agent", value: "agent" },
  {
    description: "Supabase、数据库和认证能力",
    label: "数据",
    value: "database",
  },
  { description: "大模型、Agent 和生成式能力", label: "LLM", value: "llm" },
  { description: "底图、地理编码和路线能力", label: "地图", value: "map" },
  { description: "地点搜索、详情和缓存来源", label: "POI", value: "poi" },
  {
    description: "Telegram、Email、Push 等通知",
    label: "通知",
    value: "notification",
  },
  { description: "Sentry、诊断与运行监控", label: "监控", value: "monitoring" },
  { description: "天气预报、气象和旅行提示", label: "天气", value: "weather" },
];

const serviceTypeLabelMap = new Map(
  serviceTypeOptions.map((item) => [item.value, item.label]),
);

const testStatusMap: Record<
  AdminServiceTestStatus,
  { color: string; icon: React.ReactNode; label: string }
> = {
  failed: { color: "red", icon: <WarningOutlined />, label: "测试失败" },
  success: { color: "green", icon: <CheckCircleOutlined />, label: "测试通过" },
  untested: { color: "default", icon: <ExperimentOutlined />, label: "未测试" },
};

const secretStatusMap: Record<
  AdminServiceSecretStatus,
  { color: string; label: string }
> = {
  configured: { color: "green", label: "已配置" },
  missing: { color: "default", label: "未配置" },
  test_failed: { color: "red", label: "测试失败" },
};

type ServiceConfigEditorValues = {
  apiKey?: string;
  baseUrl?: string;
  changeReason?: string;
  configText?: string;
  defaultModel?: string;
  displayName?: string;
  enabled?: boolean;
  providerKey?: string;
  serviceType?: AdminServiceType;
};

export function ServiceConfigsPage() {
  return <ServiceConfigsContent />;
}

function ServiceConfigsContent() {
  const { session } = useAdminSession();
  const member =
    session?.status === "authenticated" ? session.member : undefined;
  const [initializing, setInitializing] = useState(false);
  const [serviceType, setServiceType] = useState<AdminServiceType | "all">(
    "llm",
  );
  const [selectedConfigId, setSelectedConfigId] = useState<string>();
  const [editingConfig, setEditingConfig] = useState<
    AdminServiceConfigItem | "new"
  >();
  const [rows, setRows] = useState<AdminServiceConfigItem[]>();
  const loader = useCallback(
    () => fetchAdminServiceConfigs({ serviceType }),
    [serviceType],
  );
  const configs = useAsyncValue<AdminServiceConfigListData>(loader);
  const canCreate = member?.role === "owner";

  useEffect(() => {
    if (configs.value) {
      setRows(configs.value.configs);
    }
  }, [configs.value]);

  const currentRows = rows ?? configs.value?.configs ?? [];
  const columns = createServiceConfigColumns({
    member,
    onEdit: setEditingConfig,
    onOpen: setSelectedConfigId,
    onTest: handleTest,
  });

  function handleSaved(nextDetail: AdminServiceConfigDetail) {
    setRows((current) => {
      const nextItem = toListItem(nextDetail);

      if (!current || current.length === 0) {
        return [nextItem];
      }

      return current.some((item) => item.id === nextItem.id)
        ? replaceServiceConfigItem(current, nextItem)
        : [nextItem, ...current];
    });
    setSelectedConfigId(nextDetail.id);
  }

  async function handleTest(item: AdminServiceConfigItem) {
    try {
      const result = await testAdminServiceConfig(item.id);
      setRows((current) =>
        current ? replaceServiceConfigItem(current, result.config) : current,
      );
      message[result.status === "success" ? "success" : "warning"](
        result.message,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "测试连接失败");
    }
  }

  async function handleInitializeProviders() {
    if (!canCreate) {
      return;
    }

    setInitializing(true);

    try {
      const result = await initializeAdminServiceConfigs();
      configs.reload();
      message.success(formatInitializeMessage(result));
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "初始化 Provider 失败",
      );
    } finally {
      setInitializing(false);
    }
  }

  return (
    <>
      <div className="page-heading service-config-heading">
        <div>
          <span className="eyebrow-label">admin.service_provider_configs</span>
          <h1>服务配置中心</h1>
          <p>
            管理 LLM、地图、POI、通知和监控
            provider。密钥只允许写入、轮换和服务端测试，不会回显到浏览器。
          </p>
        </div>
        <Space className="service-config-heading-actions" size={10} wrap>
          <Tag color={member?.role === "owner" ? "gold" : "blue"}>
            {member?.role ?? "loading"}
          </Tag>
          <Button icon={<ReloadOutlined />} onClick={configs.reload}>
            刷新
          </Button>
          <Popconfirm
            cancelText="取消"
            disabled={!canCreate}
            okButtonProps={{ loading: initializing }}
            okText="初始化"
            onConfirm={handleInitializeProviders}
            title="初始化默认 Provider？"
            description="只补缺 provider，并且只在数据库当前没有密钥时导入服务端环境变量；不会覆盖已有密钥。"
          >
            <Button
              disabled={!canCreate}
              icon={<ImportOutlined />}
              loading={initializing}
            >
              初始化 Provider
            </Button>
          </Popconfirm>
          <Button
            disabled={!canCreate}
            icon={<PlusOutlined />}
            onClick={() => setEditingConfig("new")}
            type="primary"
          >
            新增 Provider
          </Button>
        </Space>
      </div>

      <Alert
        className="service-config-safety-alert"
        message="安全边界：GET API 只返回 masked secret 和 fingerprint；连接测试在 Next API 服务端执行；新增、启停、轮换和清空密钥仅 owner 可做。"
        showIcon
        type="info"
      />

      <Card className="panel-card service-config-filter-panel">
        <Tabs
          activeKey={serviceType}
          items={[
            { key: "all", label: "全部" },
            ...serviceTypeOptions.map((item) => ({
              key: item.value,
              label: item.label,
            })),
          ]}
          onChange={(key) => setServiceType(key as AdminServiceType | "all")}
        />
        <div className="service-config-type-strip">
          {serviceTypeOptions.map((item) => (
            <button
              className={serviceType === item.value ? "active" : ""}
              key={item.value}
              onClick={() => setServiceType(item.value)}
              type="button"
            >
              <span>{item.label}</span>
              <strong>
                {currentRows.filter(
                  (config) => config.serviceType === item.value,
                ).length || 0}
              </strong>
              <em>{item.description}</em>
            </button>
          ))}
        </div>
      </Card>

      {configs.error ? (
        <Alert
          action={<Button onClick={configs.reload}>重试</Button>}
          message={configs.error.message}
          showIcon
          type="error"
        />
      ) : null}

      {configs.value?.warnings.length ? (
        <Alert
          message={configs.value.warnings.slice(0, 3).join(" / ")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className="service-config-table-shell">
        <Table<AdminServiceConfigItem>
          columns={columns}
          dataSource={currentRows}
          loading={configs.loading}
          locale={{
            emptyText: (
              <Empty
                description="暂无服务配置"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1180 }}
        />
      </div>

      <ServiceConfigDetailDrawer
        configId={selectedConfigId}
        member={member}
        onClose={() => setSelectedConfigId(undefined)}
        onEdit={(config) => setEditingConfig(config)}
        onSaved={handleSaved}
      />

      <ServiceConfigEditorDrawer
        config={editingConfig}
        defaultServiceType={serviceType === "all" ? "llm" : serviceType}
        member={member}
        onClose={() => setEditingConfig(undefined)}
        onSaved={(detail) => {
          setEditingConfig(undefined);
          handleSaved(detail);
        }}
      />
    </>
  );
}

function createServiceConfigColumns({
  member,
  onEdit,
  onOpen,
  onTest,
}: {
  member?: AdminMember;
  onEdit: (config: AdminServiceConfigItem) => void;
  onOpen: (configId: string) => void;
  onTest: (config: AdminServiceConfigItem) => void;
}): ColumnsType<AdminServiceConfigItem> {
  const canEdit = member?.role === "owner" || member?.role === "admin";
  const canTest = canEdit;

  return [
    {
      dataIndex: "displayName",
      fixed: "left",
      render: (_value, row) => <ServiceSummaryCell item={row} />,
      title: "Provider",
      width: 330,
    },
    {
      dataIndex: "serviceType",
      render: (value: AdminServiceType) => (
        <Tag color="blue">{serviceTypeLabelMap.get(value) ?? value}</Tag>
      ),
      title: "类型",
      width: 100,
    },
    {
      dataIndex: "enabled",
      render: (value: boolean) => (
        <Tag color={value ? "green" : "default"}>{value ? "启用" : "停用"}</Tag>
      ),
      title: "状态",
      width: 90,
    },
    {
      dataIndex: "maskedSecret",
      render: (_value, row) => <SecretStatus item={row} />,
      title: "密钥",
      width: 180,
    },
    {
      dataIndex: "lastTestStatus",
      render: (_value, row) => <TestStatus item={row} />,
      title: "测试",
      width: 210,
    },
    {
      dataIndex: "updatedAt",
      render: formatDateTime,
      title: "最近更新",
      width: 150,
    },
    {
      dataIndex: "updatedBy",
      render: (value: string | null) => value ?? "未知",
      title: "更新人",
      width: 220,
    },
    {
      fixed: "right",
      key: "actions",
      render: (_value, row) => (
        <Space className="service-config-row-actions" size={6} wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => onOpen(row.id)}
            size="small"
          >
            详情
          </Button>
          <Button
            disabled={!canEdit}
            icon={<EditOutlined />}
            onClick={() => onEdit(row)}
            size="small"
          >
            编辑
          </Button>
          <Button
            disabled={!canTest}
            icon={<ExperimentOutlined />}
            onClick={() => onTest(row)}
            size="small"
          >
            测试
          </Button>
        </Space>
      ),
      title: "操作",
      width: 260,
    },
  ];
}

function ServiceSummaryCell({ item }: { item: AdminServiceConfigItem }) {
  return (
    <div className="service-config-summary-cell">
      <strong>{item.displayName}</strong>
      <span>{item.providerKey}</span>
      <Typography.Text copyable>{item.id}</Typography.Text>
    </div>
  );
}

function SecretStatus({ item }: { item: AdminServiceConfigItem }) {
  const meta = secretStatusMap[item.secretStatus];

  return (
    <Space direction="vertical" size={2}>
      <Tag color={meta.color} icon={<KeyOutlined />}>
        {meta.label}
      </Tag>
      <Typography.Text className="service-config-muted">
        {item.maskedSecret ?? "无密钥"}
      </Typography.Text>
    </Space>
  );
}

function TestStatus({ item }: { item: AdminServiceConfigItem }) {
  const meta = testStatusMap[item.lastTestStatus];

  return (
    <Space direction="vertical" size={2}>
      <Tag color={meta.color} icon={meta.icon}>
        {meta.label}
      </Tag>
      <Typography.Text className="service-config-muted">
        {item.lastTestMessage ?? formatDateTime(item.lastTestedAt)}
      </Typography.Text>
    </Space>
  );
}

function ServiceConfigDetailDrawer({
  configId,
  member,
  onClose,
  onEdit,
  onSaved,
}: {
  configId?: string;
  member?: AdminMember;
  onClose: () => void;
  onEdit: (config: AdminServiceConfigItem) => void;
  onSaved: (detail: AdminServiceConfigDetail) => void;
}) {
  const [testing, setTesting] = useState(false);
  const loader = useCallback(() => {
    if (!configId) {
      return Promise.resolve(undefined);
    }

    return fetchAdminServiceConfigDetail(configId);
  }, [configId]);
  const detail = useAsyncValue<AdminServiceConfigDetail | undefined>(loader);
  const currentDetail =
    detail.value?.id === configId ? detail.value : undefined;
  const canEdit = member?.role === "owner" || member?.role === "admin";
  const canTest = canEdit;

  async function handleTest() {
    if (!currentDetail) {
      return;
    }

    setTesting(true);

    try {
      const result = await testAdminServiceConfig(currentDetail.id);
      detail.reload();
      onSaved({ ...currentDetail, ...result.config });
      message[result.status === "success" ? "success" : "warning"](
        result.message,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "测试连接失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Drawer
      destroyOnClose
      extra={
        <Space className="service-config-drawer-actions" wrap>
          <Button icon={<ReloadOutlined />} onClick={detail.reload}>
            刷新
          </Button>
          <Button
            disabled={!currentDetail || !canTest}
            icon={<ExperimentOutlined />}
            loading={testing}
            onClick={handleTest}
          >
            测试连接
          </Button>
          <Button
            disabled={!currentDetail || !canEdit}
            icon={<EditOutlined />}
            onClick={() => currentDetail && onEdit(currentDetail)}
            type="primary"
          >
            编辑
          </Button>
        </Space>
      }
      onClose={onClose}
      open={Boolean(configId)}
      title={currentDetail ? "服务配置详情" : "加载服务配置"}
      width={820}
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
          <Card className="panel-card service-config-detail-card">
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Space size={[8, 8]} wrap>
                <Tag color="blue">
                  {serviceTypeLabelMap.get(currentDetail.serviceType)}
                </Tag>
                <Tag color={currentDetail.enabled ? "green" : "default"}>
                  {currentDetail.enabled ? "启用" : "停用"}
                </Tag>
                <SecretStatus item={currentDetail} />
                <TestStatus item={currentDetail} />
              </Space>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {currentDetail.displayName}
              </Typography.Title>
              <Typography.Text className="service-config-muted" copyable>
                {currentDetail.id}
              </Typography.Text>
            </Space>
          </Card>

          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Provider Key">
              {currentDetail.providerKey}
            </Descriptions.Item>
            <Descriptions.Item label="API Base URL">
              {currentDetail.baseUrl ?? "未配置"}
            </Descriptions.Item>
            <Descriptions.Item label="默认模型">
              {currentDetail.defaultModel ?? "未配置"}
            </Descriptions.Item>
            <Descriptions.Item label="Masked Secret">
              {currentDetail.maskedSecret ?? "未配置"}
            </Descriptions.Item>
            <Descriptions.Item label="Fingerprint">
              {currentDetail.secretFingerprint ?? "未配置"}
            </Descriptions.Item>
            <Descriptions.Item label="密钥更新时间">
              {formatDateTime(currentDetail.secretUpdatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="最近测试">
              {currentDetail.lastTestMessage ?? "未测试"} ·{" "}
              {formatDateTime(currentDetail.lastTestedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {formatDateTime(currentDetail.updatedAt)} ·{" "}
              {currentDetail.updatedBy ?? "未知"}
            </Descriptions.Item>
          </Descriptions>

          <Card className="panel-card" title="非敏感配置">
            <pre className="service-config-json-text">
              {stringifyJson(currentDetail.config)}
            </pre>
          </Card>

          <Card className="panel-card" title="测试记录">
            {currentDetail.testRuns.length > 0 ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {currentDetail.testRuns.map((run) => (
                  <div className="service-config-audit-item" key={run.id}>
                    <strong>
                      {run.status === "success" ? "测试通过" : "测试失败"}
                    </strong>
                    <span>
                      {formatDateTime(run.createdAt)} ·{" "}
                      {run.createdBy ?? "未知"}
                    </span>
                    <p>{run.message ?? "无消息"}</p>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty
                description="暂无测试记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>

          <Card className="panel-card" title="版本历史">
            {currentDetail.versions.length > 0 ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {currentDetail.versions.map((version) => (
                  <div className="service-config-audit-item" key={version.id}>
                    <strong>版本 {version.versionNo}</strong>
                    <span>
                      {formatDateTime(version.createdAt)} ·{" "}
                      {version.createdBy ?? "未知"}
                    </span>
                    <p>{version.changeReason ?? "未填写修改原因"}</p>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty
                description="暂无版本记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>

          <Card className="panel-card" title="审计日志">
            {currentDetail.auditLogs.length > 0 ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {currentDetail.auditLogs.map((log) => (
                  <div className="service-config-audit-item" key={log.id}>
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
          description="正在加载服务配置"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Drawer>
  );
}

function ServiceConfigEditorDrawer({
  config,
  defaultServiceType,
  member,
  onClose,
  onSaved,
}: {
  config?: AdminServiceConfigItem | "new";
  defaultServiceType: AdminServiceType;
  member?: AdminMember;
  onClose: () => void;
  onSaved: (detail: AdminServiceConfigDetail) => void;
}) {
  const [form] = Form.useForm<ServiceConfigEditorValues>();
  const [saving, setSaving] = useState(false);
  const isNew = config === "new";
  const canOwnerEdit = member?.role === "owner";
  const canEdit = canOwnerEdit || member?.role === "admin";
  const hasSecret = config !== "new" && Boolean(config?.maskedSecret);

  useEffect(() => {
    if (!config) {
      return;
    }

    if (config === "new") {
      form.setFieldsValue({
        configText: "{}",
        enabled: false,
        serviceType: defaultServiceType,
      });
      return;
    }

    form.setFieldsValue({
      baseUrl: config.baseUrl ?? undefined,
      configText: stringifyJson(config.config),
      defaultModel: config.defaultModel ?? undefined,
      displayName: config.displayName,
      enabled: config.enabled,
      providerKey: config.providerKey,
      serviceType: config.serviceType,
    });
  }, [config, defaultServiceType, form]);

  async function handleSave(values: ServiceConfigEditorValues) {
    if (!config || !canEdit) {
      return;
    }

    const input = createEditorInput(values, member);

    if (!input.ok) {
      message.error(input.error);
      return;
    }

    setSaving(true);

    try {
      const detail =
        config === "new"
          ? await createAdminServiceConfig(input.value)
          : await updateAdminServiceConfig(config.id, input.value);
      form.resetFields();
      message.success(config === "new" ? "服务配置已创建" : "服务配置已保存");
      onSaved(detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateSecret() {
    if (!config || config === "new" || !canOwnerEdit) {
      return;
    }

    const values = form.getFieldsValue();
    const apiKey = values.apiKey?.trim();

    if (!apiKey) {
      message.error("请输入新 API Key。");
      return;
    }

    setSaving(true);

    try {
      const detail = await rotateAdminServiceConfigSecret(config.id, {
        apiKey,
        changeReason: values.changeReason,
      });
      form.setFieldValue("apiKey", undefined);
      message.success("服务密钥已轮换");
      onSaved(detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "密钥轮换失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearSecret() {
    if (!config || config === "new" || !canOwnerEdit) {
      return;
    }

    const values = form.getFieldsValue();
    setSaving(true);

    try {
      const detail = await clearAdminServiceConfigSecret(config.id, {
        changeReason: values.changeReason,
      });
      form.setFieldValue("apiKey", undefined);
      message.success("服务密钥已清空");
      onSaved(detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "密钥清空失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={Boolean(config)}
      title={isNew ? "新增 Provider" : "编辑服务配置"}
      width={720}
    >
      <Alert
        className="service-config-editor-alert"
        message={
          canOwnerEdit
            ? "API Key 只会提交到服务端保存，保存后不会回显明文。"
            : "当前角色只能编辑非敏感配置，不能写入、启停或轮换密钥。"
        }
        showIcon
        type={canOwnerEdit ? "info" : "warning"}
      />
      <Form<ServiceConfigEditorValues>
        form={form}
        layout="vertical"
        onFinish={handleSave}
        requiredMark={false}
      >
        <div className="service-config-form-grid">
          <Form.Item
            label="服务类型"
            name="serviceType"
            rules={[{ required: true, message: "请选择服务类型" }]}
          >
            <Select
              disabled={!isNew}
              options={serviceTypeOptions.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="Provider Key"
            name="providerKey"
            rules={[{ required: true, message: "请输入 provider key" }]}
          >
            <Input disabled={!isNew} placeholder="openai / amap / telegram" />
          </Form.Item>
          <Form.Item
            label="Provider 名称"
            name="displayName"
            rules={[{ required: true, message: "请输入 provider 名称" }]}
          >
            <Input disabled={!canEdit} placeholder="OpenAI 主账号" />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch disabled={!canOwnerEdit} />
          </Form.Item>
          <Form.Item label="API Base URL" name="baseUrl">
            <Input
              disabled={!canEdit}
              placeholder="https://api.openai.com/v1"
            />
          </Form.Item>
          <Form.Item label="默认模型 / 模型名" name="defaultModel">
            <Input disabled={!canEdit} placeholder="gpt-4.1-mini" />
          </Form.Item>
        </div>

        <Form.Item label="非敏感 JSON 配置" name="configText">
          <Input.TextArea
            disabled={!canEdit}
            placeholder='{"temperature": 0.3}'
            rows={6}
          />
        </Form.Item>
        <Form.Item label={isNew ? "API Key" : "新 API Key"} name="apiKey">
          <Input.Password
            disabled={!canOwnerEdit}
            placeholder={isNew ? "可选，保存后不回显" : "留空则不修改密钥"}
          />
        </Form.Item>
        <Form.Item label="修改原因" name="changeReason">
          <Input.TextArea
            disabled={!canEdit}
            placeholder="用于版本历史和审计日志"
            rows={3}
          />
        </Form.Item>

        <Space>
          <Button
            disabled={!canEdit}
            htmlType="submit"
            loading={saving}
            type="primary"
          >
            保存
          </Button>
          {!isNew ? (
            <Button
              disabled={!canOwnerEdit}
              icon={<KeyOutlined />}
              loading={saving}
              onClick={handleRotateSecret}
            >
              只轮换密钥
            </Button>
          ) : null}
          {!isNew ? (
            <Popconfirm
              cancelText="取消"
              disabled={!canOwnerEdit || !hasSecret}
              okButtonProps={{ danger: true, loading: saving }}
              okText="清空"
              onConfirm={handleClearSecret}
              title="确认清空这个 provider 的密钥？"
            >
              <Button
                danger
                disabled={!canOwnerEdit || !hasSecret}
                loading={saving}
              >
                清空密钥
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      </Form>
    </Drawer>
  );
}

function createEditorInput(
  values: ServiceConfigEditorValues,
  member?: AdminMember,
):
  | { ok: true; value: AdminServiceConfigUpsertInput }
  | { error: string; ok: false } {
  const configText = values.configText?.trim() || "{}";
  let config: unknown;

  try {
    config = JSON.parse(configText);
  } catch {
    return { error: "非敏感 JSON 配置格式不正确。", ok: false };
  }

  const input: AdminServiceConfigUpsertInput = {
    baseUrl: values.baseUrl?.trim() || null,
    changeReason: values.changeReason?.trim() || null,
    config,
    defaultModel: values.defaultModel?.trim() || null,
    displayName: values.displayName?.trim(),
    providerKey: values.providerKey?.trim(),
    serviceType: values.serviceType,
  };

  if (member?.role === "owner") {
    input.apiKey = values.apiKey?.trim() || undefined;
    input.enabled = Boolean(values.enabled);
  }

  return {
    ok: true,
    value: input,
  };
}

function toListItem(detail: AdminServiceConfigDetail): AdminServiceConfigItem {
  return {
    baseUrl: detail.baseUrl,
    config: detail.config,
    createdAt: detail.createdAt,
    createdBy: detail.createdBy,
    defaultModel: detail.defaultModel,
    displayName: detail.displayName,
    enabled: detail.enabled,
    id: detail.id,
    lastTestMessage: detail.lastTestMessage,
    lastTestStatus: detail.lastTestStatus,
    lastTestedAt: detail.lastTestedAt,
    maskedSecret: detail.maskedSecret,
    providerKey: detail.providerKey,
    secretFingerprint: detail.secretFingerprint,
    secretStatus: detail.secretStatus,
    secretUpdatedAt: detail.secretUpdatedAt,
    serviceType: detail.serviceType,
    updatedAt: detail.updatedAt,
    updatedBy: detail.updatedBy,
  };
}

function formatInitializeMessage(result: AdminServiceConfigInitializeResult) {
  return [
    `新增 ${result.createdCount}`,
    `导入密钥 ${result.importedSecretCount}`,
    `保留已有密钥 ${result.skippedSecretCount}`,
    `缺少环境变量 ${result.missingEnvCount}`,
  ].join(" · ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
