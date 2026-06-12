/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

describe("specialties.list", () => {
  test("returns specialties sorted by Arabic display name", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("specialties", {
        nameAr: "طب القلب",
        nameFr: "Cardiologie",
        icon: "heart",
      });
      await ctx.db.insert("specialties", {
        nameAr: "الأمراض الجلدية",
        nameFr: "Dermatologie",
        icon: "skin",
      });
    });

    const result = await t.query((api as any).specialties.list, {});

    expect(result.map((specialty: { nameAr: string }) => specialty.nameAr)).toEqual([
      "الأمراض الجلدية",
      "طب القلب",
    ]);
  });
});
