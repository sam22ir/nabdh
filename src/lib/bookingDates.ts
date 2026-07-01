const ALGERIA_OFFSET_MS = 60 * 60 * 1000;

export interface BookingDateAvailability {
  dateStr: string;
  hasAvailability: boolean;
}

/**
 * Return an Algeria-calendar date represented as a UTC-midnight Date.
 * This keeps weekday and YYYY-MM-DD calculations aligned with Convex booking
 * validation, which also uses Algeria time for "today".
 */
export function algeriaCalendarDate(now = new Date()): Date {
  const algeriaNow = new Date(now.getTime() + ALGERIA_OFFSET_MS);
  return new Date(
    Date.UTC(
      algeriaNow.getUTCFullYear(),
      algeriaNow.getUTCMonth(),
      algeriaNow.getUTCDate(),
    ),
  );
}

export function formatBookingDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatGregorianArabicMonthShort(date: Date): string {
  return new Intl.DateTimeFormat("ar", {
    month: "short",
    calendar: "gregory",
    timeZone: "UTC",
  }).format(date);
}

export function generateAlgeriaDateRange(days: number, now = new Date()): Date[] {
  const dates: Date[] = [];
  const today = algeriaCalendarDate(now);
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + i);
    dates.push(date);
  }
  return dates;
}

export function selectInitialBookingDate(
  days: BookingDateAvailability[],
): string | null {
  if (days.length === 0) return null;
  return days.find((day) => day.hasAvailability)?.dateStr ?? days[0].dateStr;
}
