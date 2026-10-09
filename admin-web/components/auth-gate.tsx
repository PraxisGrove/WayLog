"use client";

import "@ant-design/v5-patch-for-react-19";
import { Button, Card, Result, Skeleton, Space, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useAdminSession } from "@/components/admin-session-provider";

import { AdminShell } from "./admin-shell";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { error, loading, reload, session } = useAdminSession();

  useEffect(() => {
    if (session?.status === "anonymous" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [pathname, router, session]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (loading && !session) {
    return (
      <div className="setup-screen">
        <Card className="setup-card">
          <Skeleton active paragraph={{ rows: 4 }} title />
        </Card>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="setup-screen">
        <Card className="setup-card">
          <Result
            extra={
              <Button onClick={() => void reload()} type="primary">
                重新加载
              </Button>
            }
            status="error"
            subTitle={error.message}
            title="读取后台登录状态失败"
          />
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="setup-screen">
        <Card className="setup-card">
          <Skeleton active paragraph={{ rows: 4 }} title />
        </Card>
      </div>
    );
  }

  if (session.status === "not-configured") {
    return (
      <div className="setup-screen">
        <Card className="setup-card">
          <Result
            status="warning"
            title="后台环境变量未配置"
            subTitle="请先在 admin-web/.env.local 或 Vercel Project 中配置 Supabase URL 和 anon key。"
          />
          <Typography.Paragraph copyable>
            NEXT_PUBLIC_SUPABASE_URL
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </Typography.Paragraph>
        </Card>
      </div>
    );
  }

  if (session.status === "unauthorized") {
    return (
      <div className="setup-screen">
        <Card className="setup-card">
          <Result
            extra={
              <Button onClick={() => router.replace("/login")} type="primary">
                返回登录
              </Button>
            }
            status="403"
            subTitle={session.message}
            title="当前账号没有后台权限"
          />
        </Card>
      </div>
    );
  }

  if (session.status !== "authenticated") {
    return (
      <div className="setup-screen">
        <Space direction="vertical">
          <Typography.Text type="secondary">正在跳转登录页...</Typography.Text>
        </Space>
      </div>
    );
  }

  return (
    <AdminShell member={session.member} userEmail={session.user.email}>
      {children}
    </AdminShell>
  );
}
