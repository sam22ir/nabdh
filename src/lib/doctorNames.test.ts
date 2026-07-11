import { describe, expect, test } from "vitest";

import { stripArabicDoctorTitle } from "./doctorNames";

describe("stripArabicDoctorTitle", () => {
  test("removes an existing Arabic doctor prefix before UI adds its own", () => {
    expect(stripArabicDoctorTitle("د. معاينة التصميم")).toBe("معاينة التصميم");
    expect(stripArabicDoctorTitle("د معاينة التصميم")).toBe("معاينة التصميم");
    expect(stripArabicDoctorTitle("معاينة التصميم")).toBe("معاينة التصميم");
  });

  test("does not strip ordinary names that only start with the letter dal", () => {
    expect(stripArabicDoctorTitle("دلال أحمد")).toBe("دلال أحمد");
    expect(stripArabicDoctorTitle("دكتور سامي")).toBe("دكتور سامي");
  });
});
