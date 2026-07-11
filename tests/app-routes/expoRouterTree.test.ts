import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const findRouteTreeTestFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);

  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return findRouteTreeTestFiles(path);
    }

    return /\.(test|spec)\.[tj]sx?$/.test(entry) ? [path] : [];
  });
};

describe("Expo Router app tree", () => {
  test("does not include test files in the routable app directory", () => {
    expect(findRouteTreeTestFiles(join(process.cwd(), "app"))).toEqual([]);
  });
});
