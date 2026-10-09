export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readStringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  return readString(record[key]);
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readString)
    .filter((item): item is string => item !== undefined);
}

export function readUnknownRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return isRecord(value) ? { ...value } : undefined;
}

export function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}
