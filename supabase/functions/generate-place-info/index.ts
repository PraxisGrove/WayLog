type RequestBody = {
  placeName: string;
  cityName?: string;
  country?: string;
  category?: string;
  address?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    status,
  });
}

function buildPrompt(body: RequestBody): { system: string; user: string } {
  const system = `你是一位资深旅行内容作者，正在为旅行攻略撰写地点介绍。

写作要求：
1. 中文，150-250字，分2-3个自然段
2. 语气沉稳温和，有旅行质感，既不过于书面也不过于口语化
3. 第一段：介绍这个地方的核心特色和值得一去的理由，可以从历史、文化或体验切入
4. 第二段：补充实用的旅行信息，如最佳游览时间、推荐体验、周边联动等
5. 可以穿插一个小细节或冷知识，让介绍更有记忆点
6. 禁止编造不确定的具体数字（面积、年份、客流量等）
7. 避免"宛如""仿佛""坐落于""矗立"等空洞修辞
8. 纯文本段落，不使用标题、列表、Markdown格式`;

  const location = [body.placeName, body.cityName, body.country].filter(Boolean).join('，');
  const category = body.category ? `（类型：${body.category}）` : '';

  const user = `请为以下地点撰写旅行介绍，面向第一次到访的旅行者：${location}${category}`;

  return { system, user };
}

async function callDeepSeek(apiKey: string, system: string, user: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.6,
      max_tokens: 500,
    }),
  });

  if (response.status === 429) {
    throw new Error('RATE_LIMITED');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`DeepSeek API error: HTTP ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('Empty response from DeepSeek');
  }

  return text;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')?.trim();

    if (!apiKey) {
      return jsonResponse({ error: 'Missing DEEPSEEK_API_KEY' }, 500);
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    if (!body.placeName?.trim()) {
      return jsonResponse({ error: 'placeName is required.' }, 400);
    }

    const { system, user } = buildPrompt(body);
    const text = await callDeepSeek(apiKey, system, user);

    return jsonResponse({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate place info.';

    if (message === 'RATE_LIMITED') {
      return jsonResponse({ error: 'Rate limited, please try again later.' }, 429);
    }

    return jsonResponse({ error: message }, 500);
  }
});
