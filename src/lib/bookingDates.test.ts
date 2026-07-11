import { describe, expect, test } from "vitest";
import {
  formatBookingDateStr,
  formatAlgerianGregorianMonth,
  formatGregorianArabicMonthShort,
  getBookingDayOfWeek,
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

  test("uses Algerian Gregorian month names in booking calendars", () => {
    const july = new Date("2026-07-11T00:00:00.000Z");

    expect(formatAlgerianGregorianMonth(july)).toBe("جويلية");
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

  test("maps Algeria calendar dates to the same weekday index used by booking slots", () => {
    const mondayInAlgeria = new Date("2026-07-06T00:00:00.000Z");

    expect(getBookingDayOfWeek(mondayInAlgeria)).toBe(1);
  });
});
