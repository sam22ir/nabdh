/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split('|').at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

async function seedAcceptedClinicDoctor(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب عام',
      icon: 'stethoscope',
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 16,
      name: 'الجزائر',
    });
    const doctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|schedule-doctor',
      fullName: 'د. الجدول',
      gender: 'male',
      role: 'doctor',
      phone: '+213555810000',
      phoneNormalized: '+213555810000',
      phoneLoginKey: 'dz213555810000',
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
    const clinicUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|schedule-clinic',
      fullName: 'مركز الجدول',
      role: 'clinic',
      phone: '+213555820000',
      phoneNormalized: '+213555820000',
      phoneLoginKey: 'dz213555820000',
      isActive: true,
    });
    const clinicId = await ctx.db.insert('clinics', {
      ownerUserId: clinicUserId,
      name: 'مركز الجدول',
      wilayaId,
      phone: '+213555820000',
      isActive: true,
    });
    const now = Date.now();
    await ctx.db.insert('clinicMemberships', {
      clinicId,
      doctorId,
      requestedBy: 'clinic',
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
      acceptedAt: now,
    });

    return { clinicId, doctorId };
  });
}

async function seedAcceptedClinicWithTwoDoctors(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب عام',
      icon: 'stethoscope',
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 31,
      name: 'وهران',
    });

    const firstDoctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|schedule-doctor-one',
      fullName: 'د. أول',
      gender: 'male',
      role: 'doctor',
      phone: '+213555811111',
      phoneNormalized: '+213555811111',
      phoneLoginKey: 'dz213555811111',
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
      tokenIdentifier: 'clerk|schedule-doctor-two',
      fullName: 'د. ثاني',
      gender: 'female',
      role: 'doctor',
      phone: '+213555822222',
      phoneNormalized: '+213555822222',
      phoneLoginKey: 'dz213555822222',
      isActive: true,
    });
    const secondDoctorId = await ctx.db.insert('doctors', {
      userId: secondDoctorUserId,
      specialtyId,
      bio: '',
      yearsOfExperience: 6,
      avgRating: 0,
      totalReviews: 0,
    });

    const clinicUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|schedule-clinic-two-doctors',
      fullName: 'مركز الجدول المتعدد',
      role: 'clinic',
      phone: '+213555833333',
      phoneNormalized: '+213555833333',
      phoneLoginKey: 'dz213555833333',
      isActive: true,
    });
    const clinicId = await ctx.db.insert('clinics', {
      ownerUserId: clinicUserId,
      name: 'مركز الجدول المتعدد',
      wilayaId,
      phone: '+213555833333',
      isActive: true,
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
      endTime: '12:00',
      appointmentDurationMinutes: 30,
      isActive: true,
    });
    await ctx.db.insert('schedules', {
      clinicId,
      doctorId: secondDoctorId,
      dayOfWeek: 2,
      startTime: '13:00',
      endTime: '16:00',
      appointmentDurationMinutes: 30,
      isActive: true,
    });

    return { clinicId, firstDoctorId, secondDoctorId };
  });
}

describe('schedule vacations', () => {
  test('accepted doctor and clinic can edit doctor-scoped clinic schedules', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAcceptedClinicDoctor(t);

    const scheduleId = await t
      .withIdentity(identity('clerk|schedule-doctor'))
      .mutation(api.schedules.upsertDay, {
        clinicId: seeded.clinicId,
        doctorId: seeded.doctorId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        appointmentDurationMinutes: 30,
        isActive: true,
      });

    await t
      .withIdentity(identity('clerk|schedule-clinic'))
      .mutation(api.schedules.upsertDay, {
        clinicId: seeded.clinicId,
        doctorId: seeded.doctorId,
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '14:00',
        appointmentDurationMinutes: 20,
        isActive: true,
      });

    const stored = await t.run((ctx) => ctx.db.get(scheduleId));

    expect(stored).toMatchObject({
      clinicId: seeded.clinicId,
      doctorId: seeded.doctorId,
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '14:00',
      appointmentDurationMinutes: 20,
      isActive: true,
    });
  });

  test('clinic can add clinic-level closures while doctor can add own closures', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAcceptedClinicDoctor(t);

    await t.withIdentity(identity('clerk|schedule-clinic')).mutation(
      api.schedules.addClinicException,
      {
        clinicId: seeded.clinicId,
        exceptionType: 'full_day',
        exceptionDate: '2099-07-06',
        reason: 'المركز مغلقة',
      },
    );

    await t.withIdentity(identity('clerk|schedule-doctor')).mutation(
      api.schedules.addClinicException,
      {
        clinicId: seeded.clinicId,
        doctorId: seeded.doctorId,
        exceptionType: 'full_day',
        exceptionDate: '2099-07-07',
        reason: 'إجازة المختص',
      },
    );

    const exceptions = await t.run(async (ctx) =>
      ctx.db
        .query('scheduleExceptions')
        .withIndex('by_clinicId_and_exceptionDate', (q) =>
          q.eq('clinicId', seeded.clinicId),
        )
        .take(20),
    );

    const clinicClosure = exceptions.find(
      (exception) => exception.exceptionDate === '2099-07-06',
    );
    const doctorClosure = exceptions.find(
      (exception) => exception.exceptionDate === '2099-07-07',
    );

    expect(clinicClosure).not.toHaveProperty('doctorId');
    expect(doctorClosure).toMatchObject({
      doctorId: seeded.doctorId,
    });
  });

  test('clinic can list and remove doctor-specific exceptions for its accepted doctors', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAcceptedClinicDoctor(t);

    await t.withIdentity(identity('clerk|schedule-clinic')).mutation(
      api.schedules.addClinicException,
      {
        clinicId: seeded.clinicId,
        doctorId: seeded.doctorId,
        exceptionType: 'multi_day',
        exceptionDate: '2099-07-10',
        endDate: '2099-07-11',
        reason: 'إجازة المختص داخل المركز',
      },
    );

    const exceptions = await t.withIdentity(identity('clerk|schedule-clinic')).query(
      api.schedules.getMyClinicExceptions,
      {},
    );

    expect(exceptions).toHaveLength(2);
    expect(exceptions[0]).toMatchObject({
      clinicId: seeded.clinicId,
      doctorId: seeded.doctorId,
    });

    await expect(
      t.withIdentity(identity('clerk|schedule-clinic')).mutation(
        api.schedules.removeException,
        {
          exceptionId: exceptions[0]._id,
        },
      ),
    ).resolves.toEqual({ ok: true });

    const remaining = await t.withIdentity(identity('clerk|schedule-clinic')).query(
      api.schedules.getMyClinicExceptions,
      {},
    );

    expect(remaining).toHaveLength(1);
    expect(remaining[0].exceptionDate).toBe('2099-07-11');
  });

  test('clinic can add a single-hour exception for an accepted doctor', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAcceptedClinicDoctor(t);

    await expect(
      t.withIdentity(identity('clerk|schedule-clinic')).mutation(
        api.schedules.addClinicException,
        {
          clinicId: seeded.clinicId,
          doctorId: seeded.doctorId,
          exceptionType: 'single_hour',
          exceptionDate: '2099-07-10',
          startTime: '09:00',
          reason: 'اجتماع سريع',
        },
      ),
    ).resolves.toMatchObject({
      exceptionId: expect.any(String),
    });

    const exceptions = await t.withIdentity(identity('clerk|schedule-clinic')).query(
      api.schedules.getMyClinicExceptions,
      {},
    );

    expect(exceptions[0]).toMatchObject({
      doctorId: seeded.doctorId,
      exceptionDate: '2099-07-10',
      exceptionType: 'single_hour',
      customStartTime: '09:00',
      customEndTime: '10:00',
    });
  });

  test('clinic can add a multi-day exception for an accepted doctor', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAcceptedClinicDoctor(t);

    await expect(
      t.withIdentity(identity('clerk|schedule-clinic')).mutation(
        api.schedules.addClinicException,
        {
          clinicId: seeded.clinicId,
          doctorId: seeded.doctorId,
          exceptionType: 'multi_day',
          exceptionDate: '2099-07-11',
          endDate: '2099-07-13',
          reason: 'إجازة قصيرة',
        },
      ),
    ).resolves.toMatchObject({
      count: 3,
    });

    const exceptions = await t.withIdentity(identity('clerk|schedule-clinic')).query(
      api.schedules.getMyClinicExceptions,
      {},
    );

    expect(exceptions).toHaveLength(3);
    expect(exceptions[0]).toMatchObject({
      exceptionType: 'multi_day',
      endDate: '2099-07-13',
    });
  });

  test('getByDoctor includes schedules from accepted clinic memberships and filters to that doctor', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedAcceptedClinicWithTwoDoctors(t);

    const doctorSchedules = await t.query(api.schedules.getByDoctor, {
      doctorId: seeded.firstDoctorId,
    });

    expect(doctorSchedules).toHaveLength(1);
    expect(doctorSchedules[0]).toMatchObject({
      clinicId: seeded.clinicId,
      doctorId: seeded.firstDoctorId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });
  });
});
