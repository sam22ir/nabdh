import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const rootLayoutSource = () =>
  readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

describe("root provider wiring", () => {
  test("wraps Expo in the Supabase auth and backend providers", () => {
    const source = rootLayoutSource();

    expect(source).toContain("AuthProvider");
    expect(source).toContain("BackendProvider");
    expect(source).not.toContain("clerk");
    expect(source).not.toContain("Convex");
  });

  test("declares the welcome and onboarding routes before route groups", () => {
    const source = rootLayoutSource();

    expect(source).toContain('<Stack.Screen name="index" />');
    expect(source).toContain('<Stack.Screen name="onboarding" />');
    expect(source.indexOf('name="index"')).toBeLessThan(
      source.indexOf('name="(auth)"'),
    );
  });
});
