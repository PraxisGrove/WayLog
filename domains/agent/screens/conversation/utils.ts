import type { AgentConversationSummary } from "@/features/agent";

export function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAgentConversationSummaryMeta(
  summary: AgentConversationSummary,
) {
  const parts = [`${summary.messageCount} 条消息`];
  const updatedAt = formatAgentConversationUpdatedAt(summary.updatedAt);

  if (updatedAt) {
    parts.push(updatedAt);
  }

  return parts.join(" · ");
}

function formatAgentConversationUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const now = new Date();
  const isSameYear = date.getFullYear() === now.getFullYear();
  const isSameDay =
    isSameYear &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    ...(isSameYear ? {} : { year: "numeric" }),
  });
}
