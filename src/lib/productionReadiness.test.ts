import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("production readiness docs", () => {
  test("documents setup commands, Clerk env vars, and seed data", () => {
    const readmePath = join(process.cwd(), "README.md");
    expect(existsSync(readmePath)).toBe(true);

    const readme = readFileSync(readmePath, "utf8");
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(readme).toContain("npm install");
    expect(readme).toContain("npx convex dev");
    expect(readme).toContain("npm test");
    expect(readme).toContain("npm run typecheck");
    expect(readme).toContain("internal.seed.seed");
    expect(readme).toContain("Convex backend");

    expect(envExample).toContain("EXPO_PUBLIC_CONVEX_URL");
    expect(envExample).toContain("CONVEX_DEPLOYMENT");
    expect(envExample).toContain("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(envExample).toContain("CLERK_JWT_ISSUER_DOMAIN");
  });
});
