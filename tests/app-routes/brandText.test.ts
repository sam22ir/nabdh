import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sourceFiles = [
  "app/(auth)/login.tsx",
  "app/(patient)/profile.tsx",
  "app/(doctor)/settings.tsx",
];

describe("Arabic brand text", () => {
  test("uses نبض instead of the misspelled نبد", () => {
    const source = sourceFiles
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).toContain("نبض");
    expect(source).not.toContain("نبد");
  });
});
