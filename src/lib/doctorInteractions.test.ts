import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("doctor settings interactions", () => {
  test("notification rows toggle when the row itself is pressed", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).toContain("onPress={() => onValueChange(!value)}");
    expect(source).toContain("styles.toggleRowPressed");
    expect(source).toContain("pointerEvents=\"none\"");
  });

  test("settings press targets do not wrap nested web buttons", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).toContain("styles.toggleRowPressTarget");
    expect(source).toContain("styles.modalBackdrop");
    expect(source).not.toContain("<Pressable\n    style={styles.modalOverlay}");
  });
});

describe("doctor schedule interactions", () => {
  test("add-exception button has a clear disabled state when no clinic exists", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/schedule.tsx"),
      "utf8",
    );

    expect(source).toContain("styles.addExceptionButtonDisabled");
    expect(source).toContain("clinics.length === 0");
    expect(source).toContain("أضف عيادة أولاً");
  });

  test("empty clinic state links doctors to the profile clinic form", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/schedule.tsx"),
      "utf8",
    );

    expect(source).toContain("useRouter");
    expect(source).toContain("router.push('/(doctor)/profile')");
    expect(source).toContain("styles.emptyClinicAction");
    expect(source).toContain("إضافة عيادة");
  });
});
