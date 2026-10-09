"use client";

import { Button, Card, Form, Input, Result, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminSession } from "@/components/admin-session-provider";
import { signInAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase-client";

type LoginFormValues = {
  email: string;
  password: string;
};

export function LoginPage() {
  const router = useRouter();
  const { reload } = useAdminSession();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleFinish(values: LoginFormValues) {
    setErrorMessage(undefined);
    setSubmitting(true);

    try {
      await signInAdmin(values);
      await reload();
      router.replace("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="login-screen">
        <Card className="login-card">
          <Result
            status="warning"
            title="还没有配置 Supabase"
            subTitle="配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 后即可登录后台。"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <Card className="login-card">
        <div className="login-brand-panel">
          <div className="login-brand-art" aria-hidden="true" />
          <div className="login-brand-content">
            <div className="login-brand-head">
              <div aria-hidden="true" className="login-brand-mark" />
              <Typography.Text className="login-brand-kicker">
                WayLog 后台管理系统
              </Typography.Text>
            </div>
            <div className="login-brand-copy">
              <Typography.Title level={1}>
                每一份认真都会抵达旅途
              </Typography.Title>
              <Typography.Paragraph>
                后台里的每一次守护，都会化成用户出发时的安心、途中被回应的温度。
              </Typography.Paragraph>
              <Typography.Paragraph>
                愿我们把看不见的细节照亮，让一路记成为值得托付的旅行伙伴。
              </Typography.Paragraph>
            </div>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-card">
            <div className="login-title">
              <Typography.Title level={2}>登录后台</Typography.Title>
              <Typography.Paragraph>使用管理员账号继续。</Typography.Paragraph>
            </div>
            <Form<LoginFormValues>
              layout="vertical"
              onFinish={handleFinish}
              requiredMark={false}
            >
              <Form.Item
                label="邮箱"
                name="email"
                rules={[
                  { required: true, type: "email", message: "请输入邮箱" },
                ]}
              >
                <Input autoComplete="email" size="large" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: "请输入密码" }]}
              >
                <Input.Password autoComplete="current-password" size="large" />
              </Form.Item>
              {errorMessage ? (
                <Typography.Paragraph type="danger">
                  {errorMessage}
                </Typography.Paragraph>
              ) : null}
              <Button
                block
                htmlType="submit"
                loading={submitting}
                size="large"
                type="primary"
              >
                登录后台
              </Button>
            </Form>
          </div>
        </div>
      </Card>
    </div>
  );
}
