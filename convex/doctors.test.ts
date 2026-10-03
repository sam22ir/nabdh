/// <reference types="vite/client" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split('|').at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

async function seedDoctor(
  t: ReturnType<typeof convexTest>,
  scheduleOffsetDays = 0,
) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب القلب',
      icon: 'heart-pulse',
    });
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|doctor-search',
      fullName: 'مختص البحث',
      gender: 'female',
      role: 'doctor',
      phone: '+213555123456',
      phoneNormalized: '+213555123456',
      phoneLoginKey: 'dz213555123456',
      isActive: true,
    });
    const doctorId = await ctx.db.insert('doctors', {
      userId,
      specialtyId,
      bio: '',
      yearsOfExperience: 7,
      consultationFee: 2000,
      followUpFee: 1000,
      avgRating: 4.5,
      totalReviews: 12,
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 16,
      name: 'الجزائر',
    });
    const clinicId = await ctx.db.insert('clinics', {
      doctorId,
      name: 'مركز البحث',
      wilayaId,
      address: 'شارع الاختبار',
      latitude: 36.75,
      longitude: 3.06,
      phone: '+213555123456',
      isActive: true,
    });
    await ctx.db.insert('schedules', {
      clinicId,
      dayOfWeek: (new Date().getDay() + scheduleOffsetDays) % 7,
      startTime: '09:00',
      endTime: '12:00',
      appointmentDurationMinutes: 30,
      isActive: true,
    });

    return { specialtyId, wilayaId };
  });
}

async function seedDoctorWithoutClinic(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب عام',
      icon: 'stethoscope',
    });
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|doctor-no-clinic',
      fullName: 'مختص بلا مركز',
      gender: 'male',
      role: 'doctor',
      phone: '+213555930000',
      phoneNormalized: '+213555930000',
      phoneLoginKey: 'dz213555930000',
      isActive: true,
    });
    const doctorId = await ctx.db.insert('doctors', {
      userId,
      specialtyId,
      bio: '',
      yearsOfExperience: 1,
      avgRating: 0,
      totalReviews: 0,
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 16,
      name: 'الجزائر',
    });

    return { doctorId, specialtyId, wilayaId };
  });
}

describe('doctors public search', () => {
  test('listPublic accepts Convex pagination options from usePaginatedQuery', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctor(t);

    await expect(
      t.query(api.doctors.listPublic, {
        specialtyId: seeded.specialtyId,
        wilayaId: seeded.wilayaId,
        availableToday: true,
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
      }),
    ).resolves.toMatchObject({
      page: [
        {
          user: { fullNameAr: 'مختص البحث' },
          specialty: { nameAr: 'القلب' },
        },
      ],
      isDone: true,
    });
  });

  test('search accepts Convex pagination options from usePaginatedQuery', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctor(t);

    await expect(
      t.query(api.doctors.search, {
        query: 'القلب',
        specialtyId: seeded.specialtyId,
        wilayaId: seeded.wilayaId,
        availableToday: true,
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
      }),
    ).resolves.toMatchObject({
      page: [
        {
          user: { fullNameAr: 'مختص البحث' },
          specialty: { nameAr: 'القلب' },
        },
      ],
      isDone: true,
    });
  });

  test('listPublic exposes next day availability when the doctor is available tomorrow', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctor(t, 1);

    await expect(
      t.query(api.doctors.listPublic, {
        specialtyId: seeded.specialtyId,
        wilayaId: seeded.wilayaId,
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
      }),
    ).resolves.toMatchObject({
      page: [
        {
          isAvailableToday: false,
          nextAvailableInDays: 1,
        },
      ],
    });
  });

  test('listPublic exposes multi-day availability when the doctor is not available until later', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctor(t, 3);

    await expect(
      t.query(api.doctors.listPublic, {
        specialtyId: seeded.specialtyId,
        wilayaId: seeded.wilayaId,
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
      }),
    ).resolves.toMatchObject({
      page: [
        {
          isAvailableToday: false,
          nextAvailableInDays: 3,
        },
      ],
    });
  });

  test('doctor without accepted clinic is visible but not bookable', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWithoutClinic(t);

    await expect(
      t.query(api.doctors.listPublic, {
        specialtyId: seeded.specialtyId,
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
      }),
    ).resolves.toMatchObject({
      page: [
        {
          _id: seeded.doctorId,
          fullNameAr: 'مختص بلا مركز',
          isBookable: false,
          acceptedClinicId: null,
        },
      ],
    });
  });

  test('doctor with accepted clinic exposes clinic booking target', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctorWithoutClinic(t);
    const clinicId = await t.run(async (ctx) => {
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|doctor-accepted-clinic',
        fullName: 'مركز المختص',
        role: 'clinic',
        phone: '+213555930001',
        phoneNormalized: '+213555930001',
        phoneLoginKey: 'dz213555930001',
        isActive: true,
      });
      const createdClinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'مركز المختص',
        wilayaId: seeded.wilayaId,
        phone: '+213555930001',
        isActive: true,
      });
      const now = Date.now();
      await ctx.db.insert('clinicMemberships', {
        clinicId: createdClinicId,
        doctorId: seeded.doctorId,
        requestedBy: 'clinic',
        status: 'accepted',
        createdAt: now,
        updatedAt: now,
        acceptedAt: now,
      });
      return createdClinicId;
    });

    await expect(
      t.query(api.doctors.listPublic, {
        specialtyId: seeded.specialtyId,
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
      }),
    ).resolves.toMatchObject({
      page: [
        {
          _id: seeded.doctorId,
          isBookable: true,
          acceptedClinicId: clinicId,
          clinics: [
            {
              _id: clinicId,
              name: 'مركز المختص',
            },
          ],
        },
      ],
    });
  });

  test('updateProfile accepts the doctor profile form payload from the app', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctor(t);

    await expect(
      t.withIdentity(identity('clerk|doctor-search')).mutation(
        api.doctors.updateProfile,
        {
          fullNameAr: 'مختص الملف',
          email: ' DOCTOR.PROFILE@Example.TEST ',
          phone: '0550951413',
          specialtyId: seeded.specialtyId,
          bioAr: 'سيرة المختص',
          yearsOfExperience: 9,
          consultationFee: 3000,
          followUpFee: 1500,
        },
      ),
    ).resolves.toEqual({ ok: true });

    const profile = await t
      .withIdentity(identity('clerk|doctor-search'))
      .query(api.doctors.getMyProfile, {});

    expect(profile).toMatchObject({
      fullName: 'مختص الملف',
      phone: '0550951413',
      bio: 'سيرة المختص',
      bioAr: 'سيرة المختص',
      yearsOfExperience: 9,
      consultationFee: 3000,
      followUpFee: 1500,
      user: {
        fullNameAr: 'مختص الملف',
        email: 'DOCTOR.PROFILE@Example.TEST',
        phone: '0550951413',
      },
    });
    expect(profile).not.toHaveProperty('clinics');
  });

  test('updateProfile rejects duplicate doctor email', async () => {
    const t = convexTest(schema, modules);
    await seedDoctor(t);

    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|other-user',
        fullName: 'مستخدم آخر',
        gender: 'male',
        role: 'patient',
        phone: '+213666123456',
        phoneNormalized: '+213666123456',
        phoneLoginKey: 'dz213666123456',
        email: 'taken@example.test',
        emailNormalized: 'taken@example.test',
        isActive: true,
      });
    });

    await expect(
      t.withIdentity(identity('clerk|doctor-search')).mutation(
        api.doctors.updateProfile,
        {
          email: ' TAKEN@example.test ',
        },
      ),
    ).rejects.toThrow(/email.*registered/i);
  });

  test('updateProfile accepts profile updates without graduation number', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctor(t);

    await expect(
      t.withIdentity(identity('clerk|doctor-search')).mutation(
        api.doctors.updateProfile,
        {
          fullNameAr: 'مختص بدون رقم نقابة',
          phone: '0550951413',
          specialtyId: seeded.specialtyId,
          bioAr: '',
          yearsOfExperience: 5,
          consultationFee: 3000,
          followUpFee: 1500,
        },
      ),
    ).resolves.toEqual({ ok: true });
  });

  test('updateProfile clears optional prices when the doctor leaves them blank', async () => {
    const t = convexTest(schema, modules);
    await seedDoctor(t);

    await expect(
      t.withIdentity(identity('clerk|doctor-search')).mutation(
        api.doctors.updateProfile,
        {
          consultationFee: null,
          followUpFee: null,
        },
      ),
    ).resolves.toEqual({ ok: true });

    const profile = await t
      .withIdentity(identity('clerk|doctor-search'))
      .query(api.doctors.getMyProfile, {});

    expect(profile).not.toHaveProperty('consultationFee');
    expect(profile).not.toHaveProperty('followUpFee');
  });

  test('doctor profile API no longer exposes French profile fields', () => {
    const source = readFileSync(join(process.cwd(), 'convex/doctors.ts'), 'utf8');

    expect(source).not.toContain('fullNameFr');
    expect(source).not.toContain('fullNameFr: v.optional');
    expect(source).not.toContain('bioFr');
    expect(source).not.toContain('bioFr: v.optional');
    expect(source).not.toContain('subSpecialties');
    expect(source).not.toContain('subSpecialties: v.optional');
    expect(source).not.toContain('languages');
    expect(source).not.toContain('language: v.optional');
  });
});
