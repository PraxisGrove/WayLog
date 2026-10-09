import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { verifyAliyunSmsCode } from '../_shared/aliyun-sms.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, code } = (await request.json()) as {
      code?: string;
      phone?: string;
    };

    await verifyAliyunSmsCode(phone?.trim() ?? '', code?.trim() ?? '');

    return new Response(
      JSON.stringify({
        success: true,
        message: '验证成功',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '验证失败',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
