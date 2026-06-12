/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedScheduleData() {
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
      email: "doctor-schedule@example.test",
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
      orderRegistrationNumber: "ORD-SCHEDULE",
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

    return { doctorUserId, doctorId, clinicId, wilayaId, communeId };
  });

  return { t, ids };
}

function asDoctor(
  t: Awaited<ReturnType<typeof seedScheduleData>>["t"],
  doctorUserId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${doctorUserId}|session`,
    tokenIdentifier: "password:doctor-schedule@example.test",
  });
}

function validScheduleArgs(clinicId: Id<"clinics">) {
  return {
    clinicId,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "12:00",
    appointmentDurationMinutes: 30,
    maxPatientsPerDay: 10,
    isActive: true,
  };
}

describe("schedules.upsertDay validation", () => {
  test("rejects non-finite and fractional day numbers", async () => {
    const { t, ids } = await seedScheduleData();

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.schedules.upsertDay, {
        ...validScheduleArgs(ids.clinicId),
        dayOfWeek: Number.NaN,
      }),
    ).rejects.toThrow(/dayOfWeek/i);

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.schedules.upsertDay, {
        ...validScheduleArgs(ids.clinicId),
        dayOfWeek: 1.5,
      }),
    ).rejects.toThrow(/dayOfWeek/i);
  });

  test("rejects invalid appointment limits and time windows", async () => {
    const { t, ids } = await seedScheduleData();

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.schedules.upsertDay, {
        ...validScheduleArgs(ids.clinicId),
        appointmentDurationMinutes: 0,
      }),
    ).rejects.toThrow(/duration/i);

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.schedules.upsertDay, {
        ...validScheduleArgs(ids.clinicId),
        maxPatientsPerDay: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow(/patients/i);

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.schedules.upsertDay, {
        ...validScheduleArgs(ids.clinicId),
        startTime: "13:00",
        endTime: "09:00",
      }),
    ).rejects.toThrow(/time/i);
  });
});

describe("schedules.getMyExceptions", () => {
  test("returns schedule exceptions for the authenticated doctor's clinics", async () => {
    const { t, ids } = await seedScheduleData();

    const exceptionId = await t.run(async (ctx) => {
      return await ctx.db.insert("scheduleExceptions", {
        clinicId: ids.clinicId,
        exceptionDate: "2099-06-15",
        isClosed: true,
        reason: "Holiday",
      });
    });

    const exceptions = await asDoctor(t, ids.doctorUserId).query(
      api.schedules.getMyExceptions,
      {},
    );

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]._id).toBe(exceptionId);
    expect(exceptions[0].clinicId).toBe(ids.clinicId);
    expect(exceptions[0].clinicName).toBe("عيادة");
  });
});

describe("schedules.getByDoctor", () => {
  test("returns schedule entries across every active clinic for a doctor", async () => {
    const { t, ids } = await seedScheduleData();

    const secondClinicId = await t.run(async (ctx) => {
      return await ctx.db.insert("clinics", {
        doctorId: ids.doctorId,
        name: "عيادة ثانية",
        wilayaId: ids.wilayaId,
        communeId: ids.communeId,
        address: "2 Main",
        latitude: 36.8,
        longitude: 3.1,
        phone: "0555000001",
        isActive: true,
      });
    });

    const [firstScheduleId, secondScheduleId] = await t.run(async (ctx) => {
      const first = await ctx.db.insert("schedules", {
        clinicId: ids.clinicId,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "12:00",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 10,
        isActive: true,
      });
      const second = await ctx.db.insert("schedules", {
        clinicId: secondClinicId,
        dayOfWeek: 2,
        startTime: "13:00",
        endTime: "16:00",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 10,
        isActive: true,
      });
      return [first, second];
    });

    const schedules = await t.query(api.schedules.getByDoctor, {
      doctorId: ids.doctorId,
    });

    expect(schedules.map((schedule) => schedule._id).sort()).toEqual(
      [firstScheduleId, secondScheduleId].sort(),
    );
    expect(new Set(schedules.map((schedule) => schedule.clinicId))).toEqual(
      new Set([ids.clinicId, secondClinicId]),
    );
  });
});
