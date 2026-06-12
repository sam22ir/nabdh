import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const registerSource = () =>
  readFileSync(join(process.cwd(), "app/(auth)/register.tsx"), "utf8");

describe("registration submission", () => {
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

  test("waits for the Convex Auth handshake before completing registration", () => {
    const source = registerSource();

    expect(source).toContain("useConvexAuth");
    expect(source).toContain("pendingRegistration");
    expect(source).not.toMatch(/await signIn\([\s\S]*await registerUser\(/);
  });
});
