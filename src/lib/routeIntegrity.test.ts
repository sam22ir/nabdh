import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const appDir = join(process.cwd(), "app");
const sourceDirs = [appDir, join(process.cwd(), "src")];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    if (/\.(tsx?|jsx?)$/.test(entry)) return [path];
    return [];
  });
}

function appFileToRoutes(file: string): string[] {
  const rel = relative(appDir, file).split(sep).join("/");
  if (rel.startsWith("_layout.") || rel.endsWith("/_layout.tsx")) return [];

  const withoutExtension = rel.replace(/\.(tsx?|jsx?)$/, "");
  const withoutIndex = withoutExtension.replace(/\/index$/, "").replace(/^index$/, "");
  const grouped = `/${withoutIndex}`.replace(/\/$/, "") || "/";
  const publicPath =
    `/${withoutIndex
      .split("/")
      .filter((segment) => !/^\(.+\)$/.test(segment))
      .join("/")}`.replace(/\/$/, "") || "/";

  return [...new Set([grouped, publicPath])];
}

function routeToRegex(route: string): RegExp {
  const escaped = route
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[\.{3}[^/]+\\\]/g, ".+")
    .replace(/\\\[[^/]+\\\]/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

function staticRoutes(): RegExp[] {
  return walk(appDir).flatMap((file) => appFileToRoutes(file).map(routeToRegex));
}

function hardcodedNavigationPaths(): Array<{ file: string; path: string }> {
  const files = sourceDirs.flatMap(walk);
  const results: Array<{ file: string; path: string }> = [];
  const patterns = [
    /router\.(?:push|replace)\(\s*['"`]([^'"`]+)['"`]/g,
    /pathname:\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const file of files) {
    const content = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        const path = match[1];
        if (path.startsWith("/") && !path.includes("${")) {
          results.push({ file: relative(process.cwd(), file), path });
        }
      }
    }
  }
  return results;
}

describe("hardcoded Expo Router paths", () => {
  test("point at an existing app route", () => {
    const routes = staticRoutes();
    const missing = hardcodedNavigationPaths().filter(
      ({ path }) => !routes.some((route) => route.test(path)),
    );

    expect(missing).toEqual([]);
  });
});
