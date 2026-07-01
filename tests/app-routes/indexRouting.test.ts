import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const indexSource = () =>
  readFileSync(join(process.cwd(), "app/index.tsx"), "utf8");

describe("root auth routing", () => {
  test("routes authenticated users without a Nabdh profile to complete-profile", () => {
    const source = indexSource();

    expect(source).toContain("api.users.getProfileCompletionContext");
    expect(source).toContain("/complete-profile");
    expect(source.indexOf("/complete-profile")).toBeLessThan(
      source.indexOf("/(auth)/onboarding"),
    );
  });

  test("does not send missing-profile users to patient or doctor areas", () => {
    const source = indexSource();

    expect(source).toContain("me.role === 'patient' && me.profile");
    expect(source).toContain("me.role === 'doctor' && me.profile");
  });
});
