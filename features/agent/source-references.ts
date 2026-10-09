const MAX_SOURCE_REFERENCES = 12;
const MAX_SOURCE_TEXT_LENGTH = 180;
const SENSITIVE_PATH_LABEL_PATTERN =
  /(?:^|\/)(?:access[_-]?token|auth|credential|secret|sig(?:nature)?|signed|token)(?:\/|$)/i;
const SIGNED_PATH_SEGMENT_PATTERN = /(?:^|\/)s--[^/]{1,128}--(?:\/|$)/i;
const OPAQUE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{40,}$/;
const SENSITIVE_SOURCE_METADATA_PATTERN =
  /(?:\b(?:access[_-]?token|xsec_token|token|jwt|api[_-]?key|authorization|credential|secret|signature|signed[_-]?url)\b\s*[:=]|\bbearer\s+[A-Za-z0-9._~-]+|(?:ignore|disregard)[^.!?\n]{0,24}(?:instructions?|rules?|prompt)|忽略[^。！？\n]{0,24}(?:指令|规则|提示)|(?:系统|内部|隐藏)(?:提示词?|指令|规则))/iu;
const OPAQUE_SOURCE_METADATA_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/u;

export type AgentSourceReference = {
  platform: string;
  retrievedAt: string;
  title: string;
  url?: string;
};

export function readPublicSourceReferences(
  value: unknown,
): AgentSourceReference[] {
  if (!isRecord(value) || !Array.isArray(value.sourceReferences)) {
    return [];
  }

  const references: AgentSourceReference[] = [];
  const seen = new Set<string>();

  for (const candidate of value.sourceReferences) {
    if (!isRecord(candidate)) continue;
    const title = readSourceMetadata(candidate.title);
    const platform = readSourceMetadata(candidate.platform);
    const retrievedAt = readTimestamp(candidate.retrievedAt);
    const url = sanitizePublicSourceUrl(candidate.url);

    if (!title || !platform || !retrievedAt) continue;
    const key = `${platform}\u0000${title}\u0000${url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ platform, retrievedAt, title, url });
    if (references.length >= MAX_SOURCE_REFERENCES) break;
  }

  return references;
}

export function appendSourceReferences(
  text: string,
  sources: AgentSourceReference[],
): string {
  if (sources.length === 0) return text;

  const lines = sources.map((source) => {
    const title = source.url
      ? `[${escapeMarkdownText(source.title)}](${source.url})`
      : escapeMarkdownText(source.title);
    return `- ${title}（${escapeMarkdownText(source.platform)}，${source.retrievedAt}）`;
  });

  return `${text.trim()}\n\n来源：\n${lines.join("\n")}`;
}

export function readPublicSummary(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return readText(value.publicSummary);
}

export function sanitizePublicSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    if (url.username || url.password || hasSensitivePath(url.pathname)) {
      return undefined;
    }
    // 查询参数无法可靠区分业务参数与各 CDN/对象存储的短签名字段；
    // 来源引用只保留可公开访问的规范路径，避免持久化 signed URL。
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function hasSensitivePath(pathname: string): boolean {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return (
    SENSITIVE_PATH_LABEL_PATTERN.test(decodedPath) ||
    SIGNED_PATH_SEGMENT_PATTERN.test(decodedPath) ||
    decodedPath
      .split("/")
      .some((segment) => OPAQUE_PATH_SEGMENT_PATTERN.test(segment))
  );
}

function readTimestamp(value: unknown): string | undefined {
  const timestamp = readText(value);
  return timestamp && Number.isFinite(Date.parse(timestamp))
    ? timestamp
    : undefined;
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const text = value.trim();
  return text.length <= MAX_SOURCE_TEXT_LENGTH
    ? text
    : `${text.slice(0, MAX_SOURCE_TEXT_LENGTH - 1).trimEnd()}…`;
}

function readSourceMetadata(value: unknown): string | undefined {
  const text = readText(value)?.replace(/\s+/gu, " ");
  if (
    !text ||
    SENSITIVE_SOURCE_METADATA_PATTERN.test(text) ||
    OPAQUE_SOURCE_METADATA_PATTERN.test(text)
  ) {
    return undefined;
  }
  return text;
}

function escapeMarkdownText(value: string): string {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
