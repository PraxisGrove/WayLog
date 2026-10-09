import "@ant-design/v5-patch-for-react-19";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminProviders } from "@/components/admin-providers";
import { AuthGate } from "@/components/auth-gate";

import "./globals.css";

export const metadata: Metadata = {
  title: "WayLog Admin",
  description: "WayLog 后台管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <AdminProviders>
            <AuthGate>{children}</AuthGate>
          </AdminProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
