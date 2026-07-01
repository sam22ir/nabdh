import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const onboardingSource = () =>
  readFileSync(join(process.cwd(), "app/(auth)/onboarding.tsx"), "utf8");

describe("onboarding slide progression", () => {
  test("supports swipe-driven slide changes and the next button", () => {
    const source = onboardingSource();

    expect(source).toContain("handleNextSlide");
    expect(source).toContain("handleSlideScrollEnd");
    expect(source).toContain("onMomentumScrollEnd={handleSlideScrollEnd}");
    expect(source).toContain("getItemLayout={getSlideLayout}");
    expect(source).toContain("onPress={handleNextSlide}");
    expect(source).not.toContain("scrollEnabled={false}");
  });

  test("gives each slide its own header copy", () => {
    const source = onboardingSource();

    expect(source).toContain("headerTitle:");
    expect(source).toContain("headerSubtitle:");
    expect(source).toContain("item.headerTitle");
    expect(source).toContain("item.headerSubtitle");
    expect(source).not.toContain('title="رعاية واضحة من أول خطوة"');
    expect(source).not.toContain('subtitle="اختيار الطبيب، معرفة التفاصيل، وحجز الموعد في مسار واحد سريع."');
  });

  test("centers each slide header at the top of the screen", () => {
    const source = onboardingSource();
    const headerStyles = source.slice(source.indexOf("header: {"), source.indexOf("slide: {"));

    expect(source).not.toContain("<AppHeader");
    expect(source).toContain("styles.headerTitle");
    expect(source).toContain("styles.headerSubtitle");
    expect(headerStyles).toContain("alignItems: 'center'");
    expect(headerStyles).toContain("paddingTop: theme.spacing['2xl']");
    expect(headerStyles).toContain("textAlign: 'center'");
  });

  test("defines three distinct onboarding slides before role selection", () => {
    const source = onboardingSource();

    expect(source).toContain("const slides: Slide[] = [");
    expect(source.match(/icon: '/g)).toHaveLength(3);
    expect(source).toContain("isLastSlide");
    expect(source).toContain("أنا مريض");
    expect(source).toContain("أنا طبيب");
  });
});
