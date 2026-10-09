import { requestSupabase } from "../../auth/supabase";

import type {
  AgentWebSearchInput,
  AgentWebSearchResultItem,
} from "./web-search-tool";

export type WebSearchRequest = AgentWebSearchInput & {
  accessToken?: string;
};

type WebSearchFunctionResult = {
  items?: AgentWebSearchResultItem[];
};

const webSearchTimeoutMs = 12_000;

export async function searchWeb(
  input: WebSearchRequest,
): Promise<AgentWebSearchResultItem[]> {
  const { accessToken, ...body } = input;
  const result = await requestSupabase<WebSearchFunctionResult>({
    accessToken,
    body,
    method: "POST",
    path: "web-search",
    service: "functions",
    timeoutMs: webSearchTimeoutMs,
  });

  return Array.isArray(result.items) ? result.items : [];
}
