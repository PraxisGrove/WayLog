type ReadEnv = (name: string) => string | undefined;

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function readWebhookConfig(readEnv: ReadEnv, name: string): string | undefined {
  const value = readEnv(name)?.trim();
  return value && value !== '?' ? value : undefined;
}

export function rejectWebhookRequest(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

export function authorizeInternalWebhook(request: Request, readEnv: ReadEnv): Response | null {
  const secret = readWebhookConfig(readEnv, 'INTERNAL_WEBHOOK_SECRET');
  const serviceKey = readWebhookConfig(readEnv, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!secret && !serviceKey) {
    return rejectWebhookRequest(503, 'Internal webhook is not configured.');
  }
  const suppliedToken = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')?.trim() ?? '')?.[1];
  // 接受专用服务端通知凭据，并兼容已有 service-role 调用；客户端 anon key 不具有权限。
  if (
    !suppliedToken ||
    ![secret, serviceKey].some((value) => value && timingSafeEqual(value, suppliedToken))
  ) {
    return rejectWebhookRequest(401, 'Invalid internal webhook credentials.');
  }
  return null;
}
