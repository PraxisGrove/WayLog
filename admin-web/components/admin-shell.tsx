"use client";

import "@ant-design/v5-patch-for-react-19";
import {
  ApiOutlined,
  BugOutlined,
  CloudServerOutlined,
  CrownOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  LogoutOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { signOutAdmin } from "@/lib/admin-auth";
import { adminModules, type AdminModuleKey } from "@/lib/admin-modules";
import type { AdminMember } from "@/lib/admin-types";

const { Content, Header, Sider } = Layout;

const moduleIcons: Record<AdminModuleKey, ReactNode> = {
  agent: <ApiOutlined />,
  dashboard: <DashboardOutlined />,
  diagnostics: <BugOutlined />,
  feedback: <MessageOutlined />,
  members: <SafetyCertificateOutlined />,
  poi: <EnvironmentOutlined />,
  serviceConfigs: <CloudServerOutlined />,
  users: <TeamOutlined />,
};

export function AdminShell({
  children,
  member,
  userEmail,
}: {
  children: ReactNode;
  member: AdminMember;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const selectedKey =
    adminModules.find((module) => module.href === pathname)?.key ?? "dashboard";

  const items: MenuProps["items"] = adminModules.map((module) => ({
    icon: moduleIcons[module.key],
    key: module.key,
    label: module.label,
  }));

  useEffect(() => {
    for (const module of adminModules) {
      if (module.href !== pathname) {
        router.prefetch(module.href);
      }
    }
  }, [pathname, router]);

  async function handleSignOut() {
    await signOutAdmin();
    router.replace("/login");
  }

  return (
    <Layout className="admin-layout">
      <Sider
        breakpoint="lg"
        className="admin-sider"
        collapsedWidth="0"
        theme="light"
        width={248}
      >
        <div className="admin-logo">
          <strong>WayLog Admin</strong>
          <span>一路记运营控制台</span>
        </div>
        <Menu
          items={items}
          mode="inline"
          onClick={({ key }) => {
            const module = adminModules.find((item) => item.key === key);

            if (module) {
              router.push(module.href);
            }
          }}
          selectedKeys={[selectedKey]}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Space className="admin-header-actions" size={10}>
            <div className="admin-user-card">
              <Avatar
                className="admin-user-avatar"
                icon={<CrownOutlined />}
                size={34}
              />
              <div className="admin-user-meta">
                <div className="admin-user-name-row">
                  <Typography.Text className="admin-user-name" strong>
                    {member.displayName ?? member.role}
                  </Typography.Text>
                  <Tag className="admin-role-tag admin-user-role-tag">
                    {member.role}
                  </Tag>
                </div>
                <Typography.Text className="admin-user-email">
                  {userEmail ?? "管理员"}
                </Typography.Text>
              </div>
            </div>
            <Button icon={<LogoutOutlined />} onClick={handleSignOut}>
              退出
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
