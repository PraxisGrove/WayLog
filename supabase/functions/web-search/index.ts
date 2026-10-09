type WebSearchProvider = "brave" | "tavily";

type WebSearchRequestBody = {
  limit?: number;
  query?: string;
  region?: string;
  safeSearch?: "moderate" | "off" | "strict";
};

type WebSearchResultItem = {
  displayUrl?: string;
  publishedAt?: string;
  snippet?: string;
  source?: string;
  title: string;
  url: string;
};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const defaultLimit = 5;
const maxLimit = 8;
const maxQueryLength = 120;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const body = (await request.json().catch(() => ({}))) as WebSearchRequestBody;
  const parsedInput = parseWebSearchRequest(body);

  if (!parsedInput.ok) {
    return jsonResponse({ error: parsedInput.message }, 400);
  }

  const provider = readWebSearchProvider();

  if (!provider) {
    return jsonResponse({ error: "WEB_SEARCH_PROVIDER must be tavily or brave." }, 500);
  }

  try {
    const items = provider === "tavily"
      ? await searchTavily(parsedInput.data)
      : await searchBrave(parsedInput.data);

    return jsonResponse({
      items: normalizeSearchItems(items, parsedInput.data.limit),
      provider,
      query: parsedInput.data.query,
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Web search failed.",
    }, 502);
  }
});

function parseWebSearchRequest(
  body: WebSearchRequestBody,
): { ok: true; data: Required<Pick<WebSearchRequestBody, "limit" | "query" | "safeSearch">> & { region?: string } }
  | { ok: false; message: string } {
  const query = readOptionalString(body.query);

  if (!query) {
    return { ok: false, message: "query is required." };
  }

  if (query.length > maxQueryLength) {
    return { ok: false, message: `query cannot exceed ${maxQueryLength} characters.` };
  }

  if (body.safeSearch !== undefined && !readSafeSearch(body.safeSearch)) {
    return { ok: false, message: "safeSearch must be moderate, off or strict." };
  }

  return {
    ok: true,
    data: {
      limit: readPositiveInteger(body.limit) ?? defaultLimit,
      query,
      region: readOptionalString(body.region),
      safeSearch: readSafeSearch(body.safeSearch) ?? "moderate",
    },
  };
}

async function searchTavily(
  input: Required<Pick<WebSearchRequestBody, "limit" | "query" | "safeSearch">> & { region?: string },
) {
  const apiKey = readRequiredEnv("TAVILY_API_KEY");
  const response = await fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      include_answer: false,
      include_raw_content: false,
      max_results: input.limit,
      query: input.query,
      search_depth: "basic",
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
  });
  const payload = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(readProviderError(payload) ?? `Tavily search failed: HTTP ${response.status}`);
  }

  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.map((item): WebSearchResultItem | undefined => {
    if (!isRecord(item)) {
      return undefined;
    }

    return {
      displayUrl: readHostname(item.url),
      snippet: readOptionalString(item.content),
      source: "Tavily",
      title: readOptionalString(item.title) ?? readOptionalString(item.url) ?? "",
      url: readOptionalString(item.url) ?? "",
    };
  });
}

async function searchBrave(
  input: Required<Pick<WebSearchRequestBody, "limit" | "query" | "safeSearch">> & { region?: string },
) {
  const apiKey = readRequiredEnv("BRAVE_SEARCH_API_KEY");
  const searchParams = new URLSearchParams({
    count: String(input.limit),
    q: input.query,
    safesearch: input.safeSearch,
    text_decorations: "false",
  });

  if (input.region) {
    searchParams.set("country", input.region);
  }

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${searchParams.toString()}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });
  const payload = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(readProviderError(payload) ?? `Brave search failed: HTTP ${response.status}`);
  }

  const results = isRecord(payload.web) && Array.isArray(payload.web.results)
    ? payload.web.results
    : [];

  return results.map((item): WebSearchResultItem | undefined => {
    if (!isRecord(item)) {
      return undefined;
    }

    return {
      displayUrl: readOptionalString(item.display_url) ?? readHostname(item.url),
      publishedAt: readOptionalString(item.age),
      snippet: readOptionalString(item.description),
      source: "Brave Search",
      title: readOptionalString(item.title) ?? readOptionalString(item.url) ?? "",
      url: readOptionalString(item.url) ?? "",
    };
  });
}

function normalizeSearchItems(
  items: Array<WebSearchResultItem | undefined>,
  limit: number,
): WebSearchResultItem[] {
  return items
    .filter((item): item is WebSearchResultItem => Boolean(item))
    .filter((item) => Boolean(item.title.trim()) && isHttpUrl(item.url))
    .slice(0, limit);
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json().catch(() => ({}));
}

function readProviderError(payload: Record<string, unknown>) {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return undefined;
}

function readWebSearchProvider(): WebSearchProvider | undefined {
  const provider = Deno.env.get("WEB_SEARCH_PROVIDER")?.trim().toLocaleLowerCase();

  return provider === "tavily" || provider === "brave" ? provider : undefined;
}

function readRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, maxLimit)
    : undefined;
}

function readSafeSearch(value: unknown): WebSearchRequestBody["safeSearch"] | undefined {
  return value === "moderate" || value === "off" || value === "strict" ? value : undefined;
}

function readHostname(value: unknown): string | undefined {
  const text = readOptionalString(value);

  if (!text) {
    return undefined;
  }

  try {
    return new URL(text).hostname;
  } catch {
    return undefined;
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}
