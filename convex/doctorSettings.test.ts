/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedDoctorSettingsData() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert("specialties", {
      nameAr: "طب عام",
      nameFr: "Medecine generale",
      icon: "stethoscope",
    });

    const doctorUserId = await ctx.db.insert("users", {
      email: "settings-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب الإعدادات",
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
      orderRegistrationNumber: "SET-1",
      isVerified: true,
      isProfileComplete: true,
      consultationFee: 1500,
      followUpFee: 700,
      avgRating: 0,
      totalReviews: 0,
    });

    const patientUserId = await ctx.db.insert("users", {
      email: "settings-patient@example.test",
      role: "patient",
      fullNameAr: "مريض",
      isActive: true,
    });

    return { doctorUserId, doctorId, patientUserId };
  });

  return { t, ids };
}

function asUser(
  t: Awaited<ReturnType<typeof seedDoctorSettingsData>>["t"],
  userId: Id<"users">,
  email: string,
) {
  return t.withIdentity({
    subject: `${userId}|session`,
    tokenIdentifier: `password:${email}`,
  });
}

describe("doctorSettings", () => {
  test("returns defaults for a doctor with no stored settings", async () => {
    const { t, ids } = await seedDoctorSettingsData();

    const settings = await asUser(
      t,
      ids.doctorUserId,
      "settings-doctor@example.test",
    ).query(api.doctorSettings.getMy, {});

    expect(settings).toMatchObject({
      doctorId: ids.doctorId,
      newBookingAlerts: true,
      cancellationAlerts: true,
      dailySummary: false,
      minCancelHours: 6,
    });
  });

  test("persists updates for the authenticated doctor", async () => {
    const { t, ids } = await seedDoctorSettingsData();
    const doctorSession = asUser(
      t,
      ids.doctorUserId,
      "settings-doctor@example.test",
    );

    await expect(
      doctorSession.mutation(api.doctorSettings.updateMy, {
        newBookingAlerts: false,
        cancellationAlerts: false,
        dailySummary: true,
        minCancelHours: 24,
      }),
    ).resolves.toMatchObject({
      doctorId: ids.doctorId,
      newBookingAlerts: false,
      cancellationAlerts: false,
      dailySummary: true,
      minCancelHours: 24,
    });

    await expect(
      doctorSession.query(api.doctorSettings.getMy, {}),
    ).resolves.toMatchObject({
      doctorId: ids.doctorId,
      newBookingAlerts: false,
      cancellationAlerts: false,
      dailySummary: true,
      minCancelHours: 24,
    });
  });

  test("rejects patient access", async () => {
    const { t, ids } = await seedDoctorSettingsData();
    const patientSession = asUser(
      t,
      ids.patientUserId,
      "settings-patient@example.test",
    );

    await expect(
      patientSession.query(api.doctorSettings.getMy, {}),
    ).rejects.toThrow(/access|doctor|denied/i);
    await expect(
      patientSession.mutation(api.doctorSettings.updateMy, {
        minCancelHours: 6,
      }),
    ).rejects.toThrow(/access|doctor|denied/i);
  });

  test("rejects unsupported cancellation windows", async () => {
    const { t, ids } = await seedDoctorSettingsData();

    await expect(
      asUser(t, ids.doctorUserId, "settings-doctor@example.test").mutation(
        api.doctorSettings.updateMy,
        {
          minCancelHours: 5,
        },
      ),
    ).rejects.toThrow(/cancellation|hours|supported/i);
  });
});
