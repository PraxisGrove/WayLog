export type AmapJsonLikeResponse = {
  errcode?: number;
  infocode?: string;
  status?: string;
};

export function parseAmapJsonResponse(
  payload: string,
): AmapJsonLikeResponse | undefined {
  try {
    const data = JSON.parse(payload) as AmapJsonLikeResponse;
    return typeof data === "object" && data !== null ? data : undefined;
  } catch {
    return undefined;
  }
}

export function isAmapJsonSuccessPayload(payload: string): boolean {
  const data = parseAmapJsonResponse(payload);

  return Boolean(data && (data.status === "1" || data.errcode === 0));
}

export function shouldFallbackToBackupKey(input: {
  error?: unknown;
  hasMoreKeys: boolean;
  payload?: string;
}): boolean {
  if (!input.hasMoreKeys) {
    return false;
  }

  if (input.error) {
    return true;
  }

  if (typeof input.payload !== "string" || !input.payload.trim()) {
    return true;
  }

  return !isAmapJsonSuccessPayload(input.payload);
}
