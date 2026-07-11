import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("React Native Web warning cleanup", () => {
  test("uses boxShadow for web shadows", () => {
    const themeSource = source("src/lib/theme.ts");

    expect(themeSource).toContain("Platform.select");
    expect(themeSource).toContain("boxShadow");
  });

  test("uses style.pointerEvents instead of the deprecated prop", () => {
    const networkBannerSource = source("src/components/NetworkBanner.tsx");

    expect(networkBannerSource).not.toContain('pointerEvents="none"');
    expect(networkBannerSource).toContain("pointerEvents: 'none'");
  });

  test("modal backdrops do not render as parent buttons around child buttons", () => {
    const searchSource = source("app/(patient)/search.tsx");
    const patientRegisterSource = source("app/(auth)/patient/register.tsx");
    const doctorRegisterSource = source("app/(auth)/doctor/register.tsx");

    expect(searchSource).not.toMatch(/<Pressable\s+style=\{styles\.modalOverlay\}/);
    expect(patientRegisterSource).not.toMatch(/<Pressable\s+style=\{fieldStyles\.modalOverlay\}/);
    expect(doctorRegisterSource).not.toMatch(/<Pressable\s+style=\{fieldStyles\.modalOverlay\}/);
  });

  test("appointment cards with action buttons do not nest buttons", () => {
    const appointmentCardSource = source("src/components/AppointmentCard.tsx");

    expect(appointmentCardSource).toContain("if (showActions) {");
    expect(appointmentCardSource).toContain("<View style={styles.card}>");
  });
});
