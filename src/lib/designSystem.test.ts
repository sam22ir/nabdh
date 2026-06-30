import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Nabdh redesign system", () => {
  test("theme exposes doctor primitive foundation tokens", () => {
    const source = readProjectFile("src/lib/theme.ts");

    expect(source).toContain("primary: '#1A7BC4'");
    expect(source).toContain("background: '#F8FAFC'");
    expect(source).toContain("lg: 16");
    expect(source).toContain("xl: 24");
    expect(source).toContain("official:");
    expect(source).toContain("surfaceRaised:");
    expect(source).toContain("status:");
    expect(source).toContain("neutral:");
    expect(source).toContain("borderStrong:");
  });

  test("shared UI primitives used by the redesign have explicit exports", () => {
    const componentPath = join(process.cwd(), "src/components/ui.tsx");

    expect(existsSync(componentPath)).toBe(true);

    const source = readFileSync(componentPath, "utf8");
    expect(source).toContain("export function Button");
    expect(source).toContain("export function Badge");
    expect(source).toContain("export function Panel");
    expect(source).toContain("export function AppHeader");
    expect(source).toContain("export function LoadingState");
    expect(source).toContain("export function TrustRow");
    expect(source).toContain("theme.colors.status");
  });

  test("doctor operational primitives exist for the doctor tabs redesign", () => {
    const componentPath = join(process.cwd(), "src/components/doctor-ui.tsx");

    expect(existsSync(componentPath)).toBe(true);

    const source = readFileSync(componentPath, "utf8");
    expect(source).toContain("export function DoctorHeader");
    expect(source).toContain("export function MetricStrip");
    expect(source).toContain("export function SegmentedControl");
    expect(source).toContain("export function AppointmentWorkItem");
    expect(source).toContain("export function DoctorSection");
  });
});
