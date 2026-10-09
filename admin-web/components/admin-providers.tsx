"use client";

import "@ant-design/v5-patch-for-react-19";
import { Refine } from "@refinedev/core";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";

import { AdminSessionProvider } from "@/components/admin-session-provider";
import { adminModules } from "@/lib/admin-modules";

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorBgLayout: "#f4f7f2",
          colorError: "#e45b4f",
          colorInfo: "#2d7ff9",
          colorPrimary: "#15945f",
          colorSuccess: "#18a76d",
          colorText: "#18221d",
          colorWarning: "#f2b544",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <AntdApp>
        <AdminSessionProvider>
          <Refine
            resources={adminModules.map((module) => ({
              name: module.key,
              list: module.href,
              meta: {
                label: module.label,
              },
            }))}
          >
            {children}
          </Refine>
        </AdminSessionProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
