/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedDoctorProfileData() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert("specialties", {
      nameAr: "طب عام",
      nameFr: "Medecine generale",
      icon: "stethoscope",
    });
    const subSpecialtyId = await ctx.db.insert("specialties", {
      nameAr: "طب القلب",
      nameFr: "Cardiologie",
      icon: "heart",
    });
    const doctorUserId = await ctx.db.insert("users", {
      email: "profile-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب قديم",
      fullNameFr: "Ancien Docteur",
      phone: "0555000000",
      isActive: true,
    });
    const doctorId = await ctx.db.insert("doctors", {
      userId: doctorUserId,
      specialtyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 1,
      languages: ["ar"],
      orderRegistrationNumber: "OLD-1",
      isVerified: true,
      isProfileComplete: true,
      consultationFee: 1000,
      followUpFee: 500,
      avgRating: 0,
      totalReviews: 0,
    });

    return { doctorUserId, doctorId, specialtyId, subSpecialtyId };
  });

  return { t, ids };
}

function asDoctor(
  t: Awaited<ReturnType<typeof seedDoctorProfileData>>["t"],
  doctorUserId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${doctorUserId}|session`,
    tokenIdentifier: "password:profile-doctor@example.test",
  });
}

describe("doctor rating aggregation", () => {
  test("uses the hidden-review index instead of scan filtering", () => {
    const source = readFileSync(join(process.cwd(), "convex/doctors.ts"), "utf8");

    expect(source).toContain("by_doctorId_and_isHidden");
    expect(source).not.toMatch(
      /withIndex\("by_doctorId"[\s\S]*?field\("isHidden"\)/,
    );
  });
});

describe("doctors.updateProfile", () => {
  test("persists editable user and doctor profile fields", async () => {
    const { t, ids } = await seedDoctorProfileData();

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.doctors.updateProfile, {
        fullNameAr: "طبيب جديد",
        fullNameFr: "Nouveau Docteur",
        phone: "0666000000",
        specialtyId: ids.specialtyId,
        subSpecialties: [ids.subSpecialtyId],
        bioAr: "سيرة عربية",
        bioFr: "Bio francaise",
        yearsOfExperience: 12,
        languages: ["ar", "fr"],
        orderRegistrationNumber: "NEW-2",
        consultationFee: 3000,
        followUpFee: 1500,
      }),
    ).resolves.toBe(ids.doctorId);

    const updated = await t.run(async (ctx) => {
      const doctor = await ctx.db.get(ids.doctorId);
      const user = await ctx.db.get(ids.doctorUserId);
      return { doctor, user };
    });

    expect(updated.user).toMatchObject({
      fullNameAr: "طبيب جديد",
      fullNameFr: "Nouveau Docteur",
      phone: "0666000000",
    });
    expect(updated.doctor).toMatchObject({
      specialtyId: ids.specialtyId,
      subSpecialties: [ids.subSpecialtyId],
      bioAr: "سيرة عربية",
      bioFr: "Bio francaise",
      yearsOfExperience: 12,
      languages: ["ar", "fr"],
      orderRegistrationNumber: "NEW-2",
      consultationFee: 3000,
      followUpFee: 1500,
    });
  });

  test("rejects non-finite numeric profile values", async () => {
    const { t, ids } = await seedDoctorProfileData();

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.doctors.updateProfile, {
        yearsOfExperience: Number.NaN,
      }),
    ).rejects.toThrow(/experience|finite|number/i);
  });
});

describe("doctors.toggleFavorite", () => {
  test("returns a typed missing-profile result instead of throwing", async () => {
    const t = convexTest(schema, modules);

    const ids = await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert("specialties", {
        nameAr: "طب عام",
        nameFr: "Medecine generale",
        icon: "stethoscope",
      });
      const doctorUserId = await ctx.db.insert("users", {
        email: "favorite-doctor@example.test",
        role: "doctor",
        fullNameAr: "طبيب المفضلة",
        fullNameFr: "Favorite Doctor",
        phone: "0555000001",
        isActive: true,
      });
      const doctorId = await ctx.db.insert("doctors", {
        userId: doctorUserId,
        specialtyId,
        subSpecialties: [],
        bioAr: "",
        bioFr: "",
        yearsOfExperience: 3,
        languages: ["ar"],
        orderRegistrationNumber: "FAV-1",
        isVerified: true,
        isProfileComplete: true,
        consultationFee: 1500,
        followUpFee: 500,
        avgRating: 0,
        totalReviews: 0,
      });
      const patientUserId = await ctx.db.insert("users", {
        email: "favorite-patient@example.test",
        role: "patient",
        fullNameAr: "مريض بلا ملف",
        fullNameFr: "Patient Without Profile",
        phone: "0555000002",
        isActive: true,
      });

      return { doctorId, patientUserId };
    });

    await expect(
      t.withIdentity({
        subject: `${ids.patientUserId}|session`,
        tokenIdentifier: "password:favorite-patient@example.test",
      }).mutation(api.doctors.toggleFavorite, {
        doctorId: ids.doctorId,
      }),
    ).resolves.toEqual({
      ok: false,
      isFavorite: false,
      error: "patient_profile_missing",
    });
  });
});
