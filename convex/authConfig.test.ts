import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const authSource = () => readFileSync(join(process.cwd(), "convex/auth.ts"), "utf8");

describe("Convex Auth password configuration", () => {
  test("configures email password reset delivery without phone OTP", () => {
    const source = authSource();

    expect(source).toContain("Password({");
    expect(source).toContain('@convex-dev/auth/providers/Email');
    expect(source).toContain("reset:");
    expect(source).toContain("sendVerificationRequest");
    expect(source).toContain("AUTH_RESEND_KEY");
    expect(source).toContain("AUTH_EMAIL_FROM");
    expect(source).not.toContain("normalizePhoneForAuth");
  });
});
