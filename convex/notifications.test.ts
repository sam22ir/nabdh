/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split('|').at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

async function seedBookingScenario(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب عام',
      icon: 'stethoscope',
    });
    const doctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|doctor-notifications',
      fullName: 'مختص التنبيهات',
      gender: 'male',
      role: 'doctor',
      phone: '+213555444444',
      phoneNormalized: '+213555444444',
      phoneLoginKey: 'dz213555444444',
      isActive: true,
    });
    const doctorId = await ctx.db.insert('doctors', {
      userId: doctorUserId,
      specialtyId,
      bio: '',
      yearsOfExperience: 8,
      consultationFee: 2500,
      followUpFee: 1500,
      avgRating: 0,
      totalReviews: 0,
    });
    const patientUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|patient-notifications',
      fullName: 'عميلة التنبيهات',
      gender: 'female',
      role: 'patient',
      phone: '+213555555555',
      phoneNormalized: '+213555555555',
      phoneLoginKey: 'dz213555555555',
      isActive: true,
    });
    const patientId = await ctx.db.insert('patients', {
      userId: patientUserId,
      chronicDiseases: [],
      allergies: [],
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 31,
      name: 'وهران',
    });
    const clinicUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|clinic-notifications',
      fullName: 'مركز التنبيهات',
      role: 'clinic',
      phone: '+213555666666',
      phoneNormalized: '+213555666666',
      phoneLoginKey: 'dz213555666666',
      isActive: true,
    });
    const clinicId = await ctx.db.insert('clinics', {
      ownerUserId: clinicUserId,
      doctorId,
      name: 'مركز التنبيهات',
      wilayaId,
      address: 'شارع المختص',
      phone: '+213555444444',
      isActive: true,
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
    await ctx.db.insert('schedules', {
      clinicId,
      doctorId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      appointmentDurationMinutes: 30,
      isActive: true,
    });

    return { doctorId, doctorUserId, patientId, clinicId };
  });
}

describe('doctor booking notifications', () => {
  test('booking create generates a doctor notification row', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T09:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedBookingScenario(t);

    await t
      .withIdentity(identity('clerk|patient-notifications'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2026-07-06',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'first',
        reason: 'استشارة جديدة',
      });

    const notifications = await t
      .withIdentity(identity('clerk|doctor-notifications'))
      .query(api.notifications.listMine, {});

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: 'new_booking',
      title: 'حجز جديد',
      isRead: false,
    });
    expect(notifications[0].body).toContain('عميلة التنبيهات');
  });

  test('booking cancel generates a doctor notification row', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T09:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedBookingScenario(t);

    const bookingId = await t
      .withIdentity(identity('clerk|patient-notifications'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2026-07-06',
        appointmentTime: '11:00',
        appointmentDuration: 30,
        visitType: 'followup',
      });

    await t
      .withIdentity(identity('clerk|patient-notifications'))
      .mutation(api.bookings.cancel, {
        bookingId,
        reason: 'تعذر الحضور',
      });

    const notifications = await t
      .withIdentity(identity('clerk|doctor-notifications'))
      .query(api.notifications.listMine, {});

    expect(notifications).toHaveLength(2);
    expect(notifications.map((notification: Doc<'notifications'>) => notification.type)).toEqual([
      'new_booking',
      'booking_cancelled',
    ]);

    const cancellationNotification = notifications.find(
      (notification: Doc<'notifications'>) => notification.type === 'booking_cancelled',
    );

    expect(cancellationNotification).toMatchObject({
      type: 'booking_cancelled',
      title: 'إلغاء موعد',
      isRead: false,
    });
    expect(cancellationNotification?.body).toContain('عميلة التنبيهات');
  });

  test('daily summary creates a doctor notification only when the clinic setting is enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T08:00:00.000Z'));

    const t = convexTest(schema, modules);
    const seeded = await seedBookingScenario(t);

    await t
      .withIdentity(identity('clerk|patient-notifications'))
      .mutation(api.bookings.create, {
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2026-07-05',
        appointmentTime: '13:00',
        appointmentDuration: 30,
        visitType: 'consultation',
      });

    await t
      .withIdentity(identity('clerk|clinic-notifications'))
      .mutation(api.clinicSettings.updateMy, {
        dailySummary: true,
      });

    await t.mutation(internal.notifications.sendDailySummaries, {});

    const notifications = await t
      .withIdentity(identity('clerk|doctor-notifications'))
      .query(api.notifications.listMine, {});

    const dailySummary = notifications.find(
      (notification: Doc<'notifications'>) => notification.type === 'daily_summary',
    );

    expect(dailySummary).toMatchObject({
      type: 'daily_summary',
      title: 'ملخص اليوم',
      isRead: false,
    });
    expect(dailySummary?.body).toContain('1');
  });
});
