import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return /\.(tsx?|jsx?)$/.test(entry) ? [path] : [];
  });
}

describe("authStore persistence", () => {
  test("does not persist user profile data to AsyncStorage", () => {
    const source = readFileSync(
      join(process.cwd(), "src/stores/authStore.ts"),
      "utf8",
    );

    expect(source).not.toContain("@react-native-async-storage/async-storage");
    expect(source).not.toContain("zustand/middleware");
    expect(source).not.toContain("auth-storage");
    expect(source).not.toMatch(/\bpersist\s*\(/);
  });

  test("does not use the local auth store as a user profile source", () => {
    const appFiles = walk(join(process.cwd(), "app"));
    const offenders = appFiles
      .map((file) => ({
        file,
        source: readFileSync(file, "utf8"),
      }))
      .filter(({ source }) =>
        /useAuthStore\s*\(\s*\(?\s*s\s*\)?\s*=>\s*s\.user/.test(source),
      )
      .map(({ file }) => file.replace(`${process.cwd()}/`, ""));

    expect(offenders).toEqual([]);
  });
});
