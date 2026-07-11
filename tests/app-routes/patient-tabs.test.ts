import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const patientLayoutSource = () =>
  readFileSync(join(process.cwd(), "app/(patient)/_layout.tsx"), "utf8");

describe("patient tabs", () => {
  test("hides nested flow routes from the bottom tab bar", () => {
    const source = patientLayoutSource();

    expect(source).toContain('<Tabs.Screen name="doctor/[id]" options={{ href: null }} />');
    expect(source).toContain('<Tabs.Screen name="booking/clinic" options={{ href: null }} />');
    expect(source).toContain('<Tabs.Screen name="booking/profile" options={{ href: null }} />');
    expect(source).toContain('<Tabs.Screen name="booking/datetime" options={{ href: null }} />');
    expect(source).toContain('<Tabs.Screen name="booking/confirm" options={{ href: null }} />');
    expect(source).toContain('<Tabs.Screen name="booking/success" options={{ href: null }} />');
  });
});
