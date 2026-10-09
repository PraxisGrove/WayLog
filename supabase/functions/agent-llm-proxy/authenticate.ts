export async function authenticateAgentProxyRequest(input: {
  anonKey: string;
  authHeader: string;
  fetcher?: typeof fetch;
  supabaseUrl: string;
}): Promise<{ ok: true; userId: string } | { error: string; ok: false }> {
  if (!/^Bearer\s+\S+/i.test(input.authHeader)) {
    return { error: "Missing authorization.", ok: false };
  }

  const response = await (input.fetcher ?? fetch)(
    `${input.supabaseUrl.replace(/\/+$/g, "")}/auth/v1/user`,
    {
      headers: {
        apikey: input.anonKey,
        Authorization: input.authHeader,
      },
      method: "GET",
    },
  ).catch(() => undefined);

  if (!response?.ok) {
    return { error: "Invalid authorization.", ok: false };
  }

  const payload: unknown = await response.json().catch(() => undefined);
  const userId =
    typeof payload === "object" && payload !== null && "id" in payload &&
      typeof payload.id === "string"
      ? payload.id.trim()
      : "";

  return userId
    ? { ok: true, userId }
    : { error: "JWT did not resolve to a user.", ok: false };
}
