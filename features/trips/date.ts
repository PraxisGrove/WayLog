const DAY_MS = 24 * 60 * 60 * 1000;

type DateParts = {
  day: number;
  month: number;
  year: number;
};

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDatePartsForDisplay(parts: DateParts): string {
  return `${parts.year} 年 ${parts.month} 月 ${parts.day} 日`;
}

function formatMonthDayForDisplay(parts: DateParts): string {
  return `${parts.month} 月 ${parts.day} 日`;
}

export function createDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function parseDateKey(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

export function dateKeyToDate(value: string): Date | null {
  const parts = parseDateKey(value);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : null;
}

export function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function addDaysToDateKey(value: string, amount: number): string {
  const date = dateKeyToDate(value);

  if (!date) {
    return value;
  }

  date.setDate(date.getDate() + amount);
  return createDateKey(date);
}

export function getInclusiveDateRangeDays(
  startDate: string,
  endDate: string,
): number {
  const startParts = parseDateKey(startDate);
  const endParts = parseDateKey(endDate);

  if (!startParts || !endParts || compareDateKeys(endDate, startDate) < 0) {
    return 1;
  }

  const startTime = Date.UTC(
    startParts.year,
    startParts.month - 1,
    startParts.day,
  );
  const endTime = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  return Math.floor((endTime - startTime) / DAY_MS) + 1;
}

export function formatDateKeyForDisplay(value: string): string {
  const parts = parseDateKey(value);

  if (!parts) {
    return value;
  }

  return formatDatePartsForDisplay(parts);
}

export function formatDateRangeForDisplay(
  startDate?: string,
  endDate?: string,
): string {
  if (!startDate && !endDate) {
    return "日期未定";
  }

  if (startDate && endDate) {
    const startParts = parseDateKey(startDate);
    const endParts = parseDateKey(endDate);

    if (startParts && endParts) {
      if (startDate === endDate) {
        return formatDatePartsForDisplay(startParts);
      }

      if (startParts.year === endParts.year) {
        return `${formatDatePartsForDisplay(startParts)} - ${formatMonthDayForDisplay(endParts)}`;
      }
    }

    return `${formatDateKeyForDisplay(startDate)} - ${formatDateKeyForDisplay(endDate)}`;
  }

  return formatDateKeyForDisplay(startDate ?? endDate ?? "");
}

export function formatDateRangeWithDayCount(
  startDate?: string,
  endDate?: string,
): string {
  if (!startDate || !endDate) {
    return "日期未定";
  }

  return `${formatDateRangeForDisplay(startDate, endDate)} · 共 ${getInclusiveDateRangeDays(startDate, endDate)} 天`;
}
