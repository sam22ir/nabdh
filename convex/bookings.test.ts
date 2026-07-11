/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split('|').at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

afterEach(() => {
  vi.useRealTimers();
});

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seedDoctorWorklist(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب القلب',
      icon: 'heart-pulse',
    });
    const doctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|doctor-worklist',
      fullName: 'طبيب المواعيد',
      gender: 'male',
      role: 'doctor',
      phone: '+213555100000',
      phoneNormalized: '+213555100000',
      phoneLoginKey: 'dz213555100000',
      isActive: true,
    });
    const doctorId = await ctx.db.insert('doctors', {
      userId: doctorUserId,
      specialtyId,
      bio: '',
      yearsOfExperience: 5,
      consultationFee: 2500,
      followUpFee: 1500,
      avgRating: 0,
      totalReviews: 0,
    });
    const patientUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|patient-worklist',
      fullName: 'مريض المواعيد',
      gender: 'female',
      role: 'patient',
      phone: '+213555200000',
      phoneNormalized: '+213555200000',
      phoneLoginKey: 'dz213555200000',
      isActive: true,
    });
    const patientId = await ctx.db.insert('patients', {
      userId: patientUserId,
      chronicDiseases: [],
      allergies: [],
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 16,
      name: 'الجزائر',
    });
    const clinicId = await ctx.db.insert('clinics', {
      doctorId,
      name: 'عيادة المواعيد',
      wilayaId,
      address: 'شارع الاختبار',
      latitude: 36.75,
      longitude: 3.06,
      phone: '+213555100000',
      isActive: true,
    });

    const julyBookingId = await ctx.db.insert('bookings', {
      patientId,
      doctorId,
      clinicId,
      appointmentDate: '2026-07-14',
      appointmentTime: '09:30',
      appointmentDuration: 30,
      visitType: 'consultation',
      reason: 'متابعة الضغط',
      status: 'confirmed',
      confirmedAt: Date.now(),
    });
    await ctx.db.insert('bookings', {
      patientId,
      doctorId,
      clinicId,
      appointmentDate: '2026-08-02',
      appointmentTime: '10:00',
      appointmentDuration: 30,
      visitType: 'first',
      status: 'confirmed',
      confirmedAt: Date.now(),
    });

    return { doctorId, clinicId, julyBookingId };
  });
}

async function seedClinicBookingMemberships(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب عام',
      icon: 'stethoscope',
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 16,
      name: 'الجزائر',
    });
    const clinicUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|booking-clinic',
      fullName: 'عيادة الحجز',
      role: 'clinic',
      phone: '+213555700000',
      phoneNormalized: '+213555700000',
      phoneLoginKey: 'dz213555700000',
      isActive: true,
    });
    const clinicId = await ctx.db.insert('clinics', {
      ownerUserId: clinicUserId,
      name: 'عيادة الحجز',
      wilayaId,
      phone: '+213555700000',
      isActive: true,
    });
    const firstDoctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|booking-doctor-a',
      fullName: 'د. أ',
      gender: 'male',
      role: 'doctor',
      phone: '+213555700001',
      phoneNormalized: '+213555700001',
      phoneLoginKey: 'dz213555700001',
      isActive: true,
    });
    const firstDoctorId = await ctx.db.insert('doctors', {
      userId: firstDoctorUserId,
      specialtyId,
      bio: '',
      yearsOfExperience: 4,
      avgRating: 0,
      totalReviews: 0,
    });
    const secondDoctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|booking-doctor-b',
      fullName: 'د. ب',
      gender: 'female',
      role: 'doctor',
      phone: '+213555700002',
      phoneNormalized: '+213555700002',
      phoneLoginKey: 'dz213555700002',
      isActive: true,
    });
    const secondDoctorId = await ctx.db.insert('doctors', {
      userId: secondDoctorUserId,
      specialtyId,
      bio: '',
      yearsOfExperience: 7,
      avgRating: 0,
      totalReviews: 0,
    });
    const patientUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|booking-patient',
      fullName: 'مريض الحجز',
      gender: 'female',
      role: 'patient',
      phone: '+213555700003',
      phoneNormalized: '+213555700003',
      phoneLoginKey: 'dz213555700003',
      isActive: true,
    });
    const patientId = await ctx.db.insert('patients', {
      userId: patientUserId,
      chronicDiseases: [],
      allergies: [],
    });
    const now = Date.now();
    await ctx.db.insert('clinicMemberships', {
      clinicId,
      doctorId: firstDoctorId,
      requestedBy: 'clinic',
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
      acceptedAt: now,
    });
    await ctx.db.insert('clinicMemberships', {
      clinicId,
      doctorId: secondDoctorId,
      requestedBy: 'clinic',
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
      acceptedAt: now,
    });
    await ctx.db.insert('schedules', {
      clinicId,
      doctorId: firstDoctorId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      appointmentDurationMinutes: 30,
      isActive: true,
    });
    await ctx.db.insert('schedules', {
      clinicId,
      doctorId: secondDoctorId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      appointmentDurationMinutes: 30,
      isActive: true,
    });

    return {
      clinicId,
      clinicUserId,
      firstDoctorId,
      secondDoctorId,
      patientId,
    };
  });
}

describe('doctor booking worklist queries', () => {
  test('listDoctorMonth accepts the schedule tab args and groups matching days', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);

    const result = await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .query(api.bookings.listDoctorMonth, {
        year: 2026,
        month: 7,
        query: 'مريض',
        status: 'confirmed',
        visitType: 'consultation',
      });

    expect(result).toMatchObject({
      year: 2026,
      month: 7,
      days: [
        {
          date: '2026-07-14',
          total: 1,
          appointments: [
            {
              _id: seeded.julyBookingId,
              patientName: 'مريض المواعيد',
              patientPhone: '+213555200000',
            },
          ],
        },
      ],
    });
  });

  test('listDoctorWeek returns the requested week as grouped day data', async () => {
    const t = convexTest(schema, modules);
    await seedDoctorWorklist(t);

    const result = await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .query(api.bookings.listDoctorWeek, {
        startDate: '2026-07-12',
      });

    expect(result).toMatchObject({
      startDate: '2026-07-12',
      endDate: '2026-07-18',
      days: [
        {
          date: '2026-07-14',
          total: 1,
        },
      ],
    });
  });

  test('getHomeDataDoctor exposes dashboard fields after booking create and completion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);
    const today = formatDateOnly(new Date());

    const bookingId = await t
      .withIdentity(identity('clerk|patient-worklist'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: today,
        appointmentTime: '11:00',
        appointmentDuration: 30,
        visitType: 'first',
        reason: 'حجز جديد',
      });

    const confirmedDashboard = await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .query(api.bookings.getHomeDataDoctor, {});

    expect(confirmedDashboard).toMatchObject({
      todayStats: {
        total: 1,
        confirmed: 1,
        completed: 0,
        cancelled: 0,
      },
      nextPatient: {
        _id: bookingId,
        status: 'confirmed',
        patientName: 'مريض المواعيد',
      },
      todayAppointments: [
        {
          _id: bookingId,
          status: 'confirmed',
          patientName: 'مريض المواعيد',
        },
      ],
    });

    await t
      .run(async (ctx) => {
        const clinicUserId = await ctx.db.insert('users', {
          tokenIdentifier: 'clerk|doctor-worklist-clinic',
          fullName: 'عيادة المواعيد',
          role: 'clinic',
          phone: '+213555100111',
          phoneNormalized: '+213555100111',
          phoneLoginKey: 'dz213555100111',
          isActive: true,
        });
        await ctx.db.patch(seeded.clinicId, { ownerUserId: clinicUserId });
      });

    await t
      .withIdentity(identity('clerk|doctor-worklist-clinic'))
      .mutation(api.bookings.markCompleted, { bookingId });

    const completedDashboard = await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .query(api.bookings.getHomeDataDoctor, {});

    expect(completedDashboard).toMatchObject({
      todayStats: {
        total: 1,
        confirmed: 0,
        completed: 1,
        cancelled: 0,
      },
      nextPatient: {
        _id: seeded.julyBookingId,
        appointmentDate: '2026-07-14',
        appointmentTime: '09:30',
        status: 'confirmed',
      },
      todayAppointments: [
        {
          _id: bookingId,
          status: 'completed',
          patientName: 'مريض المواعيد',
        },
      ],
    });
  });

  test('doctor cancellation is counted as cancelled and appears in patient cancelled appointments', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);
    const today = formatDateOnly(new Date());

    const bookingId = await t
      .withIdentity(identity('clerk|patient-worklist'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: today,
        appointmentTime: '11:30',
        appointmentDuration: 30,
        visitType: 'first',
        reason: 'حجز سيتم إلغاؤه',
      });

    await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .mutation(api.bookings.cancel, {
        bookingId,
        cancellationReason: 'إلغاء من الطبيب',
      });

    const doctorDashboard = await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .query(api.bookings.getHomeDataDoctor, {});

    expect(doctorDashboard).toMatchObject({
      todayStats: {
        total: 1,
        confirmed: 0,
        completed: 0,
        cancelled: 1,
        noShow: 0,
      },
      todayAppointments: [
        {
          _id: bookingId,
          status: 'cancelled',
          cancelledBy: 'doctor',
          cancellationReason: 'إلغاء من الطبيب',
        },
      ],
    });

    await expect(
      t.withIdentity(identity('clerk|patient-worklist')).query(api.bookings.listMyCancelled, {}),
    ).resolves.toMatchObject([
      {
        _id: bookingId,
        status: 'cancelled',
        cancelledBy: 'doctor',
        cancellationReason: 'إلغاء من الطبيب',
      },
    ]);

    await expect(
      t.withIdentity(identity('clerk|patient-worklist')).query(api.bookings.listMyPast, {}),
    ).resolves.toEqual([]);
  });

  test('getHomeDataDoctor exposes the next upcoming confirmed booking beyond today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);

    const bookingId = await t
      .withIdentity(identity('clerk|patient-worklist'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2026-07-05',
        appointmentTime: '11:00',
        appointmentDuration: 30,
        visitType: 'first',
        reason: 'حجز قادم',
      });

    const dashboard = await t
      .withIdentity(identity('clerk|doctor-worklist'))
      .query(api.bookings.getHomeDataDoctor, {});

    expect(dashboard).toMatchObject({
      todayStats: {
        total: 0,
        confirmed: 0,
      },
      todayAppointments: [],
      nextPatient: {
        _id: bookingId,
        appointmentDate: '2026-07-05',
        appointmentTime: '11:00',
        status: 'confirmed',
      },
    });
  });

  test('getAvailableSlots updates availability when a booking is cancelled', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);
    const bookingDate = '2026-07-12';

    await t.run(async (ctx) => {
      await ctx.db.insert('schedules', {
        clinicId: seeded.clinicId,
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        appointmentDurationMinutes: 30,
        isActive: true,
      });
    });

    const bookingId = await t
      .withIdentity(identity('clerk|patient-worklist'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: bookingDate,
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'consultation',
      });

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        date: bookingDate,
      }),
    ).resolves.toEqual([
      { time: '09:00', duration: 30, available: false },
      { time: '09:30', duration: 30, available: true },
    ]);

    await t
      .withIdentity(identity('clerk|patient-worklist'))
      .mutation(api.bookings.cancel, {
        bookingId,
        cancellationReason: 'تغيير الموعد',
      });

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        date: bookingDate,
      }),
    ).resolves.toEqual([
      { time: '09:00', duration: 30, available: true },
      { time: '09:30', duration: 30, available: true },
    ]);
  });

  test('getAvailableSlots returns no slots on a clinic vacation date', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);
    const vacationDate = '2026-07-12';

    await t.run(async (ctx) => {
      await ctx.db.insert('schedules', {
        clinicId: seeded.clinicId,
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        appointmentDurationMinutes: 30,
        isActive: true,
      });
      await ctx.db.insert('scheduleExceptions', {
        clinicId: seeded.clinicId,
        exceptionDate: vacationDate,
        reason: 'إجازة سنوية',
      });
    });

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        date: vacationDate,
      }),
    ).resolves.toEqual([]);
  });

  test('getAvailableSlots blocks only the doctor exception time range on that day', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    await t.run(async (ctx) => {
      await ctx.db.insert('scheduleExceptions', {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        exceptionDate: '2099-07-06',
        reason: 'اجتماع داخل العيادة',
        exceptionType: 'time_range',
        customStartTime: '09:00',
        customEndTime: '10:00',
      } as any);
    });

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        date: '2099-07-06',
      }),
    ).resolves.toEqual([
      { time: '09:00', duration: 30, available: false },
      { time: '09:30', duration: 30, available: false },
    ]);
  });

  test('getAvailableSlots disables today slots before the current Algeria time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T09:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);

    await t.run(async (ctx) => {
      await ctx.db.insert('schedules', {
        clinicId: seeded.clinicId,
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '11:00',
        appointmentDurationMinutes: 30,
        isActive: true,
      });
    });

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        date: '2026-07-04',
      }),
    ).resolves.toEqual([
      { time: '09:00', duration: 30, available: false },
      { time: '09:30', duration: 30, available: false },
      { time: '10:00', duration: 30, available: true },
      { time: '10:30', duration: 30, available: true },
    ]);
  });

  test('create rejects appointment times before the current Algeria time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T09:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWorklist(t);

    await expect(
      t.withIdentity(identity('clerk|patient-worklist')).mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2026-07-04',
        appointmentTime: '09:30',
        appointmentDuration: 30,
        visitType: 'consultation',
      }),
    ).rejects.toMatchObject({
      data: {
        code: 'slot_in_past',
      },
    });

    await expect(
      t.withIdentity(identity('clerk|patient-worklist')).mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2026-07-04',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'consultation',
      }),
    ).resolves.toEqual(expect.any(String));
  });
});

describe('patient home booking data', () => {
  test('getHomeData includes the clinic name for the next appointment', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);
    await seedDoctorWorklist(t);

    const result = await t
      .withIdentity(identity('clerk|patient-worklist'))
      .query(api.bookings.getHomeData, {});

    expect(result.nextAppointment).toMatchObject({
      doctorName: 'طبيب المواعيد',
      doctorSpecialtyNameAr: 'طب القلب',
      clinicName: 'عيادة المواعيد',
      appointmentDate: '2026-07-14',
      appointmentTime: '09:30',
    });
  });

  test('getHomeData falls back to the doctor accepted clinic name when the booked clinic name is blank', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب القلب',
        icon: 'heart-pulse',
      });
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|fallback-doctor',
        fullName: 'د. العيادة',
        gender: 'male',
        role: 'doctor',
        phone: '+213555810001',
        phoneNormalized: '+213555810001',
        phoneLoginKey: 'dz213555810001',
        isActive: true,
      });
      const doctorId = await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 6,
        avgRating: 0,
        totalReviews: 0,
      });
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|fallback-patient',
        fullName: 'مريض العيادة',
        gender: 'female',
        role: 'patient',
        phone: '+213555810002',
        phoneNormalized: '+213555810002',
        phoneLoginKey: 'dz213555810002',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });
      const legacyClinicId = await ctx.db.insert('clinics', {
        doctorId,
        name: '',
        wilayaId,
        phone: '+213555810003',
        isActive: true,
      });
      const actualClinicId = await ctx.db.insert('clinics', {
        ownerUserId: patientUserId,
        name: 'عيادة النور',
        wilayaId,
        phone: '+213555810004',
        isActive: true,
      });
      const now = Date.now();
      await ctx.db.insert('clinicMemberships', {
        clinicId: actualClinicId,
        doctorId,
        requestedBy: 'clinic',
        status: 'accepted',
        createdAt: now,
        updatedAt: now,
        acceptedAt: now,
      });
      await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId: legacyClinicId,
        appointmentDate: '2026-07-14',
        appointmentTime: '09:30',
        appointmentDuration: 30,
        visitType: 'consultation',
        reason: 'متابعة',
        status: 'confirmed',
        confirmedAt: now,
      });
    });

    const result = await t
      .withIdentity(identity('clerk|fallback-patient'))
      .query(api.bookings.getHomeData, {});

    expect(result.nextAppointment).toMatchObject({
      doctorName: 'د. العيادة',
      doctorSpecialtyNameAr: 'طب القلب',
      clinicName: 'عيادة النور',
      appointmentDate: '2026-07-14',
      appointmentTime: '09:30',
    });
  });

  test('getHomeData falls back to the doctor legacy clinic name when the booked clinic name is blank', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب القلب',
        icon: 'heart-pulse',
      });
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|legacy-doctor',
        fullName: 'د. عزدين العز',
        gender: 'male',
        role: 'doctor',
        phone: '+213555810201',
        phoneNormalized: '+213555810201',
        phoneLoginKey: 'dz213555810201',
        isActive: true,
      });
      const doctorId = await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 8,
        avgRating: 0,
        totalReviews: 0,
      });
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|legacy-patient',
        fullName: 'مريض العيادة القديمة',
        gender: 'female',
        role: 'patient',
        phone: '+213555810202',
        phoneNormalized: '+213555810202',
        phoneLoginKey: 'dz213555810202',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });
      const blankBookedClinicId = await ctx.db.insert('clinics', {
        doctorId,
        name: '',
        wilayaId,
        phone: '+213555810203',
        isActive: true,
      });
      await ctx.db.insert('clinics', {
        doctorId,
        name: 'عيادة د. عزدين العز',
        wilayaId,
        phone: '+213555810204',
        isActive: true,
      });
      const now = Date.now();
      await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId: blankBookedClinicId,
        appointmentDate: '2026-07-14',
        appointmentTime: '09:20',
        appointmentDuration: 30,
        visitType: 'consultation',
        reason: 'متابعة',
        status: 'confirmed',
        confirmedAt: now,
      });
    });

    const result = await t
      .withIdentity(identity('clerk|legacy-patient'))
      .query(api.bookings.getHomeData, {});

    expect(result.nextAppointment).toMatchObject({
      doctorName: 'د. عزدين العز',
      doctorSpecialtyNameAr: 'طب القلب',
      clinicName: 'عيادة د. عزدين العز',
      appointmentDate: '2026-07-14',
      appointmentTime: '09:20',
    });
  });

  test('getHomeData returns a clear message when the doctor is not in a clinic', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب عام',
        icon: 'medical-outline',
      });
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|solo-doctor',
        fullName: 'د. منفرد',
        gender: 'male',
        role: 'doctor',
        phone: '+213555810101',
        phoneNormalized: '+213555810101',
        phoneLoginKey: 'dz213555810101',
        isActive: true,
      });
      const doctorId = await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 4,
        avgRating: 0,
        totalReviews: 0,
      });
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|solo-patient',
        fullName: 'مريض منفرد',
        gender: 'female',
        role: 'patient',
        phone: '+213555810102',
        phoneNormalized: '+213555810102',
        phoneLoginKey: 'dz213555810102',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });
      const clinicId = await ctx.db.insert('clinics', {
        doctorId,
        name: '',
        wilayaId,
        phone: '+213555810103',
        isActive: true,
      });
      const now = Date.now();
      await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId,
        appointmentDate: '2026-07-14',
        appointmentTime: '09:30',
        appointmentDuration: 30,
        visitType: 'consultation',
        reason: 'استشارة',
        status: 'confirmed',
        confirmedAt: now,
      });
    });

    const result = await t
      .withIdentity(identity('clerk|solo-patient'))
      .query(api.bookings.getHomeData, {});

    expect(result.nextAppointment).toMatchObject({
      doctorName: 'د. منفرد',
      doctorSpecialtyNameAr: 'طب عام',
      clinicName: 'الطبيب ليس في عيادة',
      appointmentDate: '2026-07-14',
      appointmentTime: '09:30',
    });
  });
});

describe('clinic-first booking availability', () => {
  test('getAvailableSlots requires accepted doctor membership for clinic-owned bookings', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);
    const outsideDoctorId = await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب عيون',
        icon: 'eye',
      });
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|booking-outside-doctor',
        fullName: 'د. خارجية',
        gender: 'female',
        role: 'doctor',
        phone: '+213555700004',
        phoneNormalized: '+213555700004',
        phoneLoginKey: 'dz213555700004',
        isActive: true,
      });
      return await ctx.db.insert('doctors', {
        userId,
        specialtyId,
        bio: '',
        yearsOfExperience: 3,
        avgRating: 0,
        totalReviews: 0,
      });
    });

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        doctorId: outsideDoctorId,
        date: '2099-07-06',
      }),
    ).resolves.toEqual([]);
  });

  test('countMyClinicDoctorsAvailableToday counts accepted doctors scheduled to work today', async () => {
    const t = convexTest(schema, modules);
    const today = new Date();
    const year = today.getUTCFullYear();
    const month = String(today.getUTCMonth() + 1).padStart(2, '0');
    const day = String(today.getUTCDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    const dayOfWeek = today.getDay();

    const seeded = await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب عام',
        icon: 'stethoscope',
      });
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|bookable-clinic',
        fullName: 'عيادة اليوم',
        role: 'clinic',
        phone: '+213555710000',
        phoneNormalized: '+213555710000',
        phoneLoginKey: 'dz213555710000',
        isActive: true,
      });
      const clinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'عيادة اليوم',
        wilayaId,
        phone: '+213555710000',
        isActive: true,
      });

      const availableDoctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|bookable-doctor-1',
        fullName: 'طبيب متاح',
        gender: 'male',
        role: 'doctor',
        phone: '+213555710001',
        phoneNormalized: '+213555710001',
        phoneLoginKey: 'dz213555710001',
        isActive: true,
      });
      const availableDoctorId = await ctx.db.insert('doctors', {
        userId: availableDoctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 5,
        avgRating: 0,
        totalReviews: 0,
      });

      const onLeaveDoctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|bookable-doctor-2',
        fullName: 'طبيب في إجازة',
        gender: 'male',
        role: 'doctor',
        phone: '+213555710002',
        phoneNormalized: '+213555710002',
        phoneLoginKey: 'dz213555710002',
        isActive: true,
      });
      const onLeaveDoctorId = await ctx.db.insert('doctors', {
        userId: onLeaveDoctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 5,
        avgRating: 0,
        totalReviews: 0,
      });

      const fullDoctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|bookable-doctor-3',
        fullName: 'طبيب ممتلئ',
        gender: 'male',
        role: 'doctor',
        phone: '+213555710003',
        phoneNormalized: '+213555710003',
        phoneLoginKey: 'dz213555710003',
        isActive: true,
      });
      const fullDoctorId = await ctx.db.insert('doctors', {
        userId: fullDoctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 5,
        avgRating: 0,
        totalReviews: 0,
      });

      for (const doctorId of [availableDoctorId, onLeaveDoctorId, fullDoctorId]) {
        await ctx.db.insert('clinicMemberships', {
          clinicId,
          doctorId,
          requestedBy: 'clinic',
          status: 'accepted',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          acceptedAt: Date.now(),
        });

        await ctx.db.insert('schedules', {
          clinicId,
          doctorId,
          dayOfWeek,
          startTime: '09:00',
          endTime: '09:30',
          appointmentDurationMinutes: 30,
          isActive: true,
        });
      }

      await ctx.db.insert('scheduleExceptions', {
        clinicId,
        doctorId: onLeaveDoctorId,
        exceptionDate: todayDate,
        reason: 'إجازة',
      });

      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|bookable-patient',
        fullName: 'مريض الحجز',
        gender: 'female',
        role: 'patient',
        phone: '+213555710004',
        phoneNormalized: '+213555710004',
        phoneLoginKey: 'dz213555710004',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });

      await ctx.db.insert('bookings', {
        patientId,
        doctorId: fullDoctorId,
        clinicId,
        appointmentDate: todayDate,
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'confirmed',
        confirmedAt: Date.now(),
      });

      return { clinicUserId };
    });

    await expect(
      t.withIdentity(identity('clerk|bookable-clinic')).query(
        api.bookings.countMyClinicDoctorsAvailableToday,
        {},
      ),
    ).resolves.toEqual({ count: 2 });
  });

  test('clinic and doctor availability are layered independently', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    await t.run((ctx) =>
      ctx.db.insert('scheduleExceptions', {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        exceptionDate: '2099-07-06',
        reason: 'إجازة الطبيب',
      }),
    );

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        date: '2099-07-06',
      }),
    ).resolves.toEqual([]);

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        doctorId: seeded.secondDoctorId,
        date: '2099-07-06',
      }),
    ).resolves.toEqual([
      { time: '09:00', duration: 30, available: true },
      { time: '09:30', duration: 30, available: true },
    ]);

    await t.run((ctx) =>
      ctx.db.insert('scheduleExceptions', {
        clinicId: seeded.clinicId,
        exceptionDate: '2099-07-13',
        reason: 'العيادة مغلقة',
      }),
    );

    await expect(
      t.query(api.bookings.getAvailableSlots, {
        clinicId: seeded.clinicId,
        doctorId: seeded.secondDoctorId,
        date: '2099-07-13',
      }),
    ).resolves.toEqual([]);
  });

  test('booking creation validates clinic doctor membership and blocks taken slots', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    await expect(
      t.withIdentity(identity('clerk|booking-patient')).mutation(api.bookings.create, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'first',
      }),
    ).resolves.toBeTruthy();

    await expect(
      t.withIdentity(identity('clerk|booking-patient')).mutation(api.bookings.create, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'first',
      }),
    ).rejects.toMatchObject({
      data: {
        code: 'slot_taken',
      },
    });
  });

  test('clinic can list its bookings for accepted doctors', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    await t.run(async (ctx) => {
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|booking-clinic-patient',
        fullName: 'مريض العيادة',
        gender: 'female',
        role: 'patient',
        phone: '+213555700010',
        phoneNormalized: '+213555700010',
        phoneLoginKey: 'dz213555700010',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });

      await ctx.db.insert('bookings', {
        patientId,
        doctorId: seeded.firstDoctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'first',
        status: 'confirmed',
        confirmedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(identity('clerk|booking-clinic')).query(
        api.bookings.listMyClinicAppointments,
        {},
      ),
    ).resolves.toMatchObject([
      {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        doctorName: 'د. أ',
        patientName: 'مريض العيادة',
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
      },
    ]);
  });

  test('clinic can count booked appointments across all its doctors', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    await t.run(async (ctx) => {
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|booking-clinic-count-patient',
        fullName: 'مريض العد',
        gender: 'female',
        role: 'patient',
        phone: '+213555700011',
        phoneNormalized: '+213555700011',
        phoneLoginKey: 'dz213555700011',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });

      await ctx.db.insert('bookings', {
        patientId,
        doctorId: seeded.firstDoctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'first',
        status: 'confirmed',
        confirmedAt: Date.now(),
      });
      await ctx.db.insert('bookings', {
        patientId,
        doctorId: seeded.secondDoctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:30',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'completed',
        confirmedAt: Date.now(),
      });
      await ctx.db.insert('bookings', {
        patientId,
        doctorId: seeded.secondDoctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2099-07-07',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'cancelled',
        confirmedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(identity('clerk|booking-clinic')).query(
        api.bookings.countMyClinicBookedAppointments,
        {},
      ),
    ).resolves.toEqual({ count: 2 });
  });

  test('only clinic can mark a patient present for attendance flow', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-07-05T08:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    const bookingId = await t
      .withIdentity(identity('clerk|booking-patient'))
      .mutation(api.bookings.create, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 30,
        visitType: 'first',
      });

    await expect(
      t.withIdentity(identity('clerk|booking-clinic')).mutation(api.bookings.markPresent, {
        bookingId,
      }),
    ).resolves.toEqual({ ok: true });

    const booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking).toMatchObject({
      status: 'present',
    });

    await expect(
      t.withIdentity(identity('clerk|booking-doctor-a')).mutation(api.bookings.markPresent, {
        bookingId,
      }),
    ).rejects.toThrow('Clinic account required');
  });

  test('attendance automation moves present patients into room and then completes them when auto mode is enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-07-06T06:50:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    const bookingId = await t
      .withIdentity(identity('clerk|booking-patient'))
      .mutation(api.bookings.create, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 20,
        visitType: 'first',
      });

    await t.withIdentity(identity('clerk|booking-clinic')).mutation(api.bookings.markPresent, {
      bookingId,
    });

    vi.setSystemTime(new Date('2099-07-06T08:05:00.000Z'));
    await t.mutation(internal.bookings.processAutomaticAttendance, {});

    let booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking).toMatchObject({
      status: 'in_room',
    });

    vi.setSystemTime(new Date('2099-07-06T08:25:00.000Z'));
    await t.mutation(internal.bookings.processAutomaticAttendance, {});

    booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking).toMatchObject({
      status: 'completed',
    });
  });

  test('attendance automation marks missing patients as no_show and notifies them', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-07-06T06:50:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedClinicBookingMemberships(t);

    const bookingId = await t
      .withIdentity(identity('clerk|booking-patient'))
      .mutation(api.bookings.create, {
        clinicId: seeded.clinicId,
        doctorId: seeded.firstDoctorId,
        appointmentDate: '2099-07-06',
        appointmentTime: '09:00',
        appointmentDuration: 20,
        visitType: 'consultation',
      });

    vi.setSystemTime(new Date('2099-07-06T08:05:00.000Z'));
    await t.mutation(internal.bookings.processAutomaticAttendance, {});

    const booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking).toMatchObject({
      status: 'no_show',
    });

    const notifications = await t
      .withIdentity(identity('clerk|booking-patient'))
      .query(api.notifications.listMine, {});

    expect(notifications.some((notification: any) => notification.type === 'booking_no_show')).toBe(true);
  });
});
