"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { useAdminSession } from "@/components/admin-session-provider";
import {
  createAdminMember,
  fetchAdminMembers,
  replaceAdminMemberItem,
  updateAdminMember,
} from "@/lib/admin-members";
import type {
  AdminAssignableRole,
  AdminMemberCreateInput,
  AdminMemberListItem,
  AdminMembersData,
  AdminMemberUpdateInput,
} from "@/lib/admin-members-types";
import type { AdminRole } from "@/lib/admin-types";
import { useAsyncValue } from "@/lib/use-async-value";

type AdminMemberEditorValues = {
  displayName?: string;
  enabled?: boolean;
  note?: string;
  role?: AdminAssignableRole;
  userRef?: string;
};

const roleOptions: {
  description: string;
  label: string;
  value: AdminAssignableRole;
}[] = [
  { description: "日常配置、审核和反馈处理。", label: "Admin", value: "admin" },
  {
    description: "排障、日志和技术诊断入口。",
    label: "Developer",
    value: "developer",
  },
  {
    description: "只读查看后台数据，不允许写入。",
    label: "Readonly",
    value: "readonly",
  },
];

const roleCopy: Record<AdminRole, { color: string; label: string }> = {
  admin: { color: "blue", label: "Admin" },
  developer: { color: "purple", label: "Developer" },
  owner: { color: "gold", label: "Owner" },
  readonly: { color: "default", label: "Readonly" },
};

const roleRank: Record<AdminRole, number> = {
  admin: 3,
  developer: 2,
  owner: 4,
  readonly: 1,
};

export function AdminMembersPage() {
  return <AdminMembersContent />;
}

function AdminMembersContent() {
  const { session } = useAdminSession();
  const members = useAsyncValue<AdminMembersData>(fetchAdminMembers);
  const [rows, setRows] = useState<AdminMemberListItem[]>();
  const [editingMember, setEditingMember] = useState<
    AdminMemberListItem | "new"
  >();
  const sessionRole =
    session?.status === "authenticated" ? session.member.role : undefined;
  const currentRole = members.value?.currentRole ?? sessionRole ?? "readonly";
  const currentRoleCopy = roleCopy[currentRole];
  const currentRows = rows ?? members.value?.members ?? [];
  const editableRoles = useMemo(
    () => roleOptions.filter((role) => canManageRole(currentRole, role.value)),
    [currentRole],
  );
  const columns = useMemo(
    () =>
      createAdminMemberColumns({
        currentRole,
        onEdit: setEditingMember,
      }),
    [currentRole],
  );

  useEffect(() => {
    if (members.value) {
      setRows(members.value.members);
    }
  }, [members.value]);

  function handleSaved(nextMember: AdminMemberListItem) {
    setRows((current) => {
      if (!current || current.length === 0) {
        return [nextMember];
      }

      return current.some((item) => item.userId === nextMember.userId)
        ? replaceAdminMemberItem(current, nextMember)
        : [nextMember, ...current];
    });
  }

  return (
    <>
      <div className="page-heading admin-members-heading">
        <div>
          <span className="eyebrow-label">admin.admin_members</span>
          <h1>管理员成员 / 权限账户管理</h1>
          <p>
            Supabase Auth 负责真实登录账号；这里仅管理 Auth
            用户在后台的角色、启停状态和操作留痕。
          </p>
        </div>
        <Space className="admin-members-heading-actions" size={10} wrap>
          <Tag color={currentRoleCopy.color}>{currentRoleCopy.label}</Tag>
          <Button icon={<ReloadOutlined />} onClick={members.reload}>
            刷新
          </Button>
          <Button
            disabled={editableRoles.length === 0}
            icon={<PlusOutlined />}
            onClick={() => setEditingMember("new")}
            type="primary"
          >
            添加成员
          </Button>
        </Space>
      </div>

      <Alert
        className="admin-members-safety-alert"
        message="权限边界：只能管理比自己权限更低的后台成员；owner 角色不在页面创建；所有新增、角色变更和启停都会写入 admin.admin_audit_logs。"
        showIcon
        type="info"
      />

      <Card className="panel-card admin-members-summary-panel">
        <div className="admin-members-summary-grid">
          <SummaryItem
            label="后台成员"
            value={(members.value?.total ?? currentRows.length).toLocaleString(
              "zh-CN",
            )}
          />
          <SummaryItem
            label="已启用"
            value={currentRows
              .filter((item) => item.enabled)
              .length.toLocaleString("zh-CN")}
          />
          <SummaryItem
            label="可授权角色"
            value={
              editableRoles.map((role) => role.label).join(" / ") || "暂无"
            }
          />
        </div>
      </Card>

      {members.error ? (
        <Alert
          action={
            <Button onClick={members.reload} size="small">
              重试
            </Button>
          }
          message={members.error.message}
          showIcon
          type="error"
        />
      ) : null}

      {members.value?.warnings.length ? (
        <Alert
          message={members.value.warnings.slice(0, 2).join(" / ")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className="admin-members-table-shell">
        <Table<AdminMemberListItem>
          columns={columns}
          dataSource={currentRows}
          loading={members.loading}
          locale={{
            emptyText: (
              <Empty
                description="暂无后台成员"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={false}
          rowKey="userId"
          scroll={{ x: 980 }}
        />
      </div>

      <AdminMemberEditorDrawer
        currentRole={currentRole}
        editableRoles={editableRoles}
        member={editingMember}
        onClose={() => setEditingMember(undefined)}
        onSaved={handleSaved}
      />
    </>
  );
}

function createAdminMemberColumns({
  currentRole,
  onEdit,
}: {
  currentRole: AdminRole;
  onEdit: (member: AdminMemberListItem) => void;
}): ColumnsType<AdminMemberListItem> {
  return [
    {
      fixed: "left",
      render: (_value, row) => <AdminMemberIdentityCell member={row} />,
      title: "后台成员",
      width: 320,
    },
    {
      dataIndex: "role",
      render: (role: AdminRole) => (
        <Tag color={roleCopy[role].color}>{roleCopy[role].label}</Tag>
      ),
      title: "角色",
      width: 120,
    },
    {
      dataIndex: "enabled",
      render: (enabled: boolean) => (
        <Tag color={enabled ? "green" : "default"}>
          {enabled ? "已启用" : "已停用"}
        </Tag>
      ),
      title: "状态",
      width: 110,
    },
    {
      dataIndex: "lastSignInAt",
      render: (value: string | null) => formatDateTime(value),
      title: "最近登录",
      width: 150,
    },
    {
      dataIndex: "updatedAt",
      render: (value: string) => formatDateTime(value),
      title: "权限更新时间",
      width: 150,
    },
    {
      dataIndex: "note",
      render: (value: string | null) => (
        <Typography.Text className="admin-members-note" type="secondary">
          {value || "暂无备注"}
        </Typography.Text>
      ),
      title: "备注",
      width: 220,
    },
    {
      key: "actions",
      render: (_value, row) => {
        const editable = canManageRole(currentRole, row.role);

        return (
          <Button
            disabled={!editable}
            icon={<EditOutlined />}
            onClick={() => onEdit(row)}
            type="primary"
          >
            编辑
          </Button>
        );
      },
      title: "操作",
      width: 110,
    },
  ];
}

function AdminMemberIdentityCell({ member }: { member: AdminMemberListItem }) {
  const displayName = member.displayName ?? member.email ?? "后台成员";
  const contact = member.email ?? member.phone ?? "未绑定邮箱/手机号";

  return (
    <div className="admin-members-identity-cell">
      <Avatar size={42} icon={<SafetyCertificateOutlined />}>
        {displayName.slice(0, 1).toUpperCase()}
      </Avatar>
      <div>
        <Typography.Text strong>{displayName}</Typography.Text>
        <span>{contact}</span>
        <code>{member.userId}</code>
      </div>
    </div>
  );
}

function AdminMemberEditorDrawer({
  currentRole,
  editableRoles,
  member,
  onClose,
  onSaved,
}: {
  currentRole: AdminRole;
  editableRoles: {
    description: string;
    label: string;
    value: AdminAssignableRole;
  }[];
  member?: AdminMemberListItem | "new";
  onClose: () => void;
  onSaved: (member: AdminMemberListItem) => void;
}) {
  const [form] = Form.useForm<AdminMemberEditorValues>();
  const [saving, setSaving] = useState(false);
  const isNew = member === "new";
  const open = Boolean(member);

  useEffect(() => {
    if (!member) {
      return;
    }

    form.resetFields();

    if (member === "new") {
      form.setFieldsValue({
        enabled: true,
        role: editableRoles[0]?.value,
      });
      return;
    }

    form.setFieldsValue({
      displayName: member.displayName ?? undefined,
      enabled: member.enabled,
      note: member.note ?? undefined,
      role: member.role === "owner" ? undefined : member.role,
      userRef: member.userId,
    });
  }, [editableRoles, form, member]);

  async function handleSubmit() {
    if (!member) {
      return;
    }

    const values = await form.validateFields();
    const role = values.role ?? editableRoles[0]?.value;

    if (!role) {
      message.error("当前账号没有可授权的低权限角色。");
      return;
    }

    setSaving(true);

    try {
      const nextMember = isNew
        ? await createAdminMember({
            displayName: values.displayName,
            enabled: values.enabled ?? true,
            note: values.note,
            role,
            userRef: values.userRef ?? "",
          } satisfies AdminMemberCreateInput)
        : await updateAdminMember(member.userId, {
            displayName: values.displayName,
            enabled: values.enabled ?? true,
            note: values.note,
            role,
          } satisfies AdminMemberUpdateInput);

      onSaved(nextMember);
      message.success(isNew ? "后台成员已添加" : "后台成员已保存");
      onClose();
      form.resetFields();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "保存后台成员失败",
      );
    } finally {
      setSaving(false);
    }
  }

  const title = isNew
    ? "添加后台成员"
    : `编辑 ${member?.displayName ?? member?.email ?? "后台成员"}`;

  return (
    <Drawer
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button loading={saving} onClick={handleSubmit} type="primary">
            保存
          </Button>
        </Space>
      }
      onClose={onClose}
      open={open}
      title={title}
      width={520}
    >
      <Alert
        className="admin-members-editor-alert"
        message={
          isNew
            ? "填写已有 Supabase Auth 用户的 UUID、邮箱或手机号。后台不会创建真实登录账号。"
            : "保存后会写入审计日志；同级或更高权限成员只能由更高权限角色处理。"
        }
        showIcon
        type="info"
      />

      <Form form={form} layout="vertical">
        <Form.Item
          label="Auth 用户"
          name="userRef"
          rules={[
            { required: true, message: "请填写 Auth 用户 UUID、邮箱或手机号" },
          ]}
        >
          <Input
            disabled={!isNew}
            placeholder="UUID / 邮箱 / 手机号"
            prefix={<UserSwitchOutlined />}
          />
        </Form.Item>

        <Form.Item
          label="后台角色"
          name="role"
          rules={[{ required: true, message: "请选择后台角色" }]}
        >
          <Select
            options={editableRoles.map((role) => ({
              disabled: !canManageRole(currentRole, role.value),
              label: `${role.label} · ${role.description}`,
              value: role.value,
            }))}
            placeholder="选择低于当前账号的角色"
          />
        </Form.Item>

        <Form.Item label="显示名称" name="displayName">
          <Input maxLength={80} placeholder="例如：运营值班、数据审核" />
        </Form.Item>

        <Form.Item label="启用后台访问" name="enabled" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>

        <Form.Item label="备注" name="note">
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            maxLength={500}
            placeholder="权限来源、职责范围或交接说明"
            showCount
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-members-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function canManageRole(actorRole: AdminRole, targetRole: AdminRole) {
  return (
    (actorRole === "owner" || actorRole === "admin") &&
    roleRank[actorRole] > roleRank[targetRole]
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
