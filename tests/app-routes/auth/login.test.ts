import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const loginSource = () =>
  readFileSync(join(process.cwd(), "app/(auth)/login.tsx"), "utf8");

describe("login submission", () => {
  test("uses Clerk for email/password sign-in", () => {
    const source = loginSource();

    expect(source).toContain("@clerk/clerk-expo");
    expect(source).toContain("useSignIn");
    expect(source).toContain("signIn.create");
    expect(source).toContain("setActive");
    expect(source).toContain("const [email, setEmail]");
    expect(source).toContain("normalizeEmailForAuth(email)");
    expect(source).toContain("keyboardType=\"email-address\"");
    expect(source).toContain("autoComplete=\"email\"");
    expect(source).toContain("البريد الإلكتروني");
    expect(source).not.toContain("useAuthActions");
    expect(source).not.toContain("flow: 'signIn'");
  });

  test("forgot password delegates recovery to Clerk", () => {
    const source = loginSource();

    expect(source).toContain("handleForgotPassword");
    expect(source).toContain("signIn.create");
    expect(source).toContain("strategy: 'reset_password_email_code'");
    expect(source).toContain("attemptFirstFactor");
    expect(source).not.toContain("flow: 'reset'");
    expect(source).not.toContain("flow: 'reset-verification'");
  });

  test("offers Google sign-in through Clerk SSO", () => {
    const source = loginSource();
    const callbackPath = join(process.cwd(), "app/sso-callback.tsx");

    expect(source).toContain("useSSO");
    expect(source).toContain("startSSOFlow");
    expect(source).toContain("makeRedirectUri");
    expect(source).toContain("redirectUrl: googleRedirectUrl");
    expect(source).toContain("strategy: 'oauth_google'");
    expect(source).toContain("handleGoogleSignIn");
    expect(source).toContain("المتابعة باستخدام Google");
    expect(existsSync(callbackPath)).toBe(true);
  });

  test("matches login accents to the doctor tab blue", () => {
    const source = loginSource();

    expect(source).toContain("color: theme.colors.official");
    expect(source).toContain("backgroundColor: theme.colors.official");
    expect(source).not.toContain("color: theme.colors.primary");
    expect(source).not.toContain("backgroundColor: theme.colors.primary");
  });
});
