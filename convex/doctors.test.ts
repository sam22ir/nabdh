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

async function seedDoctorSearchFilterData() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const algiersWilayaId = await ctx.db.insert("wilayas", {
      id: 16,
      nameAr: "الجزائر",
      nameFr: "Alger",
    });
    const oranWilayaId = await ctx.db.insert("wilayas", {
      id: 31,
      nameAr: "وهران",
      nameFr: "Oran",
    });
    const algiersCommuneId = await ctx.db.insert("communes", {
      wilayaId: algiersWilayaId,
      nameAr: "الجزائر الوسطى",
      nameFr: "Alger Centre",
    });
    const oranCommuneId = await ctx.db.insert("communes", {
      wilayaId: oranWilayaId,
      nameAr: "وهران",
      nameFr: "Oran",
    });
    const cardiologyId = await ctx.db.insert("specialties", {
      nameAr: "طب القلب",
      nameFr: "Cardiologie",
      icon: "heart",
    });
    const pediatricsId = await ctx.db.insert("specialties", {
      nameAr: "طب الأطفال",
      nameFr: "Pediatrie",
      icon: "child",
    });

    const today = new Date().getDay();

    const maleDoctorUserId = await ctx.db.insert("users", {
      email: "male-search-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب قلب",
      gender: "male",
      isActive: true,
    });
    const maleDoctorId = await ctx.db.insert("doctors", {
      userId: maleDoctorUserId,
      specialtyId: cardiologyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 8,
      languages: ["ar"],
      orderRegistrationNumber: "SEARCH-M",
      isVerified: true,
      isProfileComplete: true,
      consultationFee: 2500,
      followUpFee: 1200,
      avgRating: 4.9,
      totalReviews: 10,
    });
    const maleClinicId = await ctx.db.insert("clinics", {
      doctorId: maleDoctorId,
      name: "عيادة الجزائر",
      wilayaId: algiersWilayaId,
      communeId: algiersCommuneId,
      address: "Alger",
      latitude: 36.7,
      longitude: 3.0,
      phone: "0555000010",
      isActive: true,
    });
    await ctx.db.insert("schedules", {
      clinicId: maleClinicId,
      dayOfWeek: today,
      startTime: "09:00",
      endTime: "12:00",
      appointmentDurationMinutes: 30,
      maxPatientsPerDay: 10,
      isActive: true,
    });

    const femaleDoctorUserId = await ctx.db.insert("users", {
      email: "female-search-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيبة أطفال",
      gender: "female",
      isActive: true,
    });
    const femaleDoctorId = await ctx.db.insert("doctors", {
      userId: femaleDoctorUserId,
      specialtyId: pediatricsId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 6,
      languages: ["ar"],
      orderRegistrationNumber: "SEARCH-F",
      isVerified: true,
      isProfileComplete: true,
      consultationFee: 1800,
      followUpFee: 900,
      avgRating: 4.4,
      totalReviews: 7,
    });
    const femaleClinicId = await ctx.db.insert("clinics", {
      doctorId: femaleDoctorId,
      name: "عيادة وهران",
      wilayaId: oranWilayaId,
      communeId: oranCommuneId,
      address: "Oran",
      latitude: 35.7,
      longitude: -0.6,
      phone: "0555000011",
      isActive: true,
    });
    await ctx.db.insert("schedules", {
      clinicId: femaleClinicId,
      dayOfWeek: (today + 1) % 7,
      startTime: "09:00",
      endTime: "12:00",
      appointmentDurationMinutes: 30,
      maxPatientsPerDay: 10,
      isActive: true,
    });

    const unverifiedDoctorUserId = await ctx.db.insert("users", {
      email: "unverified-search-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب غير موثق",
      gender: "male",
      isActive: true,
    });
    const unverifiedDoctorId = await ctx.db.insert("doctors", {
      userId: unverifiedDoctorUserId,
      specialtyId: cardiologyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 2,
      languages: ["ar"],
      orderRegistrationNumber: "SEARCH-U",
      isVerified: false,
      isProfileComplete: true,
      consultationFee: 1300,
      followUpFee: 700,
      avgRating: 4.7,
      totalReviews: 3,
    });

    const incompleteDoctorUserId = await ctx.db.insert("users", {
      email: "incomplete-search-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب ناقص",
      gender: "male",
      isActive: true,
    });
    const incompleteDoctorId = await ctx.db.insert("doctors", {
      userId: incompleteDoctorUserId,
      specialtyId: cardiologyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 2,
      languages: ["ar"],
      orderRegistrationNumber: "",
      isVerified: false,
      isProfileComplete: false,
      consultationFee: 1300,
      followUpFee: 700,
      avgRating: 5,
      totalReviews: 3,
    });

    const legacyDoctorUserId = await ctx.db.insert("users", {
      email: "legacy-search-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب قديم",
      gender: "male",
      isActive: true,
    });
    const legacyDoctorId = await ctx.db.insert("doctors", {
      userId: legacyDoctorUserId,
      specialtyId: cardiologyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 12,
      languages: ["ar"],
      orderRegistrationNumber: "LEGACY-1",
      isVerified: false,
      isProfileComplete: false,
      consultationFee: 2200,
      followUpFee: 1100,
      avgRating: 4.6,
      totalReviews: 8,
    });

    return {
      algiersWilayaId,
      cardiologyId,
      maleDoctorId,
      femaleDoctorId,
      unverifiedDoctorId,
      incompleteDoctorId,
      legacyDoctorId,
    };
  });

  return { t, ids };
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
  test("adds and removes a doctor for a completed patient profile", async () => {
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
      const specialtyId = await ctx.db.insert("specialties", {
        nameAr: "طب عام",
        nameFr: "Medecine generale",
        icon: "stethoscope",
      });
      const doctorUserId = await ctx.db.insert("users", {
        email: "favorite-toggle-doctor@example.test",
        role: "doctor",
        fullNameAr: "طبيب قابل للتفضيل",
        isActive: true,
      });
      const doctorId = await ctx.db.insert("doctors", {
        userId: doctorUserId,
        specialtyId,
        subSpecialties: [],
        bioAr: "",
        bioFr: "",
        yearsOfExperience: 7,
        languages: ["ar"],
        orderRegistrationNumber: "FAV-2",
        isVerified: true,
        isProfileComplete: true,
        consultationFee: 1800,
        followUpFee: 700,
        avgRating: 0,
        totalReviews: 0,
      });
      const patientUserId = await ctx.db.insert("users", {
        email: "favorite-toggle-patient@example.test",
        role: "patient",
        fullNameAr: "مريض مكتمل",
        isActive: true,
      });
      const patientId = await ctx.db.insert("patients", {
        userId: patientUserId,
        dateOfBirth: "1990-01-01",
        gender: "male",
        communeId,
        chronicDiseases: [],
        allergies: [],
      });

      return { doctorId, patientId, patientUserId };
    });

    const patientSession = t.withIdentity({
      subject: `${ids.patientUserId}|session`,
      tokenIdentifier: "password:favorite-toggle-patient@example.test",
    });

    await expect(
      patientSession.query(api.doctors.isFavorite, {
        doctorId: ids.doctorId,
      }),
    ).resolves.toBe(false);

    await expect(
      patientSession.mutation(api.doctors.toggleFavorite, {
        doctorId: ids.doctorId,
      }),
    ).resolves.toEqual({
      ok: true,
      isFavorite: true,
      error: null,
    });

    await expect(
      patientSession.query(api.doctors.isFavorite, {
        doctorId: ids.doctorId,
      }),
    ).resolves.toBe(true);

    await expect(
      t.run(async (ctx) => {
        return await ctx.db
          .query("patientFavorites")
          .withIndex("by_patientId_and_doctorId", (q) =>
            q.eq("patientId", ids.patientId).eq("doctorId", ids.doctorId),
          )
          .collect();
      }),
    ).resolves.toHaveLength(1);

    await expect(
      patientSession.mutation(api.doctors.toggleFavorite, {
        doctorId: ids.doctorId,
      }),
    ).resolves.toEqual({
      ok: true,
      isFavorite: false,
      error: null,
    });

    await expect(
      patientSession.query(api.doctors.isFavorite, {
        doctorId: ids.doctorId,
      }),
    ).resolves.toBe(false);
  });

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

describe("doctors.listPublic filters", () => {
  test("includes completed unverified and legacy doctors while excluding incomplete profiles", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    const publicDoctors = await t.query(api.doctors.listPublic, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(publicDoctors.page.map((doctor) => doctor._id)).toEqual(
      expect.arrayContaining([ids.unverifiedDoctorId, ids.legacyDoctorId]),
    );
    expect(publicDoctors.page.map((doctor) => doctor._id)).not.toContain(
      ids.incompleteDoctorId,
    );
    expect(
      publicDoctors.page.find(
        (doctor) => doctor._id === ids.unverifiedDoctorId,
      )?.isVerified,
    ).toBe(false);
  });

  test("filters by specialty, wilaya, gender, and available-today", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    const bySpecialtyAndWilaya = await t.query(api.doctors.listPublic, {
      specialtyId: ids.cardiologyId,
      wilayaId: ids.algiersWilayaId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(bySpecialtyAndWilaya.page.map((doctor) => doctor._id)).toEqual([
      ids.maleDoctorId,
    ]);
    expect(bySpecialtyAndWilaya.page[0].wilaya?.nameAr).toBe("الجزائر");

    const byGender = await t.query(api.doctors.listPublic, {
      gender: "female",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(byGender.page.map((doctor) => doctor._id)).toEqual([
      ids.femaleDoctorId,
    ]);

    const byAvailableToday = await t.query(api.doctors.listPublic, {
      availableToday: true,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(byAvailableToday.page.map((doctor) => doctor._id)).toEqual([
      ids.maleDoctorId,
    ]);
    expect(byAvailableToday.page[0].isAvailableToday).toBe(true);
  });

  test("uses the same filter contract for search results", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    const result = await t.query(api.doctors.search, {
      query: "طب",
      specialtyId: ids.cardiologyId,
      wilayaId: ids.algiersWilayaId,
      gender: "male",
      availableToday: true,
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((doctor) => doctor._id)).toEqual([
      ids.maleDoctorId,
    ]);
    expect(result.page[0]).toMatchObject({
      isAvailableToday: true,
      wilaya: { nameAr: "الجزائر", nameFr: "Alger" },
    });
  });
});

describe("doctors.search", () => {
  test("finds completed unverified doctors by name", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    const result = await t.query(api.doctors.search, {
      query: "غير موثق",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((doctor) => doctor._id)).toEqual([
      ids.unverifiedDoctorId,
    ]);
    expect(result.page[0].isVerified).toBe(false);
  });

  test("does not return incomplete doctor profiles", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    const result = await t.query(api.doctors.search, {
      query: "ناقص",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((doctor) => doctor._id)).not.toContain(
      ids.incompleteDoctorId,
    );
  });

  test("finds legacy registration-number doctors by name", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    const result = await t.query(api.doctors.search, {
      query: "قديم",
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.map((doctor) => doctor._id)).toEqual([
      ids.legacyDoctorId,
    ]);
    expect(result.page[0]).toMatchObject({
      isProfileComplete: false,
      isVerified: false,
      orderRegistrationNumber: "LEGACY-1",
    });
  });
});

describe("doctors.getById public eligibility", () => {
  test("returns completed unverified and legacy doctors", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    await expect(
      t.query(api.doctors.getById, { doctorId: ids.unverifiedDoctorId }),
    ).resolves.toMatchObject({
      _id: ids.unverifiedDoctorId,
      isProfileComplete: true,
      isVerified: false,
    });

    await expect(
      t.query(api.doctors.getById, { doctorId: ids.legacyDoctorId }),
    ).resolves.toMatchObject({
      _id: ids.legacyDoctorId,
      isProfileComplete: false,
      orderRegistrationNumber: "LEGACY-1",
    });
  });

  test("does not expose incomplete doctors by direct id", async () => {
    const { t, ids } = await seedDoctorSearchFilterData();

    await expect(
      t.query(api.doctors.getById, { doctorId: ids.incompleteDoctorId }),
    ).resolves.toBeNull();
  });
});
