import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("doctor settings interactions", () => {
  test("notification settings render as a collapsed accordion that can expand", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).toContain("alertsExpanded");
    expect(source).toContain("setAlertsExpanded");
    expect(source).toContain("const [alertsExpanded, setAlertsExpanded] = useState(false)");
    expect(source).toContain("onPress={() => setAlertsExpanded((current) => !current)}");
    expect(source).toContain("alertsExpanded ? 'chevron-up' : 'chevron-down'");
    expect(source).toContain("{alertsExpanded ? (");
    expect(source).toContain("styles.accordionTrigger");
    expect(source).toContain("styles.accordionBody");
  });

  test("settings remove the booking accordion entirely", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(doctor)/settings.tsx"),
      "utf8",
    );

    expect(source).not.toContain("policyExpanded");
    expect(source).not.toContain("setPolicyExpanded");
    expect(source).not.toContain(">الحجز</Text>");
    expect(source).not.toContain("التأكيد التلقائي للحجوزات");
    expect(source).not.toContain("الحد الأدنى لإشعار الإلغاء");
  });

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
