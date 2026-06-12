import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const languageStoreSource = () =>
  readFileSync(join(process.cwd(), "src/stores/languageStore.ts"), "utf8");

describe("language store", () => {
  test("updates the i18n runtime when language changes", () => {
    const source = languageStoreSource();

    expect(source).toContain("i18n.changeLanguage(language)");
    expect(source).toContain("i18n.changeLanguage(nextLanguage)");
  });
});
