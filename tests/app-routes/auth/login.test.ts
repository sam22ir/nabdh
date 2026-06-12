import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const loginSource = () =>
  readFileSync(join(process.cwd(), "app/(auth)/login.tsx"), "utf8");

describe("login submission", () => {
  test("passes the Convex Auth password signIn flow", () => {
    const source = loginSource();

    expect(source).toContain("flow: 'signIn'");
  });

  test("forgot password button invokes a user-facing reset handler", () => {
    const source = loginSource();

    expect(source).toContain("handleForgotPassword");
    expect(source).toContain("flow: 'reset'");
    expect(source).toContain("Alert.alert");
    expect(source).not.toContain("Placeholder");
  });
});
