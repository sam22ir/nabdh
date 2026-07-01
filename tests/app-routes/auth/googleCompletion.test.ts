import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const completeProfilePath = () =>
  join(process.cwd(), "app/complete-profile.tsx");
const completeProfileSource = () => readFileSync(completeProfilePath(), "utf8");

describe("Google profile completion screen", () => {
  test("exists and starts with role selection", () => {
    expect(existsSync(completeProfilePath())).toBe(true);
    const source = completeProfileSource();

    expect(source).toContain("api.users.getProfileCompletionContext");
    expect(source).toContain("useUser");
    expect(source).toContain("useAuth");
    expect(source).toContain("selectedRole");
    expect(source).toContain("أنا مريض");
    expect(source).toContain("أنا طبيب");
  });

  test("prefills and locks Google email", () => {
    const source = completeProfileSource();

    expect(source).toContain("googleEmail");
    expect(source).toContain("editable={false}");
    expect(source).toContain("البريد الإلكتروني");
  });

  test("collects the same required role fields as password signup", () => {
    const source = completeProfileSource();

    expect(source).toContain("رقم الهاتف");
    expect(source).toContain("الولاية");
    expect(source).toContain("البلدية");
    expect(source).toContain("تاريخ الميلاد");
    expect(source).toContain("الجنس");
    expect(source).toContain("التخصص");
    expect(source).toContain("رقم التسجيل في النقابة");
    expect(source).toContain("api.users.register");
  });

  test("blocks duplicate password emails and allows logout", () => {
    const source = completeProfileSource();

    expect(source).toContain("emailBelongsToAnotherUser");
    expect(source).toContain("هذا البريد مسجل من قبل");
    expect(source).toContain("signOut");
    expect(source).toContain("تسجيل الخروج");
  });
});
