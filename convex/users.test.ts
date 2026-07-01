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
  test("reports an existing password account before signup", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "patient@example.test",
        phone: "0559935601",
      });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "patient@example.test",
        secret: "hashed-password-placeholder",
      });
    });

    await expect(
      t.query(api.users.isPasswordAccountRegistered, {
        email: "  PATIENT@Example.TEST  ",
      }),
    ).resolves.toBe(true);
    await expect(
      t.query(api.users.isPasswordAccountRegistered, {
        email: "other@example.test",
      }),
    ).resolves.toBe(false);
  });

  test("reports current Clerk identity and duplicate email state for profile completion", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "taken@example.test",
        tokenIdentifier: "password:legacy-user",
        role: "patient",
        fullNameAr: "مستخدم موجود",
        isActive: true,
      });
    });

    const context = await t
      .withIdentity({
        subject: "google-subject-1",
        tokenIdentifier:
          "https://select-kiwi-66.clerk.accounts.dev|google-user-1",
        email: "taken@example.test",
        name: "Google User",
      })
      .query(api.users.getProfileCompletionContext, {});

    expect(context).toMatchObject({
      isAuthenticated: true,
      existingUser: null,
      email: "taken@example.test",
      name: "Google User",
      emailBelongsToAnotherUser: true,
    });
  });

  test("does not report duplicate email when the email belongs to the current identity", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "same@example.test",
        tokenIdentifier:
          "https://select-kiwi-66.clerk.accounts.dev|google-user-2",
        role: "patient",
        fullNameAr: "نفس المستخدم",
        isActive: true,
      });
    });

    const context = await t
      .withIdentity({
        subject: "google-subject-2",
        tokenIdentifier:
          "https://select-kiwi-66.clerk.accounts.dev|google-user-2",
        email: "same@example.test",
        name: "Same User",
      })
      .query(api.users.getProfileCompletionContext, {});

    expect(context).toMatchObject({
      isAuthenticated: true,
      email: "same@example.test",
      emailBelongsToAnotherUser: false,
    });
  });

  test("rejects registration when email belongs to another identity", async () => {
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
      await ctx.db.insert("users", {
        email: "taken@example.test",
        tokenIdentifier: "password:legacy-user",
        role: "patient",
        fullNameAr: "مستخدم موجود",
        isActive: true,
      });
      return { communeId, wilayaId };
    });

    await expect(
      t
        .withIdentity({
          subject: "google-subject-3",
          tokenIdentifier:
            "https://select-kiwi-66.clerk.accounts.dev|google-user-3",
          email: "taken@example.test",
          name: "Blocked Google User",
        })
        .mutation(api.users.register, {
          fullNameAr: "مستخدم Google",
          phone: "0555123456",
          email: "taken@example.test",
          role: "patient",
          wilayaId: ids.wilayaId,
          communeId: ids.communeId,
          dateOfBirth: "1990-01-01",
          gender: "male",
        }),
    ).rejects.toThrow(/email already belongs to another account/i);
  });

  test("stores required phone and email during registration", async () => {
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
        email: "patient@example.test",
      });
      return { communeId, wilayaId, userId };
    });

    await asUser(t, ids.userId).mutation(api.users.register, {
      fullNameAr: "مريض هاتف",
      role: "patient",
      wilayaId: ids.wilayaId,
      communeId: ids.communeId,
      dateOfBirth: "1990-01-01",
      gender: "male",
      phone: "0555123456",
      email: "  PATIENT@Example.TEST  ",
    });

    const user = await t.run((ctx) => ctx.db.get(ids.userId));
    expect(user).toMatchObject({
      phone: "0555123456",
      email: "patient@example.test",
      tokenIdentifier: `password:${ids.userId}@example.test`,
    });
  });

  test("rejects registration when required email is omitted", async () => {
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
        email: "missing-email@example.test",
      });
      return { communeId, wilayaId, userId };
    });

    await expect(
      asUser(t, ids.userId).mutation(api.users.register, {
        fullNameAr: "مريض بلا بريد",
        role: "patient",
        wilayaId: ids.wilayaId,
        communeId: ids.communeId,
        dateOfBirth: "1990-01-01",
        gender: "male",
        phone: "0555123456",
      } as any),
    ).rejects.toThrow(/email/i);
  });

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
        phone: "0555123000",
        email: "new-patient@example.test",
        role: "patient",
        wilayaId: ids.wilayaId,
      }),
    ).rejects.toThrow(/patient profile|required|commune|birth|gender/i);
  });

  test("rejects doctor signup without required doctor profile fields", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const wilayaId = await ctx.db.insert("wilayas", {
        id: 16,
        nameAr: "الجزائر",
        nameFr: "Alger",
      });
      const userId = await ctx.db.insert("users", {
        email: "new-doctor@example.test",
      });
      return { wilayaId, userId };
    });

    await expect(
      asUser(t, ids.userId).mutation(api.users.register, {
        fullNameAr: "طبيب جديد",
        phone: "0555123001",
        email: "new-doctor@example.test",
        role: "doctor",
        wilayaId: ids.wilayaId,
      }),
    ).rejects.toThrow(/doctor profile|required|specialty|registration/i);
  });
});

describe("users.completeDoctorProfile", () => {
  test("creates the missing doctor profile for an existing doctor user", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert("specialties", {
        nameAr: "طب عام",
        nameFr: "Medecine generale",
        icon: "stethoscope",
      });
      const userId = await ctx.db.insert("users", {
        email: "missing-doctor-profile@example.test",
        role: "doctor",
        fullNameAr: "طبيب بلا ملف",
        isActive: true,
      });
      return { specialtyId, userId };
    });

    await expect(
      asUser(t, ids.userId).mutation(api.users.completeDoctorProfile, {
        specialtyId: ids.specialtyId,
        orderRegistrationNumber: "DOC-2026-1",
      }),
    ).resolves.toBeTypeOf("string");

    const me = await asUser(t, ids.userId).query(api.users.me, {});
    expect(me?.profile).toMatchObject({
      specialtyId: ids.specialtyId,
      orderRegistrationNumber: "DOC-2026-1",
      isVerified: false,
      isProfileComplete: true,
    });
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
