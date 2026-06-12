/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedFamilyProfiles() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const ownerUserId = await ctx.db.insert("users", {
      email: "family-owner@example.test",
      role: "patient",
      fullNameAr: "رب الأسرة",
      isActive: true,
    });
    const otherUserId = await ctx.db.insert("users", {
      email: "family-other@example.test",
      role: "patient",
      fullNameAr: "مستخدم آخر",
      isActive: true,
    });

    const ownerProfileId = await ctx.db.insert("patientProfiles", {
      parentUserId: ownerUserId,
      fullNameAr: "طفل المالك",
      dateOfBirth: "2020-01-01",
      gender: "male",
      bloodType: "O+",
      chronicDiseases: [],
      allergies: ["lactose"],
    });
    await ctx.db.insert("patientProfiles", {
      parentUserId: otherUserId,
      fullNameAr: "طفل آخر",
      dateOfBirth: "2019-01-01",
      gender: "female",
      chronicDiseases: [],
      allergies: [],
    });

    return { ownerUserId, ownerProfileId };
  });

  return { t, ids };
}

function asUser(
  t: Awaited<ReturnType<typeof seedFamilyProfiles>>["t"],
  userId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${userId}|session`,
    tokenIdentifier: `password:${userId}@example.test`,
  });
}

describe("patientProfiles.listMy", () => {
  test("returns only family profiles owned by the authenticated patient", async () => {
    const { t, ids } = await seedFamilyProfiles();

    const profiles = await asUser(t, ids.ownerUserId).query(
      api.patientProfiles.listMy,
      {},
    );

    expect(profiles).toHaveLength(1);
    expect(profiles[0]._id).toBe(ids.ownerProfileId);
    expect(profiles[0].fullNameAr).toBe("طفل المالك");
  });
});

describe("patientProfiles.create", () => {
  test("creates a family profile for the authenticated patient", async () => {
    const { t, ids } = await seedFamilyProfiles();

    const profileId = await asUser(t, ids.ownerUserId).mutation(
      api.patientProfiles.create,
      {
        fullNameAr: "فرد جديد",
        dateOfBirth: "2018-03-04",
        gender: "female",
        bloodType: "A+",
        chronicDiseases: [],
        allergies: ["penicillin"],
      },
    );

    const profiles = await asUser(t, ids.ownerUserId).query(
      api.patientProfiles.listMy,
      {},
    );

    expect(profiles.some((profile) => profile._id === profileId)).toBe(true);
    expect(profiles.find((profile) => profile._id === profileId)).toMatchObject({
      parentUserId: ids.ownerUserId,
      fullNameAr: "فرد جديد",
      gender: "female",
      allergies: ["penicillin"],
    });
  });
});
