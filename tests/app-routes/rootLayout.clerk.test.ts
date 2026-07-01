import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const rootLayoutSource = () =>
  readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

describe("root Clerk provider wiring", () => {
  test("wraps Expo in Clerk and ConvexProviderWithClerk", () => {
    const source = rootLayoutSource();

    expect(source).toContain("@clerk/clerk-expo");
    expect(source).toContain("ClerkProvider");
    expect(source).toContain("tokenCache");
    expect(source).toContain("ConvexProviderWithClerk");
    expect(source).toContain("useAuth");
    expect(source).toContain("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(source).not.toContain("ConvexAuthProvider");
    expect(source).not.toContain("@convex-dev/auth/react");
  });
});
