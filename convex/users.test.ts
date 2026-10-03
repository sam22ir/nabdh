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

async function seedSpecialty(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert('specialties', {
      name: 'طب القلب',
      icon: 'heart-pulse',
    }),
  );
}

describe('auth schema source', () => {
  test('uses Clerk identity fields and removes Convex Auth/French/profile gates', () => {
    const schemaSource = readFileSync(
      join(process.cwd(), 'convex/schema.ts'),
      'utf8',
    );

    expect(schemaSource).not.toContain('authTables');
    expect(schemaSource).toContain('tokenIdentifier: v.string()');
    expect(schemaSource).toContain('fullName: v.string()');
    expect(schemaSource).toContain('phoneNormalized: v.string()');
    expect(schemaSource).toContain('phoneLoginKey: v.string()');
    expect(schemaSource).toContain('emailNormalized: v.optional(v.string())');
    expect(schemaSource).not.toContain('fullNameFr');
    expect(schemaSource).not.toContain('nameFr');
    expect(schemaSource).not.toContain('subSpecialties');
    expect(schemaSource).not.toContain('languages');
    expect(schemaSource).not.toContain('isVerified');
    expect(schemaSource).not.toContain('isProfileComplete');
  });
});

describe('users.registerAccount', () => {
  test('creates patient user and patient profile', async () => {
    const t = convexTest(schema, modules);

    await t
      .withIdentity(identity('clerk|patient-1'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل جديد',
        gender: 'male',
        phone: '05 55 12 34 56',
        email: '',
      });

    const me = await t
      .withIdentity(identity('clerk|patient-1'))
      .query(api.users.me, {});

    expect(me).toMatchObject({
      fullName: 'عميل جديد',
      role: 'patient',
      phone: '05 55 12 34 56',
      phoneNormalized: '+213555123456',
      phoneLoginKey: 'dz213555123456',
      isActive: true,
      profile: {
        chronicDiseases: [],
        allergies: [],
      },
    });
  });

  test('stores a custom Clerk phone login key for orphaned identifier recovery', async () => {
    const t = convexTest(schema, modules);

    await t
      .withIdentity(identity('clerk|patient-custom-key'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل جديد',
        gender: 'male',
        phone: '05 55 12 34 56',
        phoneLoginKey: 'dz213555123456x999',
        email: '',
      });

    const account = await t.query(api.users.findAccountByIdentifier, {
      phone: '0555123456',
      email: '',
    });

    expect(account).toMatchObject({
      exists: true,
      role: 'patient',
      by: 'phone',
      phoneLoginKey: 'dz213555123456x999',
    });
  });

  test('creates doctor user and doctor profile', async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);
    const wilayaId = await t.run((ctx) =>
      ctx.db.insert('wilayas', { id: 16, name: 'الجزائر' }),
    );

    await t
      .withIdentity(identity('clerk|doctor-1'))
      .mutation(api.users.registerAccount, {
        role: 'doctor',
        fullName: 'مختص جديد',
        gender: 'female',
        phone: '+213666123456',
        email: ' DOCTOR@Example.TEST ',
        specialtyId,
        wilayaId,
      });

    const me = await t
      .withIdentity(identity('clerk|doctor-1'))
      .query(api.users.me, {});

    expect(me).toMatchObject({
      fullName: 'مختص جديد',
      role: 'doctor',
      email: 'DOCTOR@Example.TEST',
      emailNormalized: 'doctor@example.test',
      profile: {
        specialtyId,
        wilayaId,
        bio: '',
        yearsOfExperience: 0,
        avgRating: 0,
        totalReviews: 0,
      },
    });
  });

  test('creates clinic user and clinic profile without commune, address, map link, or pricing', async () => {
    const t = convexTest(schema, modules);
    const wilayaId = await t.run((ctx) =>
      ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      }),
    );

    await t
      .withIdentity(identity('clerk|clinic-1'))
      .mutation(api.users.registerAccount, {
        role: 'clinic',
        clinicName: 'مركز الشفاء',
        fullName: 'مركز الشفاء',
        phone: '05 55 88 99 00',
        email: ' CLINIC@example.TEST ',
        wilayaId,
      });

    const me = await t
      .withIdentity(identity('clerk|clinic-1'))
      .query(api.users.me, {});

    expect(me).toMatchObject({
      fullName: 'مركز الشفاء',
      role: 'clinic',
      phone: '05 55 88 99 00',
      phoneNormalized: '+213555889900',
      phoneLoginKey: 'dz213555889900',
      email: 'CLINIC@example.TEST',
      emailNormalized: 'clinic@example.test',
      isActive: true,
      profile: {
        name: 'مركز الشفاء',
        phone: '05 55 88 99 00',
        wilayaId,
        isActive: true,
      },
    });
    if (!me || me.role !== 'clinic' || !me.profile) {
      throw new Error('Expected clinic profile');
    }
    const clinicProfile = me.profile as { address?: string; mapUrl?: string };
    expect(me.gender).toBeUndefined();
    expect(me.profile).not.toHaveProperty('communeId');
    expect(me.profile).not.toHaveProperty('consultationFee');
    expect(me.profile).not.toHaveProperty('followUpFee');
    expect(clinicProfile.address).toBeUndefined();
    expect(clinicProfile.mapUrl).toBeUndefined();
  });

  test('completeDoctorProfile creates doctor profile with specialty only', async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: 'clerk|doctor-complete-blank-order',
        fullName: 'مختص إكمال الملف',
        gender: 'male',
        role: 'doctor',
        phone: '+213555777888',
        phoneNormalized: '+213555777888',
        phoneLoginKey: 'dz213555777888',
        isActive: true,
      }),
    );

    await expect(
      t.withIdentity(identity('clerk|doctor-complete-blank-order')).mutation(
        api.users.completeDoctorProfile,
        {
          specialtyId,
        },
      ),
    ).resolves.toEqual({ ok: true });

    const me = await t
      .withIdentity(identity('clerk|doctor-complete-blank-order'))
      .query(api.users.me, {});

    expect(me?.profile).toMatchObject({
      specialtyId,
      bio: '',
      yearsOfExperience: 0,
    });
  });

  test('rejects duplicate normalized phone across roles', async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);

    await t
      .withIdentity(identity('clerk|patient-2'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل',
        gender: 'male',
        phone: '0555123456',
        email: '',
      });

    await expect(
      t.withIdentity(identity('clerk|doctor-2')).mutation(
        api.users.registerAccount,
        {
          role: 'doctor',
          fullName: 'مختص',
          gender: 'male',
          phone: '+213555123456',
          email: '',
          specialtyId,
        },
      ),
    ).rejects.toThrow(/phone.*registered/i);
  });

  test('rejects duplicate provided email across roles', async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);

    await t
      .withIdentity(identity('clerk|patient-3'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل',
        gender: 'male',
        phone: '0555123456',
        email: 'same@example.test',
      });

    await expect(
      t.withIdentity(identity('clerk|doctor-3')).mutation(
        api.users.registerAccount,
        {
          role: 'doctor',
          fullName: 'مختص',
          gender: 'male',
          phone: '0666123456',
          email: ' SAME@example.test ',
          specialtyId,
        },
      ),
    ).rejects.toThrow(/email.*registered/i);
  });
});

describe('users.getLoginResolution', () => {
  test('returns target path for matching role and display phone', async () => {
    const t = convexTest(schema, modules);
    await t
      .withIdentity(identity('clerk|patient-login'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل',
        gender: 'male',
        phone: '05 55 12 34 56',
        email: '',
      });

    await expect(
      t
        .withIdentity(identity('clerk|patient-login'))
        .query(api.users.getLoginResolution, {
          role: 'patient',
          phone: '05 55 12 34 56',
        }),
    ).resolves.toEqual({ ok: true, redirectTo: '/(patient)' });
  });

  test('returns clinic target path for matching clinic account', async () => {
    const t = convexTest(schema, modules);
    const wilayaId = await t.run((ctx) =>
      ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      }),
    );
    await t
      .withIdentity(identity('clerk|clinic-login'))
      .mutation(api.users.registerAccount, {
        role: 'clinic',
        clinicName: 'مركز الدخول',
        phone: '05 55 12 34 57',
        email: '',
        wilayaId,
      });

    await expect(
      t
        .withIdentity(identity('clerk|clinic-login'))
        .query(api.users.getLoginResolution, {
          role: 'clinic',
          phone: '05 55 12 34 57',
        }),
    ).resolves.toEqual({ ok: true, redirectTo: '/(clinic)/dashboard' });
  });

  test('rejects wrong role', async () => {
    const t = convexTest(schema, modules);
    await t
      .withIdentity(identity('clerk|patient-wrong-role'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل',
        gender: 'male',
        phone: '0555123456',
        email: '',
      });

    await expect(
      t
        .withIdentity(identity('clerk|patient-wrong-role'))
        .query(api.users.getLoginResolution, {
          role: 'doctor',
          phone: '0555123456',
        }),
    ).resolves.toMatchObject({ ok: false, reason: 'role_mismatch' });
  });

  test('rejects display phone mismatch after Clerk sign-in', async () => {
    const t = convexTest(schema, modules);
    await t
      .withIdentity(identity('clerk|patient-phone-mismatch'))
      .mutation(api.users.registerAccount, {
        role: 'patient',
        fullName: 'عميل',
        gender: 'male',
        phone: '05 55 12 34 56',
        email: '',
      });

    await expect(
      t
        .withIdentity(identity('clerk|patient-phone-mismatch'))
        .query(api.users.getLoginResolution, {
          role: 'patient',
          phone: '0555123456',
        }),
    ).resolves.toMatchObject({ ok: false, reason: 'phone_display_mismatch' });
  });
});

describe('users.deleteMyDoctorAccount', () => {
  test('removes active doctor data while preserving detached history', async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);

    const seeded = await t.run(async (ctx) => {
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|doctor-delete',
        fullName: 'مختص الحذف',
        gender: 'male',
        role: 'doctor',
        phone: '+213555777111',
        phoneNormalized: '+213555777111',
        phoneLoginKey: 'dz213555777111',
        email: 'delete@example.test',
        emailNormalized: 'delete@example.test',
        isActive: true,
      });
      const doctorId = await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: 'bio',
        yearsOfExperience: 9,
        consultationFee: 3000,
        followUpFee: 2000,
        avgRating: 4.8,
        totalReviews: 1,
      });
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|patient-delete',
        fullName: 'عميل الحذف',
        gender: 'female',
        role: 'patient',
        phone: '+213555777222',
        phoneNormalized: '+213555777222',
        phoneLoginKey: 'dz213555777222',
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
        name: 'مركز الحذف',
        wilayaId,
        address: 'عنوان',
        phone: '+213555777111',
        isActive: true,
      });
      const bookingId = await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId,
        appointmentDate: '2099-07-10',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'confirmed',
        confirmedAt: Date.now(),
      });
      await ctx.db.insert('reviews', {
        bookingId,
        patientId,
        doctorId,
        overallRating: 5,
        punctualityRating: 5,
        diagnosisRating: 5,
        professionalismRating: 5,
        cleanlinessRating: 5,
        isAnonymous: false,
        isHidden: false,
      });
      await ctx.db.insert('schedules', {
        clinicId,
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '17:00',
        appointmentDurationMinutes: 30,
        isActive: true,
      });
      await ctx.db.insert('scheduleExceptions', {
        clinicId,
        exceptionDate: '2099-07-11',
        reason: 'إجازة',
      });
      await ctx.db.insert('pushTokens', {
        userId: doctorUserId,
        token: 'ExponentPushToken[test-delete]',
        platform: 'android',
      });
      await ctx.db.insert('notifications', {
        userId: doctorUserId,
        type: 'daily_summary',
        title: 'ملخص',
        body: 'body',
        isRead: false,
      });
      await ctx.db.insert('doctorSettings', {
        userId: doctorUserId,
        newBookingAlerts: true,
        cancellationAlerts: true,
        dailySummary: true,
      });
      await ctx.db.insert('patientFavorites', {
        patientId,
        doctorId,
      });

      return { doctorUserId, doctorId, clinicId, bookingId };
    });

    await expect(
      t.withIdentity(identity('clerk|doctor-delete')).mutation(
        api.users.deleteMyDoctorAccount,
        {},
      ),
    ).resolves.toEqual({ ok: true });

    const result = await t.run(async (ctx) => {
      const doctorUser = await ctx.db.get(seeded.doctorUserId);
      const doctor = await ctx.db.get(seeded.doctorId);
      const clinic = await ctx.db.get(seeded.clinicId);
      const booking = await ctx.db.get(seeded.bookingId);
      const schedules = await ctx.db
        .query('schedules')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', seeded.clinicId))
        .take(20);
      const exceptions = await ctx.db
        .query('scheduleExceptions')
        .withIndex('by_clinicId_and_exceptionDate', (q) => q.eq('clinicId', seeded.clinicId))
        .take(20);
      const tokens = await ctx.db
        .query('pushTokens')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.doctorUserId))
        .take(20);
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.doctorUserId))
        .take(20);
      const settings = await ctx.db
        .query('doctorSettings')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.doctorUserId))
        .unique();
      const favorites = await ctx.db
        .query('patientFavorites')
        .withIndex('by_doctorId', (q) => q.eq('doctorId', seeded.doctorId))
        .take(20);
      const reviews = await ctx.db
        .query('reviews')
        .withIndex('by_doctorId', (q) => q.eq('doctorId', seeded.doctorId))
        .take(20);

      return {
        doctorUser,
        doctor,
        clinic,
        booking,
        schedules,
        exceptions,
        tokens,
        notifications,
        settings,
        favorites,
        reviews,
      };
    });

    expect(result.doctorUser).toBeNull();
    expect(result.doctor).toBeNull();
    expect(result.clinic).toBeNull();
    expect(result.schedules).toHaveLength(0);
    expect(result.exceptions).toHaveLength(0);
    expect(result.tokens).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.settings).toBeNull();
    expect(result.favorites).toHaveLength(0);
    expect(result.reviews).toHaveLength(1);
    expect(result.booking).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'system',
      cancellationReason: 'تم حذف حساب المختص',
    });
  });
});

describe('users.deleteMyClinicAccount', () => {
  test('deletes clinic-owned data and cancels active clinic bookings', async () => {
    const t = convexTest(schema, modules);

    const seeded = await t.run(async (ctx) => {
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب عام',
        icon: 'stethoscope',
      });
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-delete',
        fullName: 'مركز للحذف',
        role: 'clinic',
        phone: '+213555991100',
        phoneNormalized: '+213555991100',
        phoneLoginKey: 'dz213555991100',
        isActive: true,
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-delete-doctor',
        fullName: 'مختص المركز',
        gender: 'male',
        role: 'doctor',
        phone: '+213555991101',
        phoneNormalized: '+213555991101',
        phoneLoginKey: 'dz213555991101',
        isActive: true,
      });
      const doctorId = await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 5,
        avgRating: 0,
        totalReviews: 0,
      });
      const clinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'مركز للحذف',
        wilayaId,
        phone: '+213555991100',
        isActive: true,
      });
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-delete-patient',
        fullName: 'عميل المركز',
        gender: 'female',
        role: 'patient',
        phone: '+213555991102',
        phoneNormalized: '+213555991102',
        phoneLoginKey: 'dz213555991102',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });
      const membershipId = await ctx.db.insert('clinicMemberships', {
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
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '17:00',
        appointmentDurationMinutes: 30,
        isActive: true,
      });
      await ctx.db.insert('scheduleExceptions', {
        clinicId,
        doctorId,
        exceptionDate: '2099-07-11',
        reason: 'إغلاق',
      });
      const bookingId = await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId,
        appointmentDate: '2099-07-10',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'confirmed',
        confirmedAt: Date.now(),
      });
      await ctx.db.insert('clinicSettings', {
        userId: clinicUserId,
        clinicId,
        autoCompleteAppointments: true,
        newBookingAlerts: true,
        cancellationAlerts: true,
        dailySummary: false,
      });
      await ctx.db.insert('pushTokens', {
        userId: clinicUserId,
        token: 'ExponentPushToken[test-clinic-delete]',
        platform: 'android',
      });
      await ctx.db.insert('notifications', {
        userId: clinicUserId,
        type: 'clinic_alert',
        title: 'تنبيه',
        body: 'body',
        isRead: false,
      });

      return { clinicUserId, clinicId, bookingId, membershipId };
    });

    await expect(
      t.withIdentity(identity('clerk|clinic-delete')).mutation(
        api.users.deleteMyClinicAccount,
        {},
      ),
    ).resolves.toEqual({ ok: true });

    const result = await t.run(async (ctx) => {
      const clinicUser = await ctx.db.get(seeded.clinicUserId);
      const clinic = await ctx.db.get(seeded.clinicId);
      const booking = await ctx.db.get(seeded.bookingId);
      const schedules = await ctx.db
        .query('schedules')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', seeded.clinicId))
        .take(20);
      const exceptions = await ctx.db
        .query('scheduleExceptions')
        .withIndex('by_clinicId_and_exceptionDate', (q) => q.eq('clinicId', seeded.clinicId))
        .take(20);
      const memberships = await ctx.db
        .query('clinicMemberships')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', seeded.clinicId))
        .take(20);
      const settings = await ctx.db
        .query('clinicSettings')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', seeded.clinicId))
        .unique();
      const tokens = await ctx.db
        .query('pushTokens')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.clinicUserId))
        .take(20);
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.clinicUserId))
        .take(20);

      return {
        clinicUser,
        clinic,
        booking,
        schedules,
        exceptions,
        memberships,
        settings,
        tokens,
        notifications,
      };
    });

    expect(result.clinicUser).toBeNull();
    expect(result.clinic).toBeNull();
    expect(result.schedules).toHaveLength(0);
    expect(result.exceptions).toHaveLength(0);
    expect(result.memberships).toHaveLength(0);
    expect(result.settings).toBeNull();
    expect(result.tokens).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.booking).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'system',
      cancellationReason: 'تم حذف حساب المركز',
    });
  });
});

describe('users.deleteMyPatientAccount', () => {
  test('deletes patient-owned data including bookings and favorites', async () => {
    const t = convexTest(schema, modules);

    const seeded = await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب عام',
        icon: 'stethoscope',
      });
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|patient-delete-doctor',
        fullName: 'مختص العميل',
        gender: 'male',
        role: 'doctor',
        phone: '+213555992100',
        phoneNormalized: '+213555992100',
        phoneLoginKey: 'dz213555992100',
        isActive: true,
      });
      const doctorId = await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 5,
        avgRating: 0,
        totalReviews: 0,
      });
      const clinicId = await ctx.db.insert('clinics', {
        doctorId,
        name: 'مركز المختص',
        wilayaId,
        phone: '+213555992100',
        isActive: true,
      });
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|patient-delete',
        fullName: 'عميل للحذف',
        gender: 'female',
        role: 'patient',
        phone: '+213555992101',
        phoneNormalized: '+213555992101',
        phoneLoginKey: 'dz213555992101',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });
      const bookingId = await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId,
        appointmentDate: '2099-07-10',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'completed',
        confirmedAt: Date.now(),
      });
      await ctx.db.insert('reviews', {
        bookingId,
        patientId,
        doctorId,
        overallRating: 5,
        punctualityRating: 5,
        diagnosisRating: 5,
        professionalismRating: 5,
        cleanlinessRating: 5,
        isAnonymous: false,
        isHidden: false,
      });
      await ctx.db.insert('patientFavorites', {
        patientId,
        doctorId,
      });
      await ctx.db.insert('pushTokens', {
        userId: patientUserId,
        token: 'ExponentPushToken[test-patient-delete]',
        platform: 'android',
      });
      await ctx.db.insert('notifications', {
        userId: patientUserId,
        type: 'patient_alert',
        title: 'تنبيه',
        body: 'body',
        isRead: false,
      });

      return { patientUserId, patientId, bookingId };
    });

    await expect(
      t.withIdentity(identity('clerk|patient-delete')).mutation(
        api.users.deleteMyPatientAccount,
        {},
      ),
    ).resolves.toEqual({ ok: true });

    const result = await t.run(async (ctx) => {
      const patientUser = await ctx.db.get(seeded.patientUserId);
      const patient = await ctx.db.get(seeded.patientId);
      const booking = await ctx.db.get(seeded.bookingId);
      const favorites = await ctx.db
        .query('patientFavorites')
        .withIndex('by_patientId', (q) => q.eq('patientId', seeded.patientId))
        .take(20);
      const tokens = await ctx.db
        .query('pushTokens')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.patientUserId))
        .take(20);
      const notifications = await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', seeded.patientUserId))
        .take(20);
      const reviews = await ctx.db
        .query('reviews')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', seeded.bookingId))
        .take(20);

      return {
        patientUser,
        patient,
        booking,
        favorites,
        tokens,
        notifications,
        reviews,
      };
    });

    expect(result.patientUser).toBeNull();
    expect(result.patient).toBeNull();
    expect(result.booking).toBeNull();
    expect(result.favorites).toHaveLength(0);
    expect(result.tokens).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.reviews).toHaveLength(0);
  });
});

describe('users.updateMyClinicProfile', () => {
  test('updates clinic owner and clinic profile fields together', async () => {
    const t = convexTest(schema, modules);

    const seeded = await t.run(async (ctx) => {
      const initialWilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const nextWilayaId = await ctx.db.insert('wilayas', {
        id: 18,
        name: 'جيجل',
      });
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-update',
        fullName: 'مركز البداية',
        role: 'clinic',
        phone: '+213555880000',
        phoneNormalized: '+213555880000',
        phoneLoginKey: 'dz213555880000',
        email: 'start@example.test',
        emailNormalized: 'start@example.test',
        isActive: true,
      });
      const clinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'مركز البداية',
        wilayaId: initialWilayaId,
        address: 'العنوان القديم',
        mapUrl: 'https://maps.app.goo.gl/start',
        phone: '+213555880000',
        email: 'start@example.test',
        emailNormalized: 'start@example.test',
        isActive: true,
      });

      return { clinicUserId, clinicId, nextWilayaId };
    });

    await expect(
      t.withIdentity(identity('clerk|clinic-update')).mutation(
        api.users.updateMyClinicProfile,
        {
          clinicName: 'مركز الشفاء',
          phone: '0555881111',
          email: 'updated@example.test',
          wilayaId: seeded.nextWilayaId,
          address: 'العنوان الجديد',
          mapUrl: 'https://maps.app.goo.gl/updated',
        },
      ),
    ).resolves.toEqual({ ok: true });

    const result = await t.run(async (ctx) => ({
      user: await ctx.db.get(seeded.clinicUserId),
      clinic: await ctx.db.get(seeded.clinicId),
    }));

    expect(result.user?.fullName).toBe('مركز الشفاء');
    expect(result.user?.phone).toBe('0555881111');
    expect(result.user?.phoneNormalized).toBe('+213555881111');
    expect(result.user?.phoneLoginKey).toBe('dz213555881111');
    expect(result.user?.email).toBe('updated@example.test');
    expect(result.user?.emailNormalized).toBe('updated@example.test');

    expect(result.clinic?.name).toBe('مركز الشفاء');
    expect(result.clinic?.phone).toBe('0555881111');
    expect(result.clinic?.email).toBe('updated@example.test');
    expect(result.clinic?.emailNormalized).toBe('updated@example.test');
    expect(result.clinic?.wilayaId).toBe(seeded.nextWilayaId);
    expect(result.clinic?.address).toBe('العنوان الجديد');
    expect(result.clinic?.mapUrl).toBe('https://maps.app.goo.gl/updated');
  });

  test('clears optional clinic fields when saved as blank', async () => {
    const t = convexTest(schema, modules);

    const seeded = await t.run(async (ctx) => {
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 31,
        name: 'وهران',
      });
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-update-blank',
        fullName: 'مركز الفراغ',
        role: 'clinic',
        phone: '+213555880001',
        phoneNormalized: '+213555880001',
        phoneLoginKey: 'dz213555880001',
        email: 'blank@example.test',
        emailNormalized: 'blank@example.test',
        isActive: true,
      });
      const clinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'مركز الفراغ',
        wilayaId,
        address: 'عنوان سابق',
        mapUrl: 'https://maps.app.goo.gl/blank',
        phone: '+213555880001',
        email: 'blank@example.test',
        emailNormalized: 'blank@example.test',
        isActive: true,
      });

      return { clinicId, wilayaId };
    });

    await expect(
      t.withIdentity(identity('clerk|clinic-update-blank')).mutation(
        api.users.updateMyClinicProfile,
        {
          clinicName: 'مركز الفراغ',
          phone: '0555880001',
          email: '',
          wilayaId: seeded.wilayaId,
          address: '',
          mapUrl: '',
        },
      ),
    ).resolves.toEqual({ ok: true });

    const clinic = await t.run(async (ctx) => ctx.db.get(seeded.clinicId));

    expect(clinic?.email).toBeUndefined();
    expect(clinic?.emailNormalized).toBeUndefined();
    expect(clinic?.address).toBeUndefined();
    expect(clinic?.mapUrl).toBeUndefined();
  });
});
