import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("backend selection", () => {
  test("documents Supabase as the active backend and ships its migrations", () => {
    const context = readFileSync(join(process.cwd(), "CONTEXT.md"), "utf8");
    const dir = join(process.cwd(), "supabase/migrations");
    const sql = existsSync(dir)
      ? readdirSync(dir).filter((file) => file.endsWith(".sql"))
      : [];

    expect(context).toContain("Supabase backend");
    expect(context).toContain("Google");
    expect(sql.length).toBeGreaterThan(0);
  });

  test("the app no longer depends on Clerk", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((name) => name.startsWith("@clerk/"))).toBe(false);
  });
});
