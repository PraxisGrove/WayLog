"use client";

import "@ant-design/v5-patch-for-react-19";
import { Card, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

import { resourceModules, type ResourceModuleKey } from "@/lib/admin-modules";

type RowData = {
  key: string;
  module: string;
  source: string;
  status: string;
};

const columns: ColumnsType<RowData> = [
  {
    dataIndex: "module",
    title: "模块",
  },
  {
    dataIndex: "source",
    title: "数据源",
  },
  {
    dataIndex: "status",
    render: (value: string) => <Tag color="blue">{value}</Tag>,
    title: "状态",
  },
];

const sourceMap: Record<ResourceModuleKey, string> = {
  agent: "public.agent_calls + Edge Function logs",
  diagnostics: "public.crash_reports + sync diagnostics",
  feedback: "public.feedback",
  members: "admin.admin_members + admin.admin_audit_logs",
  poi: "public.poi_cache + POI review tables",
  serviceConfigs: "admin.service_provider_configs + admin.admin_audit_logs",
  users: "auth.users + public.profiles",
};

export function ResourcePlaceholderPage({
  moduleKey,
}: {
  moduleKey: ResourceModuleKey;
}) {
  const module = resourceModules.find((item) => item.key === moduleKey);

  if (!module) {
    return null;
  }

  const rows: RowData[] = [
    {
      key: module.key,
      module: module.label,
      source: sourceMap[module.key],
      status: module.stage,
    },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{module.label}</h1>
          <p>{module.description}</p>
        </div>
        <Tag color="blue">{module.stage}</Tag>
      </div>

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card className="panel-card">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Typography.Text strong>资源入口</Typography.Text>
            <Input.Search
              disabled
              placeholder="数据查询将在下一阶段接入"
              style={{ maxWidth: 420 }}
            />
          </Space>
        </Card>

        <div className="placeholder-table">
          <Table<RowData>
            columns={columns}
            dataSource={rows}
            pagination={false}
            rowKey="key"
          />
        </div>

        <Card className="panel-card">
          <Empty
            description="下一阶段接入真实列表、筛选、详情和审计日志"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </Space>
    </>
  );
}
