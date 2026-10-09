import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { AliyunSmsError, sendAliyunSmsCode } from '../_shared/aliyun-sms.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone } = (await request.json()) as { phone?: string };
    const result = await sendAliyunSmsCode(phone?.trim() ?? '');

    return new Response(
      JSON.stringify({
        success: true,
        message: '验证码已发送',
        requestId: result.RequestId,
        verifyToken: result.VerifyToken ?? result.RequestId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    const statusCode = error instanceof AliyunSmsError ? error.statusCode : 400;
    const retryAfterSeconds = error instanceof AliyunSmsError ? error.retryAfterSeconds : 0;

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '发送验证码失败',
        code: statusCode === 429 ? 'SMS_RATE_LIMITED' : 'SMS_SEND_FAILED',
        retryAfterSeconds,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(retryAfterSeconds > 0 ? { 'Retry-After': String(retryAfterSeconds) } : {}),
        },
        status: statusCode,
      },
    );
  }
});
