import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const authConfigSource = () =>
  readFileSync(join(process.cwd(), "convex/auth.config.ts"), "utf8");

describe("Convex Clerk auth config", () => {
  test("validates Clerk JWTs for the Convex client", () => {
    const source = authConfigSource();

    expect(source).toContain("AuthConfig");
    expect(source).toContain("CLERK_JWT_ISSUER_DOMAIN");
    expect(source).toContain('applicationID: "convex"');
    expect(source).not.toContain("CONVEX_SITE_URL");
  });
});
