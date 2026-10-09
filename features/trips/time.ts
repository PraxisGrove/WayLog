export type DayItemTimeParts = {
  hour: number;
  minute: number;
};

export function normalizeDayItemTime(value: string): {
  error?: string;
  time?: string;
} {
  const trimmedValue = value.trim().replace("：", ":");

  if (!trimmedValue) {
    return { time: undefined };
  }

  const compactMatch = /^(\d{1,2})(\d{2})$/.exec(trimmedValue);
  const timeMatch = compactMatch ?? /^(\d{1,2}):(\d{1,2})$/.exec(trimmedValue);
  const hourOnlyMatch = /^(\d{1,2})$/.exec(trimmedValue);
  const hour = timeMatch
    ? Number(timeMatch[1])
    : hourOnlyMatch
      ? Number(hourOnlyMatch[1])
      : Number.NaN;
  const minute = timeMatch
    ? Number(timeMatch[2])
    : hourOnlyMatch
      ? 0
      : Number.NaN;

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { error: "请使用 24 小时制，例如 09:30" };
  }

  return {
    time: formatDayItemTime(hour, minute),
  };
}

export function formatDayItemTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function getDayItemTimeParts(value?: string): DayItemTimeParts {
  const normalizedTime = normalizeDayItemTime(value ?? "");

  if (!normalizedTime.time) {
    return { hour: 9, minute: 0 };
  }

  const [hourText, minuteText] = normalizedTime.time.split(":");

  return {
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}
