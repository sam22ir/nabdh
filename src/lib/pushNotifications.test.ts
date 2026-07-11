import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const pushNotificationsSource = () =>
  readFileSync(join(process.cwd(), "src/lib/pushNotifications.ts"), "utf8");

describe("push notification registration", () => {
  test("does not statically import expo-notifications for Expo Go compatibility", () => {
    const source = pushNotificationsSource();

    expect(source).not.toContain("import * as Notifications from \"expo-notifications\"");
    expect(source).toContain("Constants.executionEnvironment");
    expect(source).toContain("ExecutionEnvironment.StoreClient");
    expect(source).toContain("await import(\"expo-notifications\")");
  });
});
