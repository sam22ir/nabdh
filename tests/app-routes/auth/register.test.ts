import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const registerSource = () =>
  readFileSync(join(process.cwd(), "app/(auth)/register.tsx"), "utf8");

describe("registration submission", () => {
  test("requires phone and email, then signs up through Clerk before completing the profile", () => {
    const source = registerSource();

    expect(source).toContain("@clerk/clerk-expo");
    expect(source).toContain("useSignUp");
    expect(source).toContain("signUp.create");
    expect(source).toContain("setActive");
    expect(source).toContain("phone: phoneSchema");
    expect(source).toContain("email: emailSchema");
    expect(source).toContain("normalizePhoneForAuth(data.phone)");
    expect(source).toContain("normalizeEmailForAuth(data.email)");
    expect(source).toContain("phone: data.phone");
    expect(source).toContain("email: emailAuthIdentifier");
    expect(source).toContain("name=\"phone\"");
    expect(source).toContain("keyboardType=\"phone-pad\"");
    expect(source).toContain("autoComplete=\"tel\"");
    expect(source).toContain("البريد الإلكتروني");
    expect(source).not.toContain("optionalEmailSchema");
    expect(source).not.toContain("البريد الإلكتروني (اختياري)");
    expect(source).not.toContain("useAuthActions");
    expect(source).not.toContain("flow: 'signUp'");
  });

  test("does not bypass required Convex location ids with undefined casts", () => {
    const source = registerSource();

    expect(source).not.toMatch(/wilayaId:\s*undefined\s+as\s+any/);
    expect(source).not.toMatch(/communeId:\s*undefined\s+as\s+any/);
  });

  test("commune picker handles loading and empty state after wilaya selection", () => {
    const source = registerSource();

    expect(source).toContain("const communesLoading = selectedWilayaId != null && communes === undefined;");
    expect(source).toContain("emptyMessage");
    expect(source).toContain("loading={communesLoading}");
    expect(source).toContain("لا توجد بلديات متاحة لهذه الولاية");
  });

  test("patient signup collects and sends required patient profile fields", () => {
    const source = registerSource();

    expect(source).toContain("dateOfBirth");
    expect(source).toContain("gender");
    expect(source).toContain("تاريخ الميلاد");
    expect(source).toContain("الجنس");
    expect(source).toContain("dateOfBirth: data.dateOfBirth");
    expect(source).toContain("gender: data.gender");
  });

  test("waits for the Clerk to Convex auth handshake before completing registration", () => {
    const source = registerSource();

    expect(source).toContain("useConvexAuth");
    expect(source).toContain("pendingRegistration");
    expect(source).not.toMatch(/await signUp\.create\([\s\S]*await registerUser\(/);
  });

  test("checks duplicate email accounts before calling password signUp", () => {
    const source = registerSource();
    const duplicateCheckIndex = source.indexOf("isPasswordAccountRegistered");
    const signUpIndex = source.indexOf("signUp.create");

    expect(source).toContain("api.users.isPasswordAccountRegistered");
    expect(source).toContain("emailAccountExists");
    expect(source).toContain("البريد الإلكتروني مستخدم بالفعل");
    expect(duplicateCheckIndex).toBeGreaterThan(-1);
    expect(signUpIndex).toBeGreaterThan(-1);
    expect(duplicateCheckIndex).toBeLessThan(signUpIndex);
  });

  test("renders Clerk CAPTCHA anchor for the custom signup flow", () => {
    const source = registerSource();

    expect(source).toContain('nativeID="clerk-captcha"');
    expect(source).toContain("styles.clerkCaptcha");
  });

  test("offers Google sign-up as authentication only and sends profile completion to root routing", () => {
    const source = registerSource();
    const callbackPath = join(process.cwd(), "app/sso-callback.tsx");

    expect(source).toContain("useSSO");
    expect(source).toContain("startSSOFlow");
    expect(source).toContain("makeRedirectUri");
    expect(source).toContain("redirectUrl: googleRedirectUrl");
    expect(source).toContain("strategy: 'oauth_google'");
    expect(source).toContain("handleStartGoogleSignUp");
    expect(source).toContain("router.replace('/')");
    expect(source).toContain("المتابعة باستخدام Google");
    expect(source).not.toContain("handleCompleteGoogleRegistration");
    expect(source).not.toContain("googleSessionId");
    expect(existsSync(callbackPath)).toBe(true);
    expect(source.indexOf("handleStartGoogleSignUp")).toBeLessThan(
      source.indexOf("{/* Password */}"),
    );
  });

  test("handles Clerk email code verification before completing the profile", () => {
    const source = registerSource();

    expect(source).toContain("prepareEmailAddressVerification");
    expect(source).toContain("attemptEmailAddressVerification");
    expect(source).toContain("verificationModalVisible");
    expect(source).toContain("verificationCode");
    expect(source).toContain("handleResendVerificationCode");
    expect(source).toContain("رمز التحقق");
    expect(source).toContain("لم يصلك الرمز؟ أرسل رمزاً جديداً");
    expect(source).not.toContain("Sign up did not complete.");
  });
});
