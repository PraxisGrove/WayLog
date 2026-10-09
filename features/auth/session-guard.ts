export const FOREGROUND_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

export function shouldRefreshOnForeground(
  lastBackgroundedAt: number | null,
  now: number,
  thresholdMs: number = FOREGROUND_REFRESH_THRESHOLD_MS,
): boolean {
  if (lastBackgroundedAt === null) {
    return false;
  }

  return now - lastBackgroundedAt >= thresholdMs;
}
