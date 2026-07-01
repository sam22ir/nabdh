import { describe, expect, test } from "vitest";
import {
  formatBookingDateStr,
  formatGregorianArabicMonthShort,
  generateAlgeriaDateRange,
  selectInitialBookingDate,
} from "./bookingDates";

describe("booking date helpers", () => {
  test("builds the booking calendar from Algeria's current date", () => {
    const lateUtcSaturday = new Date("2026-06-13T23:30:00.000Z");

    const [firstDay] = generateAlgeriaDateRange(1, lateUtcSaturday);

    expect(formatBookingDateStr(firstDay)).toBe("2026-06-14");
    expect(firstDay.getUTCDay()).toBe(0);
  });

  test("formats month names with the Gregorian calendar", () => {
    const june = new Date("2026-06-14T00:00:00.000Z");

    expect(formatGregorianArabicMonthShort(june)).toMatch(/يونيو|جوان/);
    expect(formatGregorianArabicMonthShort(june)).not.toMatch(/ذو الحجة|محرم/);
  });

  test("selects the first day that has schedule availability", () => {
    expect(
      selectInitialBookingDate([
        { dateStr: "2026-06-14", hasAvailability: false },
        { dateStr: "2026-06-15", hasAvailability: true },
        { dateStr: "2026-06-16", hasAvailability: true },
      ]),
    ).toBe("2026-06-15");
  });

  test("falls back to the first date when no day has availability", () => {
    expect(
      selectInitialBookingDate([
        { dateStr: "2026-06-14", hasAvailability: false },
        { dateStr: "2026-06-15", hasAvailability: false },
      ]),
    ).toBe("2026-06-14");
  });
});
