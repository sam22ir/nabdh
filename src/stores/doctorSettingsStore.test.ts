import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("doctor settings store", () => {
  test("persists doctor settings in AsyncStorage", () => {
    const source = readFileSync(
      join(process.cwd(), "src/stores/doctorSettingsStore.ts"),
      "utf8",
    );

    expect(source).toContain("persist(");
    expect(source).toContain("createJSONStorage(() => AsyncStorage)");
    expect(source).toContain("doctor-settings-storage");
    expect(source).toContain("newBookingAlerts");
    expect(source).toContain("minCancelHours");
  });
});
