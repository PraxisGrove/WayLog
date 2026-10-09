import {
  type AgentToolDefinition,
  type AgentToolRunContext,
  createAgentToolAudit,
  createAgentToolFailure,
  createAgentToolSuccess,
  getAgentToolClock,
  isRecord,
} from "./agent-tool-types";
import { sanitizePublicSourceUrl } from "../source-references";

export type AgentWebSearchInput = {
  limit?: number;
  query: string;
  region?: string;
  safeSearch?: "moderate" | "off" | "strict";
};

export type AgentWebSearchResultItem = {
  displayUrl?: string;
  publishedAt?: string;
  snippet?: string;
  source?: string;
  title: string;
  url: string;
};

export type AgentWebSearchResult = {
  items: AgentWebSearchResultItem[];
  markdown: string;
  query: string;
};

export type AgentWebSearchDeps = {
  search?: (
    input: Required<
      Pick<AgentWebSearchInput, "limit" | "query" | "safeSearch">
    > & {
      region?: string;
    },
  ) => Promise<AgentWebSearchResultItem[]>;
};

const defaultLimit = 5;
const maxLimit = 8;
const maxQueryLength = 120;
const maxSnippetLength = 180;

export const webSearchTool: AgentToolDefinition<
  unknown,
  AgentWebSearchResult,
  AgentWebSearchDeps
> = {
  description:
    "搜索公开网页并返回带来源链接的结果摘要。只读工具，不抓取网页正文，也不直接写入 Trip。",
  id: "web.search",
  inputSchema: {
    limit: "number?",
    query: "string",
    region: "string?",
    safeSearch: "'moderate' | 'off' | 'strict'?",
  },
  readOnly: true,
  risk: "low",
  run: runWebSearchTool,
};

export async function runWebSearchTool(
  input: unknown,
  context?: AgentToolRunContext<AgentWebSearchDeps>,
) {
  const clock = getAgentToolClock(context);
  const startedAt = clock();
  const parsedInput = parseWebSearchInput(input);

  if (!parsedInput.ok) {
    const finishedAt = clock();

    return createAgentToolFailure(
      "web.search",
      "INVALID_TOOL_INPUT",
      parsedInput.message,
      createAgentToolAudit(startedAt, finishedAt, "web-search"),
    );
  }

  const search = context?.deps?.search;

  if (!search) {
    const finishedAt = clock();

    return createAgentToolFailure(
      "web.search",
      "TOOL_UNAVAILABLE",
      "网页搜索工具尚未配置后端搜索服务。",
      createAgentToolAudit(startedAt, finishedAt, "web-search"),
    );
  }

  try {
    const items = normalizeWebSearchItems(
      await search(parsedInput.data),
      parsedInput.data.limit,
    );
    const finishedAt = clock();

    return createAgentToolSuccess(
      "web.search",
      {
        items,
        markdown: createWebSearchMarkdown(items),
        query: parsedInput.data.query,
      },
      createAgentToolAudit(startedAt, finishedAt, "web-search"),
    );
  } catch {
    const finishedAt = clock();

    return createAgentToolFailure(
      "web.search",
      "TOOL_FAILED",
      "网页搜索暂时不可用，请稍后重试。",
      createAgentToolAudit(startedAt, finishedAt, "web-search"),
    );
  }
}

function parseWebSearchInput(input: unknown):
  | {
      ok: true;
      data: Required<
        Pick<AgentWebSearchInput, "limit" | "query" | "safeSearch">
      > & {
        region?: string;
      };
    }
  | { ok: false; message: string } {
  if (!isRecord(input)) {
    return { ok: false, message: "web.search 输入必须是对象。" };
  }

  const query = readOptionalString(input.query);

  if (!query) {
    return { ok: false, message: "web.search 需要 query。" };
  }

  if (query.length > maxQueryLength) {
    return {
      ok: false,
      message: `web.search query 不能超过 ${maxQueryLength} 个字符。`,
    };
  }

  const safeSearch = readSafeSearch(input.safeSearch);

  if (input.safeSearch !== undefined && !safeSearch) {
    return {
      ok: false,
      message: "web.search safeSearch 只支持 moderate、off 或 strict。",
    };
  }

  return {
    ok: true,
    data: {
      limit: readPositiveInteger(input.limit) ?? defaultLimit,
      query,
      region: readOptionalString(input.region),
      safeSearch: safeSearch ?? "moderate",
    },
  };
}

function normalizeWebSearchItems(
  items: AgentWebSearchResultItem[],
  limit: number,
): AgentWebSearchResultItem[] {
  return items
    .map(normalizeWebSearchItem)
    .filter((item): item is AgentWebSearchResultItem => Boolean(item))
    .slice(0, limit);
}

function normalizeWebSearchItem(
  item: AgentWebSearchResultItem,
): AgentWebSearchResultItem | undefined {
  const title = item.title.trim();
  const url = sanitizePublicSourceUrl(item.url);

  if (!title || !url) {
    return undefined;
  }

  return {
    displayUrl: readOptionalString(item.displayUrl),
    publishedAt: readOptionalString(item.publishedAt),
    snippet: truncateText(readOptionalString(item.snippet), maxSnippetLength),
    source: readOptionalString(item.source),
    title,
    url,
  };
}

function createWebSearchMarkdown(items: AgentWebSearchResultItem[]) {
  if (items.length === 0) {
    return "未找到可用的网页搜索结果。";
  }

  return items
    .map((item, index) => {
      const meta = [item.source, item.publishedAt, item.displayUrl]
        .filter(Boolean)
        .join(" · ");
      const snippet = item.snippet ? `\n   ${item.snippet}` : "";

      return `${index + 1}. [${escapeMarkdownLinkText(item.title)}](${item.url})${meta ? `\n   ${meta}` : ""}${snippet}`;
    })
    .join("\n");
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, maxLimit)
    : undefined;
}

function readSafeSearch(
  value: unknown,
): AgentWebSearchInput["safeSearch"] | undefined {
  return value === "moderate" || value === "off" || value === "strict"
    ? value
    : undefined;
}

function truncateText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function escapeMarkdownLinkText(value: string) {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}
