/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedBookingData() {
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
      email: "patient@example.test",
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

    const otherPatientUserId = await ctx.db.insert("users", {
      email: "other@example.test",
      role: "patient",
      fullNameAr: "مريض آخر",
      isActive: true,
    });
    const otherProfileId = await ctx.db.insert("patientProfiles", {
      parentUserId: otherPatientUserId,
      fullNameAr: "طفل آخر",
      dateOfBirth: "2020-01-01",
      gender: "male",
      chronicDiseases: [],
      allergies: [],
    });

    const doctorUserId = await ctx.db.insert("users", {
      email: "doctor@example.test",
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
      orderRegistrationNumber: "ORD-1",
      isVerified: true,
      isProfileComplete: true,
      consultationFee: 1000,
      followUpFee: 700,
      avgRating: 0,
      totalReviews: 0,
    });

    const otherDoctorUserId = await ctx.db.insert("users", {
      email: "other-doctor@example.test",
      role: "doctor",
      fullNameAr: "طبيب آخر",
      isActive: true,
    });
    const otherDoctorId = await ctx.db.insert("doctors", {
      userId: otherDoctorUserId,
      specialtyId,
      subSpecialties: [],
      bioAr: "",
      bioFr: "",
      yearsOfExperience: 5,
      languages: ["ar"],
      orderRegistrationNumber: "ORD-2",
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
    await ctx.db.insert("schedules", {
      clinicId,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "12:00",
      appointmentDurationMinutes: 30,
      maxPatientsPerDay: 10,
      isActive: true,
    });

    const otherClinicId = await ctx.db.insert("clinics", {
      doctorId: otherDoctorId,
      name: "عيادة أخرى",
      wilayaId,
      communeId,
      address: "2 Main",
      latitude: 36.7,
      longitude: 3.0,
      phone: "0555111111",
      isActive: true,
    });

    return {
      patientUserId,
      patientId,
      doctorUserId,
      doctorId,
      otherDoctorUserId,
      clinicId,
      otherClinicId,
      otherProfileId,
    };
  });

  return { t, ids };
}

function asPatient(
  t: Awaited<ReturnType<typeof seedBookingData>>["t"],
  patientUserId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${patientUserId}|session`,
    tokenIdentifier: "password:patient@example.test",
  });
}

function asDoctor(
  t: Awaited<ReturnType<typeof seedBookingData>>["t"],
  doctorUserId: Id<"users">,
  email = "doctor@example.test",
) {
  return t.withIdentity({
    subject: `${doctorUserId}|session`,
    tokenIdentifier: `password:${email}`,
  });
}

describe("bookings.create", () => {
  test("rejects a clinic that does not belong to the requested doctor", async () => {
    const { t, ids } = await seedBookingData();

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.bookings.create, {
        doctorId: ids.doctorId,
        clinicId: ids.otherClinicId,
        appointmentDate: "2099-01-05",
        appointmentTime: "09:00",
        visitType: "first",
      }),
    ).rejects.toThrow(/clinic/i);
  });

  test("rejects a family profile owned by another user", async () => {
    const { t, ids } = await seedBookingData();

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.bookings.create, {
        doctorId: ids.doctorId,
        clinicId: ids.clinicId,
        appointmentDate: "2099-01-05",
        appointmentTime: "09:00",
        visitType: "first",
        profileId: ids.otherProfileId,
      }),
    ).rejects.toThrow(/profile/i);
  });

  test("rejects appointments in the past", async () => {
    const { t, ids } = await seedBookingData();

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.bookings.create, {
        doctorId: ids.doctorId,
        clinicId: ids.clinicId,
        appointmentDate: "2000-01-03",
        appointmentTime: "09:00",
        visitType: "first",
      }),
    ).rejects.toThrow(/past|future/i);
  });

  test("rejects times outside the active schedule", async () => {
    const { t, ids } = await seedBookingData();

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.bookings.create, {
        doctorId: ids.doctorId,
        clinicId: ids.clinicId,
        appointmentDate: "2099-01-05",
        appointmentTime: "08:00",
        visitType: "first",
      }),
    ).rejects.toThrow(/schedule|available/i);
  });

  test("rejects dates closed by a schedule exception", async () => {
    const { t, ids } = await seedBookingData();

    await t.run(async (ctx) => {
      await ctx.db.insert("scheduleExceptions", {
        clinicId: ids.clinicId,
        exceptionDate: "2099-01-05",
        isClosed: true,
        reason: "Holiday",
      });
    });

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.bookings.create, {
        doctorId: ids.doctorId,
        clinicId: ids.clinicId,
        appointmentDate: "2099-01-05",
        appointmentTime: "09:00",
        visitType: "first",
      }),
    ).rejects.toThrow(/closed/i);
  });
});

describe("bookings.reschedule", () => {
  test("rejects no-show bookings", async () => {
    const { t, ids } = await seedBookingData();
    const bookingId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookings", {
        patientId: ids.patientId,
        doctorId: ids.doctorId,
        clinicId: ids.clinicId,
        appointmentDate: "2099-01-05",
        appointmentTime: "09:00",
        appointmentDuration: 30,
        visitType: "first",
        status: "no_show",
        confirmedAt: Date.now(),
      });
    });

    await expect(
      asPatient(t, ids.patientUserId).mutation(api.bookings.reschedule, {
        bookingId,
        newDate: "2099-01-12",
        newTime: "09:00",
      }),
    ).rejects.toThrow(/confirmed/i);
  });
});

describe("bookings.updateDoctorNote", () => {
  test("lets only the assigned doctor update the doctor note", async () => {
    const { t, ids } = await seedBookingData();
    const bookingId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookings", {
        patientId: ids.patientId,
        doctorId: ids.doctorId,
        clinicId: ids.clinicId,
        appointmentDate: "2099-01-05",
        appointmentTime: "09:00",
        appointmentDuration: 30,
        visitType: "first",
        status: "confirmed",
        confirmedAt: Date.now(),
      });
    });

    await expect(
      asDoctor(t, ids.otherDoctorUserId, "other-doctor@example.test").mutation(
        api.bookings.updateDoctorNote,
        {
          bookingId,
          doctorNote: "Not my patient",
        },
      ),
    ).rejects.toThrow(/access|own/i);

    await expect(
      asDoctor(t, ids.doctorUserId).mutation(api.bookings.updateDoctorNote, {
        bookingId,
        doctorNote: "Follow up in two weeks",
      }),
    ).resolves.toBe(bookingId);

    const booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking?.doctorNote).toBe("Follow up in two weeks");
  });
});
