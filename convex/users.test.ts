/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedPatientProfiles() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const communeId = await ctx.db.insert("communes", {
      wilayaId: await ctx.db.insert("wilayas", {
        id: 16,
        nameAr: "الجزائر",
        nameFr: "Alger",
      }),
      nameAr: "الجزائر الوسطى",
      nameFr: "Alger Centre",
    });

    const ownerUserId = await ctx.db.insert("users", {
      email: "owner@example.test",
      role: "patient",
      fullNameAr: "صاحب الملف",
      isActive: true,
    });
    await ctx.db.insert("patients", {
      userId: ownerUserId,
      dateOfBirth: "1980-01-01",
      gender: "male",
      communeId,
      chronicDiseases: ["private"],
      allergies: ["private"],
      emergencyContactName: "Private",
      emergencyContactPhone: "0555000000",
    });

    const callerUserId = await ctx.db.insert("users", {
      email: "caller@example.test",
      role: "patient",
      fullNameAr: "مستخدم آخر",
      isActive: true,
    });

    return { ownerUserId, callerUserId };
  });

  return { t, ids };
}

function asUser(
  t: Awaited<ReturnType<typeof seedPatientProfiles>>["t"],
  userId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${userId}|session`,
    tokenIdentifier: `password:${userId}@example.test`,
  });
}

describe("users.getProfile", () => {
  test("rejects unauthenticated profile lookups", async () => {
    const { t, ids } = await seedPatientProfiles();

    await expect(
      t.query(api.users.getProfile, { userId: ids.ownerUserId }),
    ).rejects.toThrow(/authenticated/i);
  });

  test("rejects other-user patient profile lookups", async () => {
    const { t, ids } = await seedPatientProfiles();

    await expect(
      asUser(t, ids.callerUserId).query(api.users.getProfile, {
        userId: ids.ownerUserId,
      }),
    ).rejects.toThrow(/access|denied|own/i);
  });

  test("allows a user to read their own profile", async () => {
    const { t, ids } = await seedPatientProfiles();

    const profile = await asUser(t, ids.ownerUserId).query(api.users.getProfile, {
      userId: ids.ownerUserId,
    });

    expect(profile?.profile).toMatchObject({
      chronicDiseases: ["private"],
      allergies: ["private"],
    });
  });
});

describe("users.register", () => {
  test("rejects patient signup without required patient profile fields", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const wilayaId = await ctx.db.insert("wilayas", {
        id: 16,
        nameAr: "الجزائر",
        nameFr: "Alger",
      });
      const userId = await ctx.db.insert("users", {
        email: "new-patient@example.test",
      });
      return { wilayaId, userId };
    });

    await expect(
      asUser(t, ids.userId).mutation(api.users.register, {
        fullNameAr: "مريض جديد",
        role: "patient",
        wilayaId: ids.wilayaId,
      }),
    ).rejects.toThrow(/patient profile|required|commune|birth|gender/i);
  });
});

describe("users.completePatientProfile", () => {
  test("creates the missing patient profile for an existing patient user", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const wilayaId = await ctx.db.insert("wilayas", {
        id: 16,
        nameAr: "الجزائر",
        nameFr: "Alger",
      });
      const communeId = await ctx.db.insert("communes", {
        wilayaId,
        nameAr: "الجزائر الوسطى",
        nameFr: "Alger Centre",
      });
      const userId = await ctx.db.insert("users", {
        email: "missing-profile@example.test",
        role: "patient",
        fullNameAr: "مريض بلا ملف",
        isActive: true,
      });
      return { communeId, userId };
    });

    await expect(
      asUser(t, ids.userId).mutation(api.users.completePatientProfile, {
        dateOfBirth: "1990-01-01",
        gender: "male",
        communeId: ids.communeId,
      }),
    ).resolves.toBeTypeOf("string");

    const me = await asUser(t, ids.userId).query(api.users.me, {});
    expect(me?.profile).toMatchObject({
      dateOfBirth: "1990-01-01",
      gender: "male",
      communeId: ids.communeId,
    });
  });
});
