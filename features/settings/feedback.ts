import { getAuthState } from "../auth/storage";
import { requestSupabase } from "../auth/supabase";
import { getDiagnosticBundleTextAsync } from "../diagnostics";

export const feedbackContactMethodOptions = ["qq", "邮箱", "手机号"] as const;

export type FeedbackContactMethod =
  (typeof feedbackContactMethodOptions)[number];

export type FeedbackPayload = {
  contactMethod: FeedbackContactMethod | null;
  contactValue: string;
  description: string;
};

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; reason: "network" | "server"; message: string };

type FeedbackContext = {
  appVersion?: string | null;
  platform?: string | null;
};

export async function submitFeedback(
  payload: FeedbackPayload,
  context?: FeedbackContext,
): Promise<SubmitFeedbackResult> {
  if (!payload.description.trim()) {
    return { ok: false, reason: "server", message: "请填写问题描述" };
  }

  try {
    const authState = await getAuthState();
    const accessToken = authState.session?.accessToken;

    const diagnosticContext = await getDiagnosticBundleTextAsync();

    await requestSupabase({
      accessToken,
      body: {
        app_version: context?.appVersion ?? null,
        contact_method: payload.contactMethod ?? null,
        contact_value: payload.contactValue.trim() || null,
        description: payload.description.trim(),
        diagnostic_context: diagnosticContext,
        platform: context?.platform ?? null,
        user_id: authState.users?.[0]?.id ?? null,
      },
      method: "POST",
      path: "feedback",
      prefer: "return=minimal",
      service: "rest",
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      reason: "network",
      message: `提交失败：${message}`,
    };
  }
}
