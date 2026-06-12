/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedClinicData() {
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
      email: "doctor-clinic@example.test",
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
      orderRegistrationNumber: "ORD-CLINIC",
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

    return { doctorUserId, wilayaId, communeId, clinicId };
  });

  return { t, ids };
}

function asDoctor(
  t: Awaited<ReturnType<typeof seedClinicData>>["t"],
  doctorUserId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${doctorUserId}|session`,
    tokenIdentifier: "password:doctor-clinic@example.test",
  });
}

describe("clinics coordinate validation", () => {
  test("rejects non-finite coordinates when creating a clinic", async () => {
    const { t, ids } = await seedClinicData();

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.clinics.create, {
        name: "Invalid Clinic",
        wilayaId: ids.wilayaId,
        communeId: ids.communeId,
        address: "2 Main",
        latitude: Number.NaN,
        longitude: 3.0,
        phone: "0555111111",
      }),
    ).rejects.toThrow(/latitude|coordinate/i);
  });

  test("rejects out-of-range and non-finite coordinates when updating a clinic", async () => {
    const { t, ids } = await seedClinicData();

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.clinics.update, {
        clinicId: ids.clinicId,
        latitude: 91,
      }),
    ).rejects.toThrow(/latitude|coordinate/i);

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.clinics.update, {
        clinicId: ids.clinicId,
        longitude: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow(/longitude|coordinate/i);
  });
});
