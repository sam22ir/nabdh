import { describe, expect, test } from "vitest";

import { getArabicErrorMessage } from "./errorMessages";

describe("getArabicErrorMessage", () => {
  test("maps incomplete patient profile backend errors to an Arabic prompt", () => {
    expect(
      getArabicErrorMessage(
        new Error("Patient profile not found. Please complete registration."),
        "fallback",
      ),
    ).toBe("يرجى إكمال ملفك الطبي قبل المتابعة.");
  });

  test("does not expose unknown raw technical messages", () => {
    expect(
      getArabicErrorMessage(new Error("Request ID abc Server Error"), "حدث خطأ"),
    ).toBe("حدث خطأ");
  });
});
