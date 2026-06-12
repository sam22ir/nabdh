import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const onboardingSource = () =>
  readFileSync(join(process.cwd(), "app/(auth)/onboarding.tsx"), "utf8");

describe("onboarding slide progression", () => {
  test("uses a next button instead of swipe-driven slide changes", () => {
    const source = onboardingSource();

    expect(source).toContain("handleNextSlide");
    expect(source).toContain("scrollEnabled={false}");
    expect(source).toContain("onPress={handleNextSlide}");
  });
});
