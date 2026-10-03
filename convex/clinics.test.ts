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

async function seedDoctorClinicWithSchedule(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', {
      name: 'طب عام',
      icon: 'stethoscope',
    });
    const doctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|doctor-clinic-active',
      fullName: 'مختص المركز',
      gender: 'male',
      role: 'doctor',
      phone: '+213555900000',
      phoneNormalized: '+213555900000',
      phoneLoginKey: 'dz213555900000',
      isActive: true,
    });
    const doctorId = await ctx.db.insert('doctors', {
      userId: doctorUserId,
      specialtyId,
      bio: '',
      yearsOfExperience: 6,
      consultationFee: 2500,
      followUpFee: 1500,
      avgRating: 0,
      totalReviews: 0,
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 18,
      name: 'جيجل',
    });
    const clinicId = await ctx.db.insert('clinics', {
      doctorId,
      name: 'مركز التفعيل',
      wilayaId,
      address: 'وسط المدينة',
      latitude: 36.82,
      longitude: 5.76,
      phone: '+213555900000',
      isActive: true,
    });
    const scheduleId = await ctx.db.insert('schedules', {
      clinicId,
      dayOfWeek: 1,
      startTime: '08:30',
      endTime: '15:00',
      appointmentDurationMinutes: 15,
      isActive: true,
    });

    return { clinicId, scheduleId };
  });
}

describe('clinic active state', () => {
  test('clinic schema and mutations do not require commune ids', () => {
    const schemaSource = readFileSync(join(process.cwd(), 'convex/schema.ts'), 'utf8');
    const clinicsSource = readFileSync(join(process.cwd(), 'convex/clinics.ts'), 'utf8');

    expect(schemaSource).not.toContain("communeId: v.id('communes')");
    expect(clinicsSource).not.toContain("communeId: v.id('communes')");
    expect(clinicsSource).not.toContain('communeId: args.communeId');
  });

  test('setActive disables the clinic without erasing active day schedules', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedDoctorClinicWithSchedule(t);

    await t.withIdentity(identity('clerk|doctor-clinic-active')).mutation(
      api.clinics.setActive,
      {
        clinicId: seeded.clinicId,
        isActive: false,
      },
    );

    const stored = await t.run(async (ctx) => ({
      clinic: await ctx.db.get(seeded.clinicId),
      schedule: await ctx.db.get(seeded.scheduleId),
    }));

    expect(stored.clinic?.isActive).toBe(false);
    expect(stored.schedule?.isActive).toBe(true);

    await t.withIdentity(identity('clerk|doctor-clinic-active')).mutation(
      api.clinics.setActive,
      {
        clinicId: seeded.clinicId,
        isActive: true,
      },
    );

    const reactivated = await t.run(async (ctx) => ({
      clinic: await ctx.db.get(seeded.clinicId),
      schedule: await ctx.db.get(seeded.scheduleId),
    }));

    expect(reactivated.clinic?.isActive).toBe(true);
    expect(reactivated.schedule?.isActive).toBe(true);
  });

  test('create accepts a Google Maps share link without coordinates', async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب عام',
        icon: 'stethoscope',
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|doctor-map-link',
        fullName: 'مختص الرابط',
        gender: 'male',
        role: 'doctor',
        phone: '+213555900001',
        phoneNormalized: '+213555900001',
        phoneLoginKey: 'dz213555900001',
        isActive: true,
      });
      await ctx.db.insert('doctors', {
        userId: doctorUserId,
        specialtyId,
        bio: '',
        yearsOfExperience: 6,
        consultationFee: 2500,
        followUpFee: 1500,
        avgRating: 0,
        totalReviews: 0,
      });
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 18,
        name: 'جيجل',
      });

      return { wilayaId };
    });

    const clinicId = await t.withIdentity(identity('clerk|doctor-map-link')).mutation(
      api.clinics.create,
      {
        name: 'مركز الرابط',
        wilayaId: seeded.wilayaId,
        address: 'وسط المدينة',
        phone: '+213555900001',
        mapUrl: 'https://maps.app.goo.gl/abc123',
      },
    );

    const stored = await t.run(async (ctx) => ctx.db.get(clinicId));

    expect(stored?.mapUrl).toBe('https://maps.app.goo.gl/abc123');
    expect(stored?.latitude).toBeUndefined();
    expect(stored?.longitude).toBeUndefined();
  });

  test('public clinic search shows clinic-owned profiles even without doctors', async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const wilayaId = await ctx.db.insert('wilayas', {
        id: 16,
        name: 'الجزائر',
      });
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-public-empty',
        fullName: 'مركز عامة',
        role: 'clinic',
        phone: '+213555910000',
        phoneNormalized: '+213555910000',
        phoneLoginKey: 'dz213555910000',
        isActive: true,
      });
      const clinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'مركز عامة',
        wilayaId,
        phone: '+213555910000',
        isActive: true,
      });
      return { clinicId, wilayaId };
    });

    await expect(
      t.query(api.clinics.listPublic, {
        paginationOpts: { numItems: 20, cursor: null, id: 1 },
        search: 'عامة',
      }),
    ).resolves.toMatchObject({
      page: [
        {
          _id: seeded.clinicId,
          name: 'مركز عامة',
          isBookable: false,
          acceptedDoctorCount: 0,
          wilaya: { nameAr: 'الجزائر' },
        },
      ],
      isDone: true,
    });
  });

  test('booking context returns accepted doctors for a clinic', async () => {
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
      const clinicUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-public-doctor',
        fullName: 'مركز المختصين',
        role: 'clinic',
        phone: '+213555920000',
        phoneNormalized: '+213555920000',
        phoneLoginKey: 'dz213555920000',
        isActive: true,
      });
      const clinicId = await ctx.db.insert('clinics', {
        ownerUserId: clinicUserId,
        name: 'مركز المختصين',
        wilayaId,
        phone: '+213555920000',
        isActive: true,
      });
      const doctorUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|clinic-public-doctor-user',
        fullName: 'د. داخل المركز',
        gender: 'male',
        role: 'doctor',
        phone: '+213555920001',
        phoneNormalized: '+213555920001',
        phoneLoginKey: 'dz213555920001',
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

    await expect(
      t.query(api.clinics.getBookingContext, {
        clinicId: seeded.clinicId,
        doctorId: seeded.doctorId,
      }),
    ).resolves.toMatchObject({
      clinic: {
        _id: seeded.clinicId,
        name: 'مركز المختصين',
        isBookable: true,
      },
      doctors: [
        {
          _id: seeded.doctorId,
          fullNameAr: 'د. داخل المركز',
          isPreselected: true,
        },
      ],
    });
  });
});
