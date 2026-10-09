"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
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
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  createAdminPoiEntry,
  deleteAdminPoiEntry,
  fetchAdminPoiDetail,
  fetchAdminPoiEntries,
  mergeAdminPoiEntry,
  updateAdminPoiEntry,
} from "@/lib/admin-poi";
import type {
  AdminPoiCreateInput,
  AdminPoiDetail,
  AdminPoiItem,
  AdminPoiListData,
  AdminPoiReviewStatus,
  AdminPoiUpdateInput,
} from "@/lib/admin-poi-types";
import { useAsyncValue } from "@/lib/use-async-value";

const defaultPageSize = 20;

type PoiPageMode = "manage" | "review";

const statusOptions: {
  color: string;
  icon?: React.ReactNode;
  label: string;
  value: AdminPoiReviewStatus;
}[] = [
  { color: "gold", icon: <WarningOutlined />, label: "待审", value: "pending" },
  {
    color: "green",
    icon: <CheckCircleOutlined />,
    label: "已确认",
    value: "confirmed",
  },
  { color: "orange", label: "需修正", value: "needs_fix" },
  { color: "blue", label: "已合并", value: "merged" },
  { color: "default", label: "忽略", value: "ignored" },
];

const statusLabelMap = new Map(statusOptions.map((item) => [item.value, item]));

type PoiEditorValues = {
  address?: string;
  area?: string;
  category?: string;
  dataSource?: string;
  detailsText?: string;
  externalRefsText?: string;
  iconKey?: string;
  latitude?: number | null;
  longitude?: number | null;
  name: string;
  photosText?: string;
  poiGroup?: string;
  poiType?: string;
  rawSummary?: string;
  reviewNote?: string;
  reviewStatus: AdminPoiReviewStatus;
  sourceNote?: string;
};

type PoiCreateValues = PoiEditorValues & {
  amapPoiId: string;
};

type MergeFormValues = {
  note?: string;
  targetAmapPoiId: string;
};

export function PoiReviewPage() {
  return <PoiReviewContent />;
}

function PoiReviewContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const initialStatus = readInitialReviewStatus(searchParams.get("status"));
  const initialCategory = searchParams.get("category")?.trim() ?? "";
  const [createForm] = Form.useForm<PoiCreateValues>();
  const [mode, setMode] = useState<PoiPageMode>(
    initialStatus === "all" ? "manage" : "review",
  );
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [reviewStatus, setReviewStatus] = useState<
    AdminPoiReviewStatus | "all"
  >(initialStatus);
  const [category, setCategory] = useState(initialCategory);
  const [page, setPage] = useState(1);
  const [selectedPoiId, setSelectedPoiId] = useState<string>();
  const [quickUpdatingId, setQuickUpdatingId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const loader = useCallback(
    () =>
      fetchAdminPoiEntries({
        category,
        page,
        pageSize: defaultPageSize,
        query: submittedQuery,
        reviewStatus,
      }),
    [category, page, reviewStatus, submittedQuery],
  );
  const pois = useAsyncValue<AdminPoiListData>(loader);
  const columns = createPoiColumns({
    mode,
    onOpen: setSelectedPoiId,
    onQuickStatus: handleQuickStatus,
    onSoftDelete: handleSoftDelete,
    quickUpdatingId,
  });

  function handleSearch(nextQuery = query) {
    setPage(1);
    setSubmittedQuery(nextQuery.trim());
  }

  function handleStatusChange(nextStatus: AdminPoiReviewStatus | "all") {
    setPage(1);
    setReviewStatus(nextStatus);
  }

  function handleCategoryChange(nextCategory: string) {
    setPage(1);
    setCategory(nextCategory.trim());
  }

  function handleModeChange(nextMode: PoiPageMode) {
    setMode(nextMode);
    setPage(1);

    if (nextMode === "manage") {
      setReviewStatus("all");
      return;
    }

    if (reviewStatus === "all") {
      setReviewStatus("pending");
    }
  }

  function handleOpenCreate() {
    createForm.resetFields();
    createForm.setFieldsValue({
      dataSource: "admin",
      reviewStatus: "pending",
    });
    setCreateOpen(true);
  }

  async function handleCreatePoi(values: PoiCreateValues) {
    const input = createCreateInput(values);

    if (!input.ok) {
      message.error(input.error);
      return;
    }

    setCreating(true);

    try {
      const detail = await createAdminPoiEntry(input.value);
      createForm.resetFields();
      setCreateOpen(false);
      setSelectedPoiId(detail.amapPoiId);
      pois.reload();
      message.success("POI 已新增");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "新增 POI 失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleSoftDelete(poi: AdminPoiItem) {
    setQuickUpdatingId(poi.amapPoiId);

    try {
      await deleteAdminPoiEntry(poi.amapPoiId);
      pois.reload();
      message.success("POI 已软删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除 POI 失败");
    } finally {
      setQuickUpdatingId(undefined);
    }
  }

  async function handleQuickStatus(
    poi: AdminPoiItem,
    nextStatus: AdminPoiReviewStatus,
  ) {
    setQuickUpdatingId(poi.amapPoiId);

    try {
      await updateAdminPoiEntry(poi.amapPoiId, {
        reviewNote: buildQuickReviewNote(poi, nextStatus),
        reviewStatus: nextStatus,
      });
      pois.reload();
      message.success(
        `POI 已${statusLabelMap.get(nextStatus)?.label ?? "更新"}`,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "快捷审核失败");
    } finally {
      setQuickUpdatingId(undefined);
    }
  }

  return (
    <>
      <div className="page-heading poi-heading">
        <div>
          <span className="eyebrow-label">public.poi_cache</span>
          <h1>POI 审查与编辑</h1>
          <p>
            搜索、审核、修正和合并公共地点缓存，优先处理会影响 Agent
            添加地点与收藏地点的数据质量问题。
          </p>
        </div>
        <Space className="poi-heading-actions" size={10} wrap>
          <Segmented<PoiPageMode>
            onChange={handleModeChange}
            options={[
              { label: "审查队列", value: "review" },
              { label: "全量管理", value: "manage" },
            ]}
            value={mode}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            type="primary"
          >
            新增 POI
          </Button>
          <Tag color="blue">已接入</Tag>
          <Button icon={<ReloadOutlined />} onClick={pois.reload}>
            刷新
          </Button>
        </Space>
      </div>

      <Card className="panel-card poi-filter-panel">
        <div className="poi-filter-row">
          <Input.Search
            allowClear
            enterButton={
              <Button icon={<SearchOutlined />} type="primary">
                搜索
              </Button>
            }
            onChange={(event) => setQuery(event.target.value)}
            onSearch={handleSearch}
            placeholder="搜索 POI ID、名称、地址、区域"
            size="large"
            value={query}
          />
          <Select
            onChange={handleStatusChange}
            options={[
              { label: "全部状态", value: "all" },
              ...statusOptions.map((status) => ({
                label: status.label,
                value: status.value,
              })),
            ]}
            size="large"
            value={reviewStatus}
          />
          <Input
            allowClear
            onChange={(event) => handleCategoryChange(event.target.value)}
            placeholder="分类"
            size="large"
            value={category}
          />
        </div>

        <div className="poi-status-strip">
          {statusOptions.map((status) => (
            <button
              className={reviewStatus === status.value ? "active" : ""}
              key={status.value}
              onClick={() => handleStatusChange(status.value)}
              type="button"
            >
              <span>{status.label}</span>
              <strong>
                {(pois.value?.statusCounts[status.value] ?? 0).toLocaleString(
                  "zh-CN",
                )}
              </strong>
            </button>
          ))}
        </div>

        <div className="poi-filter-meta">
          <span>
            {submittedQuery
              ? `当前关键词：${submittedQuery}`
              : mode === "manage"
                ? "全量管理显示全部状态，按最近更新时间排序"
                : "审查队列默认显示待审地点，按最近更新时间排序"}
          </span>
          <span>共 {pois.value?.total ?? 0} 条匹配 POI</span>
        </div>
      </Card>

      {pois.error ? (
        <Alert
          action={<Button onClick={pois.reload}>重试</Button>}
          message={pois.error.message}
          showIcon
          type="error"
        />
      ) : null}

      {pois.value?.warnings.length ? (
        <Alert
          message={pois.value.warnings.slice(0, 3).join(" / ")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className="poi-table-shell">
        <Table<AdminPoiItem>
          columns={columns}
          dataSource={pois.value?.pois ?? []}
          loading={pois.loading}
          locale={{
            emptyText: (
              <Empty
                description="没有找到匹配 POI"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={{
            current: page,
            onChange: setPage,
            pageSize: defaultPageSize,
            showSizeChanger: false,
            total: pois.value?.total ?? 0,
          }}
          rowKey="amapPoiId"
          scroll={{ x: 1180 }}
        />
      </div>

      <PoiDetailDrawer
        amapPoiId={selectedPoiId}
        onClose={() => setSelectedPoiId(undefined)}
        onDeleted={() => {
          setSelectedPoiId(undefined);
          pois.reload();
        }}
        onSaved={() => {
          pois.reload();
        }}
      />

      <CreatePoiModal
        form={createForm}
        loading={creating}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreatePoi}
        open={createOpen}
      />
    </>
  );
}

function createPoiColumns({
  mode,
  onOpen,
  onQuickStatus,
  onSoftDelete,
  quickUpdatingId,
}: {
  mode: PoiPageMode;
  onOpen: (amapPoiId: string) => void;
  onQuickStatus: (poi: AdminPoiItem, nextStatus: AdminPoiReviewStatus) => void;
  onSoftDelete: (poi: AdminPoiItem) => void;
  quickUpdatingId?: string;
}): ColumnsType<AdminPoiItem> {
  return [
    {
      dataIndex: "name",
      fixed: "left",
      render: (_value, row) => <PoiNameCell poi={row} />,
      title: "地点",
      width: 320,
    },
    {
      dataIndex: "reviewStatus",
      render: (value: AdminPoiReviewStatus, row) => (
        <Space direction="vertical" size={4}>
          <StatusTag status={value} />
          {row.mergedIntoAmapPoiId ? (
            <Typography.Text className="poi-muted" copyable>
              {row.mergedIntoAmapPoiId}
            </Typography.Text>
          ) : null}
        </Space>
      ),
      title: "审核",
      width: 150,
    },
    {
      dataIndex: "category",
      render: (_value, row) => (
        <Space size={[6, 6]} wrap>
          {row.category ? <Tag>{row.category}</Tag> : <Tag>未分类</Tag>}
          {row.poiGroup ? <Tag color="blue">{row.poiGroup}</Tag> : null}
        </Space>
      ),
      title: "分类",
      width: 170,
    },
    {
      dataIndex: "latitude",
      render: (_value, row) =>
        row.latitude != null && row.longitude != null
          ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
          : "暂无坐标",
      title: "坐标",
      width: 190,
    },
    {
      dataIndex: "dataSource",
      render: (_value, row) => row.dataSource ?? row.sourceNote ?? "未标注",
      title: "来源",
      width: 160,
    },
    {
      dataIndex: "updatedAt",
      render: formatDateTime,
      title: "更新时间",
      width: 150,
    },
    {
      fixed: "right",
      key: "actions",
      render: (_value, row) => (
        <PoiRowActions
          loading={quickUpdatingId === row.amapPoiId}
          mode={mode}
          onOpen={() => onOpen(row.amapPoiId)}
          onQuickStatus={(nextStatus) => onQuickStatus(row, nextStatus)}
          onSoftDelete={() => onSoftDelete(row)}
          poi={row}
        />
      ),
      title: "操作",
      width: 280,
    },
  ];
}

function PoiRowActions({
  loading,
  mode,
  onOpen,
  onQuickStatus,
  onSoftDelete,
  poi,
}: {
  loading: boolean;
  mode: PoiPageMode;
  onOpen: () => void;
  onQuickStatus: (nextStatus: AdminPoiReviewStatus) => void;
  onSoftDelete: () => void;
  poi: AdminPoiItem;
}) {
  const deleteLabel = mode === "manage" ? "删除" : "忽略";

  return (
    <Space className="poi-row-actions" size={6} wrap>
      <Button
        icon={<EditOutlined />}
        onClick={onOpen}
        size="small"
        type="primary"
      >
        {mode === "manage" ? "编辑" : "审查"}
      </Button>
      <Button
        disabled={poi.reviewStatus === "confirmed"}
        icon={<CheckCircleOutlined />}
        loading={loading}
        onClick={() => onQuickStatus("confirmed")}
        size="small"
      >
        确认
      </Button>
      <Button
        disabled={poi.reviewStatus === "needs_fix"}
        loading={loading}
        onClick={() => onQuickStatus("needs_fix")}
        size="small"
      >
        修正
      </Button>
      <Popconfirm
        cancelText="取消"
        okText={mode === "manage" ? "软删除" : "忽略"}
        onConfirm={
          mode === "manage" ? onSoftDelete : () => onQuickStatus("ignored")
        }
        title={
          mode === "manage"
            ? "确认将这个 POI 软删除为忽略状态？"
            : "确认忽略这个 POI？"
        }
      >
        <Button
          danger
          disabled={poi.reviewStatus === "ignored"}
          icon={
            mode === "manage" ? <DeleteOutlined /> : <CloseCircleOutlined />
          }
          loading={loading}
          size="small"
        >
          {deleteLabel}
        </Button>
      </Popconfirm>
    </Space>
  );
}
function PoiNameCell({ poi }: { poi: AdminPoiItem }) {
  return (
    <div className="poi-name-cell">
      <strong>{poi.name || "未命名地点"}</strong>
      <span>{poi.address || poi.area || "暂无地址"}</span>
      <Typography.Text copyable>{poi.amapPoiId}</Typography.Text>
    </div>
  );
}

function PoiDetailDrawer({
  amapPoiId,
  onClose,
  onDeleted,
  onSaved,
}: {
  amapPoiId?: string;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<PoiEditorValues>();
  const [mergeForm] = Form.useForm<MergeFormValues>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const loader = useCallback(() => {
    if (!amapPoiId) {
      return Promise.resolve(undefined);
    }

    return fetchAdminPoiDetail(amapPoiId);
  }, [amapPoiId]);
  const detail = useAsyncValue<AdminPoiDetail | undefined>(loader);

  useEffect(() => {
    if (!detail.value) {
      return;
    }

    form.setFieldsValue(createEditorValues(detail.value));
  }, [detail.value, form]);

  useEffect(() => {
    if (!amapPoiId) {
      mergeForm.resetFields();
      setMergeOpen(false);
    }
  }, [amapPoiId, mergeForm]);

  async function handleSave(values: PoiEditorValues) {
    if (!amapPoiId) {
      return;
    }

    const input = createUpdateInput(values);

    if (!input.ok) {
      message.error(input.error);
      return;
    }

    setSaving(true);

    try {
      const nextDetail = await updateAdminPoiEntry(amapPoiId, input.value);
      form.setFieldsValue(createEditorValues(nextDetail));
      detail.reload();
      onSaved();
      message.success("POI 已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleMerge(values: MergeFormValues) {
    if (!amapPoiId) {
      return;
    }

    setMerging(true);

    try {
      const nextDetail = await mergeAdminPoiEntry(amapPoiId, {
        note: values.note,
        targetAmapPoiId: values.targetAmapPoiId,
      });
      form.setFieldsValue(createEditorValues(nextDetail));
      detail.reload();
      onSaved();
      setMergeOpen(false);
      message.success("POI 已标记为合并");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "合并失败");
    } finally {
      setMerging(false);
    }
  }

  const currentDetail =
    detail.value?.amapPoiId === amapPoiId ? detail.value : undefined;
  async function handleDetailStatus(nextStatus: AdminPoiReviewStatus) {
    if (!amapPoiId || !currentDetail) {
      return;
    }

    setSaving(true);

    try {
      const nextDetail = await updateAdminPoiEntry(amapPoiId, {
        reviewNote: buildQuickReviewNote(currentDetail, nextStatus),
        reviewStatus: nextStatus,
      });
      form.setFieldsValue(createEditorValues(nextDetail));
      detail.reload();
      onSaved();
      message.success(
        `POI 已${statusLabelMap.get(nextStatus)?.label ?? "更新"}`,
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "审核状态更新失败",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(hard: boolean) {
    if (!amapPoiId || !currentDetail) {
      return;
    }

    setDeleting(true);

    try {
      await deleteAdminPoiEntry(amapPoiId, { hard });
      onDeleted();
      message.success(hard ? "POI 已物理删除" : "POI 已软删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除 POI 失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Drawer
      destroyOnClose
      extra={
        <Space className="poi-drawer-actions" wrap>
          <Button icon={<ReloadOutlined />} onClick={detail.reload}>
            刷新
          </Button>
          <Button
            disabled={
              !currentDetail || currentDetail.reviewStatus === "confirmed"
            }
            icon={<CheckCircleOutlined />}
            loading={saving}
            onClick={() => handleDetailStatus("confirmed")}
          >
            确认
          </Button>
          <Button
            disabled={
              !currentDetail || currentDetail.reviewStatus === "needs_fix"
            }
            loading={saving}
            onClick={() => handleDetailStatus("needs_fix")}
          >
            需修正
          </Button>
          <Popconfirm
            cancelText="取消"
            okText="忽略"
            onConfirm={() => handleDetailStatus("ignored")}
            title="确认忽略这个 POI？"
          >
            <Button
              danger
              disabled={
                !currentDetail || currentDetail.reviewStatus === "ignored"
              }
              icon={<CloseCircleOutlined />}
              loading={saving}
            >
              忽略
            </Button>
          </Popconfirm>
          <Button
            icon={<MergeCellsOutlined />}
            onClick={() => {
              mergeForm.resetFields();
              setMergeOpen(true);
            }}
          >
            合并
          </Button>
        </Space>
      }
      onClose={onClose}
      open={Boolean(amapPoiId)}
      title={currentDetail?.name ?? "POI 详情"}
      width={720}
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
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="POI ID">
              <Typography.Text copyable>
                {currentDetail.amapPoiId}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="版本">
              v{currentDetail.version ?? 0} ·{" "}
              {formatDateTime(currentDetail.updatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="审核">
              <StatusTag status={currentDetail.reviewStatus} />
            </Descriptions.Item>
          </Descriptions>

          <Form<PoiEditorValues>
            form={form}
            layout="vertical"
            onFinish={handleSave}
            requiredMark={false}
          >
            <div className="poi-form-grid">
              <Form.Item
                label="名称"
                name="name"
                rules={[{ required: true, message: "请输入名称" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label="审核状态" name="reviewStatus">
                <Select
                  options={statusOptions.map((status) => ({
                    label: status.label,
                    value: status.value,
                  }))}
                />
              </Form.Item>
              <Form.Item label="地址" name="address">
                <Input />
              </Form.Item>
              <Form.Item label="区域" name="area">
                <Input />
              </Form.Item>
              <Form.Item label="分类" name="category">
                <Input />
              </Form.Item>
              <Form.Item label="来源" name="dataSource">
                <Input placeholder="amap / admin / import" />
              </Form.Item>
              <Form.Item label="纬度" name="latitude">
                <InputNumber
                  max={90}
                  min={-90}
                  precision={7}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="经度" name="longitude">
                <InputNumber
                  max={180}
                  min={-180}
                  precision={7}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="图标" name="iconKey">
                <Input />
              </Form.Item>
              <Form.Item label="POI 分组" name="poiGroup">
                <Input />
              </Form.Item>
              <Form.Item label="POI 类型" name="poiType">
                <Input />
              </Form.Item>
              <Form.Item label="来源说明" name="sourceNote">
                <Input />
              </Form.Item>
            </div>

            <Form.Item label="审核备注" name="reviewNote">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="原始数据摘要" name="rawSummary">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="details JSON" name="detailsText">
              <Input.TextArea rows={6} spellCheck={false} />
            </Form.Item>
            <Form.Item label="externalRefs JSON" name="externalRefsText">
              <Input.TextArea rows={5} spellCheck={false} />
            </Form.Item>
            <Form.Item label="photos JSON" name="photosText">
              <Input.TextArea rows={4} spellCheck={false} />
            </Form.Item>

            <Space>
              <Button htmlType="submit" loading={saving} type="primary">
                保存修改
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() =>
                  window.open(
                    `https://uri.amap.com/marker?position=${currentDetail.longitude ?? ""},${currentDetail.latitude ?? ""}&name=${encodeURIComponent(currentDetail.name)}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                高德坐标
              </Button>
            </Space>
          </Form>

          <Card className="panel-card" title="审计日志">
            {currentDetail.auditLogs.length > 0 ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {currentDetail.auditLogs.map((log) => (
                  <div className="poi-audit-item" key={log.id}>
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

          <Card className="panel-card poi-danger-card" title="删除 POI">
            <Space className="poi-danger-actions" wrap>
              <Popconfirm
                cancelText="取消"
                okText="软删除"
                onConfirm={() => handleDelete(false)}
                title="确认将这个 POI 软删除为忽略状态？"
              >
                <Button danger icon={<DeleteOutlined />} loading={deleting}>
                  软删除
                </Button>
              </Popconfirm>
              <Popconfirm
                cancelText="取消"
                okButtonProps={{ danger: true }}
                okText="物理删除"
                onConfirm={() => handleDelete(true)}
                title="物理删除不可恢复，确认继续？"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleting}
                  type="primary"
                >
                  物理删除
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        </Space>
      ) : (
        <Empty
          description="正在加载 POI"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      <Modal
        confirmLoading={merging}
        destroyOnClose
        onCancel={() => setMergeOpen(false)}
        onOk={() => mergeForm.submit()}
        open={mergeOpen}
        title="合并重复 POI"
      >
        <Form<MergeFormValues>
          form={mergeForm}
          layout="vertical"
          onFinish={handleMerge}
        >
          <Form.Item
            label="目标 POI ID"
            name="targetAmapPoiId"
            rules={[{ required: true, message: "请输入目标 POI ID" }]}
          >
            <Input placeholder="保留的 amap_poi_id" />
          </Form.Item>
          <Form.Item label="合并备注" name="note">
            <Input.TextArea rows={3} placeholder="说明重复原因或保留依据" />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}

function CreatePoiModal({
  form,
  loading,
  onCancel,
  onSubmit,
  open,
}: {
  form: ReturnType<typeof Form.useForm<PoiCreateValues>>[0];
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: PoiCreateValues) => void;
  open: boolean;
}) {
  return (
    <Modal
      confirmLoading={loading}
      destroyOnClose
      onCancel={onCancel}
      onOk={() => form.submit()}
      open={open}
      title="新增 POI"
      width={720}
    >
      <Form<PoiCreateValues>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        requiredMark={false}
      >
        <div className="poi-form-grid">
          <Form.Item
            label="POI ID"
            name="amapPoiId"
            rules={[{ required: true, message: "请输入 POI ID" }]}
          >
            <Input placeholder="高德 amap_poi_id" />
          </Form.Item>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="审核状态" name="reviewStatus">
            <Select
              options={statusOptions.map((status) => ({
                label: status.label,
                value: status.value,
              }))}
            />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Form.Item label="区域" name="area">
            <Input />
          </Form.Item>
          <Form.Item label="纬度" name="latitude">
            <InputNumber
              max={90}
              min={-90}
              precision={7}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="经度" name="longitude">
            <InputNumber
              max={180}
              min={-180}
              precision={7}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="来源" name="dataSource">
            <Input placeholder="admin / amap / import" />
          </Form.Item>
          <Form.Item label="图标" name="iconKey">
            <Input />
          </Form.Item>
          <Form.Item label="POI 分组" name="poiGroup">
            <Input />
          </Form.Item>
          <Form.Item label="POI 类型" name="poiType">
            <Input />
          </Form.Item>
        </div>

        <Form.Item label="来源说明" name="sourceNote">
          <Input />
        </Form.Item>
        <Form.Item label="审核备注" name="reviewNote">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="原始数据摘要" name="rawSummary">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="details JSON" name="detailsText">
          <Input.TextArea rows={5} spellCheck={false} />
        </Form.Item>
        <Form.Item label="externalRefs JSON" name="externalRefsText">
          <Input.TextArea rows={4} spellCheck={false} />
        </Form.Item>
        <Form.Item label="photos JSON" name="photosText">
          <Input.TextArea rows={4} spellCheck={false} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
function StatusTag({ status }: { status: AdminPoiReviewStatus }) {
  const meta = statusLabelMap.get(status) ?? statusLabelMap.get("pending");

  return (
    <Tag color={meta?.color} icon={meta?.icon}>
      {meta?.label ?? status}
    </Tag>
  );
}

function buildQuickReviewNote(
  poi: AdminPoiItem,
  nextStatus: AdminPoiReviewStatus,
) {
  const label = statusLabelMap.get(nextStatus)?.label ?? nextStatus;
  const existing = poi.reviewNote?.trim();
  const note = `后台快捷操作：${label}`;

  return existing ? `${existing}\n${note}` : note;
}
function readInitialReviewStatus(
  value: string | null,
): AdminPoiReviewStatus | "all" {
  if (value === "all") {
    return "all";
  }

  return statusLabelMap.has(value as AdminPoiReviewStatus)
    ? (value as AdminPoiReviewStatus)
    : "pending";
}

function createEditorValues(poi: AdminPoiDetail): PoiEditorValues {
  return {
    address: poi.address ?? undefined,
    area: poi.area ?? undefined,
    category: poi.category ?? undefined,
    dataSource: poi.dataSource ?? undefined,
    detailsText: stringifyJson(poi.details),
    externalRefsText: stringifyJson(poi.externalRefs),
    iconKey: poi.iconKey ?? undefined,
    latitude: poi.latitude,
    longitude: poi.longitude,
    name: poi.name,
    photosText: stringifyJson(poi.photos),
    poiGroup: poi.poiGroup ?? undefined,
    poiType: poi.poiType ?? undefined,
    rawSummary: poi.rawSummary ?? undefined,
    reviewNote: poi.reviewNote ?? undefined,
    reviewStatus: poi.reviewStatus,
    sourceNote: poi.sourceNote ?? undefined,
  };
}

function createCreateInput(
  values: PoiCreateValues,
): { ok: true; value: AdminPoiCreateInput } | { error: string; ok: false } {
  const update = createUpdateInput(values);

  if (!update.ok) {
    return update;
  }

  const amapPoiId = values.amapPoiId?.trim();
  const name = update.value.name?.trim();

  if (!amapPoiId) {
    return { error: "POI ID 不能为空。", ok: false };
  }

  if (!name) {
    return { error: "POI 名称不能为空。", ok: false };
  }

  return {
    ok: true,
    value: {
      ...update.value,
      amapPoiId,
      name,
    },
  };
}

function createUpdateInput(
  values: PoiEditorValues,
): { ok: true; value: AdminPoiUpdateInput } | { error: string; ok: false } {
  const details = parseJsonField(values.detailsText, "details");
  const externalRefs = parseJsonField(values.externalRefsText, "externalRefs");
  const photos = parseJsonField(values.photosText, "photos");

  if (!details.ok) return details;
  if (!externalRefs.ok) return externalRefs;
  if (!photos.ok) return photos;

  return {
    ok: true,
    value: {
      address: emptyToNull(values.address),
      area: emptyToNull(values.area),
      category: emptyToNull(values.category),
      dataSource: emptyToNull(values.dataSource),
      details: details.value,
      externalRefs: externalRefs.value,
      iconKey: emptyToNull(values.iconKey),
      latitude: values.latitude ?? null,
      longitude: values.longitude ?? null,
      name: values.name,
      photos: photos.value,
      poiGroup: emptyToNull(values.poiGroup),
      poiType: emptyToNull(values.poiType),
      rawSummary: emptyToNull(values.rawSummary),
      reviewNote: emptyToNull(values.reviewNote),
      reviewStatus: values.reviewStatus,
      sourceNote: emptyToNull(values.sourceNote),
    },
  };
}

function parseJsonField(
  value: string | undefined,
  label: string,
): { ok: true; value: unknown } | { error: string; ok: false } {
  if (!value?.trim()) {
    return { ok: true, value: null };
  }

  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { error: `${label} 不是有效 JSON。`, ok: false };
  }
}

function stringifyJson(value: unknown) {
  if (value == null) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
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
