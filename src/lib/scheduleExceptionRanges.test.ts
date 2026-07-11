import { describe, expect, test } from "vitest";

import { groupScheduleExceptionRanges } from "./scheduleExceptionRanges";

describe("schedule exception ranges", () => {
  test("groups consecutive vacation dates for the same clinic and reason into one displayed range", () => {
    const ranges = groupScheduleExceptionRanges([
      {
        id: "ex-2",
        clinicId: "clinic-a",
        exceptionDate: "2026-07-07",
        reason: "إجازة سنوية",
      },
      {
        id: "ex-1",
        clinicId: "clinic-a",
        exceptionDate: "2026-07-06",
        reason: "إجازة سنوية",
      },
      {
        id: "ex-3",
        clinicId: "clinic-a",
        exceptionDate: "2026-07-08",
        reason: "إجازة سنوية",
      },
    ]);

    expect(ranges).toEqual([
      {
        id: "ex-1",
        ids: ["ex-1", "ex-2", "ex-3"],
        clinicId: "clinic-a",
        startDate: "2026-07-06",
        endDate: "2026-07-08",
        reason: "إجازة سنوية",
      },
    ]);
  });

  test("does not merge different clinics, reasons, or non-consecutive dates", () => {
    const ranges = groupScheduleExceptionRanges([
      {
        id: "ex-1",
        clinicId: "clinic-a",
        exceptionDate: "2026-07-06",
        reason: "إجازة سنوية",
      },
      {
        id: "ex-2",
        clinicId: "clinic-a",
        exceptionDate: "2026-07-08",
        reason: "إجازة سنوية",
      },
      {
        id: "ex-3",
        clinicId: "clinic-a",
        exceptionDate: "2026-07-09",
        reason: "مؤتمر",
      },
      {
        id: "ex-4",
        clinicId: "clinic-b",
        exceptionDate: "2026-07-09",
        reason: "مؤتمر",
      },
    ]);

    expect(ranges.map((range) => range.ids)).toEqual([
      ["ex-1"],
      ["ex-2"],
      ["ex-3"],
      ["ex-4"],
    ]);
  });
});
