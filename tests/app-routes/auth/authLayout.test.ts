import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("auth layout routing", () => {
  test("redirects authenticated users away from auth screens", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(auth)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain("api.users.me");
    expect(source).toContain("/(patient)");
    expect(source).toContain("/(doctor)/dashboard");
  });

  test("does not redirect new patient signups before profile registration finishes", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(auth)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain('me?.role === "patient" && me.profile');
  });
});
