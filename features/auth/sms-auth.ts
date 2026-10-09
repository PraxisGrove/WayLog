import { requestSupabase } from "./supabase";

export const SMS_SEND_COOLDOWN_SECONDS = 60;

const pendingSmsRequests = new Map<string, Promise<string>>();

export type SmsSendErrorDetails = {
  cooldownSeconds: number;
  message: string;
};

function normalizeSmsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("86") ? digits.slice(2) : digits;
}

function isSmsRateLimitMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("check frequency failed") ||
    normalizedMessage.includes("frequency") ||
    normalizedMessage.includes("too many request") ||
    normalizedMessage.includes("business_limit_control") ||
    normalizedMessage.includes("频繁") ||
    normalizedMessage.includes("频率限制")
  );
}

export function getSmsSendErrorDetails(error: unknown): SmsSendErrorDetails {
  const message = error instanceof Error ? error.message : "";

  if (isSmsRateLimitMessage(message)) {
    return {
      cooldownSeconds: SMS_SEND_COOLDOWN_SECONDS,
      message: "短信发送过于频繁，请等待 60 秒后再试。",
    };
  }

  return {
    cooldownSeconds: 0,
    message: message || "发送验证码失败，请稍后再试。",
  };
}

async function requestSmsCode(phone: string): Promise<string> {
  const result = await requestSupabase<{
    success: boolean;
    verifyToken?: string;
    error?: string;
  }>({
    service: "functions",
    path: "send-sms",
    body: { phone },
  });

  if (!result.success) {
    throw new Error(result.error || "发送验证码失败");
  }

  return result.verifyToken || "";
}

export async function sendSmsCode(phone: string): Promise<string> {
  const normalizedPhone = normalizeSmsPhone(phone);
  const pendingRequest = pendingSmsRequests.get(normalizedPhone);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request = requestSmsCode(normalizedPhone).catch((error) => {
    const details = getSmsSendErrorDetails(error);
    throw new Error(details.message);
  });

  pendingSmsRequests.set(normalizedPhone, request);

  try {
    return await request;
  } finally {
    pendingSmsRequests.delete(normalizedPhone);
  }
}

export async function verifySmsCode(
  phone: string,
  code: string,
): Promise<boolean> {
  const result = await requestSupabase<{
    success: boolean;
    error?: string;
  }>({
    service: "functions",
    path: "verify-sms",
    body: { phone, code },
  });

  if (!result.success) {
    throw new Error(result.error || "验证失败");
  }

  return true;
}
