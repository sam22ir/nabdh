/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedReviewData() {
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
    const patientUserId = await ctx.db.insert("users", {
      email: "patient-review@example.test",
      role: "patient",
      fullNameAr: "مريض",
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
    const doctorUserId = await ctx.db.insert("users", {
      email: "doctor-review@example.test",
      role: "doctor",
      fullNameAr: "طبيب",
      isActive: true,
    });
    const doctorId = await ctx.db.insert("doctors", {
      userId: doctorUserId,
      specialtyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 5,
      languages: ["ar"],
      orderRegistrationNumber: "ORD-REVIEW",
      isVerified: true,
      isProfileComplete: true,
      consultationFee: 1000,
      followUpFee: 700,
      avgRating: 0,
      totalReviews: 0,
    });
    const clinicId = await ctx.db.insert("clinics", {
      doctorId,
      name: "عيادة",
      wilayaId,
      communeId,
      address: "1 Main",
      latitude: 36.7,
      longitude: 3.0,
      phone: "0555000000",
      isActive: true,
    });
    const bookingId = await ctx.db.insert("bookings", {
      patientId,
      doctorId,
      clinicId,
      appointmentDate: "2099-01-05",
      appointmentTime: "09:00",
      appointmentDuration: 30,
      visitType: "first",
      status: "completed",
      confirmedAt: Date.now(),
      completedAt: Date.now(),
    });

    return { patientUserId, patientId, doctorId, bookingId };
  });

  return { t, ids };
}

function asPatient(
  t: Awaited<ReturnType<typeof seedReviewData>>["t"],
  patientUserId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${patientUserId}|session`,
    tokenIdentifier: "password:patient-review@example.test",
  });
}

describe("reviews public API", () => {
  test("does not expose patient or booking identifiers in public doctor reviews", async () => {
    const { t, ids } = await seedReviewData();
    await t.run(async (ctx) => {
      await ctx.db.insert("reviews", {
        bookingId: ids.bookingId,
        patientId: ids.patientId,
        doctorId: ids.doctorId,
        overallRating: 5,
        punctualityRating: 5,
        diagnosisRating: 5,
        professionalismRating: 5,
        cleanlinessRating: 5,
        comment: "Good",
        isAnonymous: true,
        isHidden: false,
      });
    });

    const result = await t.query(api.reviews.listByDoctor, {
      doctorId: ids.doctorId,
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0]).not.toHaveProperty("bookingId");
    expect(result.page[0]).not.toHaveProperty("patientId");
    expect(result.page[0]).not.toHaveProperty("isHidden");
  });
});

describe("reviews rating validation", () => {
  test("rejects non-finite ratings when creating a review", async () => {
    const { t, ids } = await seedReviewData();

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.reviews.create, {
        bookingId: ids.bookingId,
        overallRating: Number.NaN,
        punctualityRating: 5,
        diagnosisRating: 5,
        professionalismRating: 5,
        cleanlinessRating: 5,
        isAnonymous: false,
      }),
    ).rejects.toThrow(/rating/i);
  });

  test("rejects non-finite ratings when updating a review", async () => {
    const { t, ids } = await seedReviewData();
    const reviewId = await asPatient(t, ids.patientUserId).mutation(
      api.reviews.create,
      {
        bookingId: ids.bookingId,
        overallRating: 5,
        punctualityRating: 5,
        diagnosisRating: 5,
        professionalismRating: 5,
        cleanlinessRating: 5,
        isAnonymous: false,
      },
    );

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.reviews.update, {
        reviewId,
        overallRating: Number.NaN,
      }),
    ).rejects.toThrow(/rating/i);
  });
});
