import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function listSqlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return listSqlFiles(path);
    return entry.endsWith(".sql") ? [path] : [];
  });
}

describe("backend selection", () => {
  test("documents Convex as active backend and has no deployable Supabase migrations", () => {
    const context = readFileSync(join(process.cwd(), "CONTEXT.md"), "utf8");
    const activeSupabaseSql = listSqlFiles(
      join(process.cwd(), "supabase/migrations"),
    );

    expect(context).toContain("Convex backend");
    expect(context).not.toContain("Supabase backend");
    expect(activeSupabaseSql).toEqual([]);
  });
});
