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

async function seedClinicDoctorPair(t: ReturnType<typeof convexTest>) {
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
      tokenIdentifier: 'clerk|membership-doctor',
      fullName: 'د. عضوية',
      gender: 'male',
      role: 'doctor',
      phone: '+213555400000',
      phoneNormalized: '+213555400000',
      phoneLoginKey: 'dz213555400000',
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
    const clinicUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|membership-clinic',
      fullName: 'مركز العضوية',
      role: 'clinic',
      phone: '+213555500000',
      phoneNormalized: '+213555500000',
      phoneLoginKey: 'dz213555500000',
      isActive: true,
    });
    const clinicId = await ctx.db.insert('clinics', {
      ownerUserId: clinicUserId,
      name: 'مركز العضوية',
      wilayaId,
      phone: '+213555500000',
      isActive: true,
    });

    return { doctorId, doctorUserId, clinicId, clinicUserId, specialtyId, wilayaId };
  });
}

describe('clinic memberships', () => {
  test('doctor can request a clinic and clinic acceptance creates the only accepted membership', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicDoctorPair(t);

    const membershipId = await t
      .withIdentity(identity('clerk|membership-doctor'))
      .mutation(api.clinicMemberships.requestToJoinClinic, {
        clinicId: seeded.clinicId,
      });

    const pendingForClinic = await t
      .withIdentity(identity('clerk|membership-clinic'))
      .query(api.clinicMemberships.listMyClinicRequests, {});

    expect(pendingForClinic).toMatchObject([
      {
        _id: membershipId,
        clinicId: seeded.clinicId,
        doctorId: seeded.doctorId,
        requestedBy: 'doctor',
        status: 'pending',
        doctorName: 'د. عضوية',
      },
    ]);

    await t
      .withIdentity(identity('clerk|membership-clinic'))
      .mutation(api.clinicMemberships.accept, { membershipId });

    const doctorMembership = await t
      .withIdentity(identity('clerk|membership-doctor'))
      .query(api.clinicMemberships.getMyAcceptedClinic, {});

    expect(doctorMembership).toMatchObject({
      _id: membershipId,
      clinicId: seeded.clinicId,
      doctorId: seeded.doctorId,
      status: 'accepted',
      clinicName: 'مركز العضوية',
    });

    const secondClinicUserId = await t.run((ctx) =>
      ctx.db.insert('users', {
        tokenIdentifier: 'clerk|membership-clinic-2',
        fullName: 'مركز ثانية',
        role: 'clinic',
        phone: '+213555500001',
        phoneNormalized: '+213555500001',
        phoneLoginKey: 'dz213555500001',
        isActive: true,
      }),
    );
    const secondClinicId = await t.run((ctx) =>
      ctx.db.insert('clinics', {
        ownerUserId: secondClinicUserId,
        name: 'مركز ثانية',
        wilayaId: seeded.wilayaId,
        phone: '+213555500001',
        isActive: true,
      }),
    );

    const secondMembershipId = await t
      .withIdentity(identity('clerk|membership-clinic-2'))
      .mutation(api.clinicMemberships.inviteDoctor, {
        doctorId: seeded.doctorId,
      });

    await expect(
      t
        .withIdentity(identity('clerk|membership-doctor'))
        .mutation(api.clinicMemberships.accept, {
          membershipId: secondMembershipId,
        }),
    ).rejects.toThrow(/already belongs/i);

    const secondMembership = await t.run((ctx) => ctx.db.get(secondMembershipId));
    expect(secondMembership).toMatchObject({
      clinicId: secondClinicId,
      status: 'pending',
    });
  });

  test('clinic invite notifies doctor and doctor can accept it', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicDoctorPair(t);

    const membershipId = await t
      .withIdentity(identity('clerk|membership-clinic'))
      .mutation(api.clinicMemberships.inviteDoctor, {
        doctorId: seeded.doctorId,
      });

    const notifications = await t
      .withIdentity(identity('clerk|membership-doctor'))
      .query(api.notifications.listMine, {});

    expect(notifications).toMatchObject([
      {
        userId: seeded.doctorUserId,
        type: 'clinic_invite',
        title: 'دعوة للانضمام إلى مركز',
      },
    ]);

    await t
      .withIdentity(identity('clerk|membership-doctor'))
      .mutation(api.clinicMemberships.accept, { membershipId });

    const members = await t
      .withIdentity(identity('clerk|membership-clinic'))
      .query(api.clinicMemberships.listMyClinicDoctors, {});

    expect(members).toMatchObject([
      {
        _id: membershipId,
        doctorId: seeded.doctorId,
        doctorName: 'د. عضوية',
        status: 'accepted',
      },
    ]);
  });

  test('ending a membership cancels future bookings and notifies the patient', async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedClinicDoctorPair(t);
    const patient = await t.run(async (ctx) => {
      const patientUserId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|membership-patient',
        fullName: 'عميل العضوية',
        gender: 'female',
        role: 'patient',
        phone: '+213555600000',
        phoneNormalized: '+213555600000',
        phoneLoginKey: 'dz213555600000',
        isActive: true,
      });
      const patientId = await ctx.db.insert('patients', {
        userId: patientUserId,
        chronicDiseases: [],
        allergies: [],
      });
      return { patientUserId, patientId };
    });
    const membershipId = await t
      .withIdentity(identity('clerk|membership-clinic'))
      .mutation(api.clinicMemberships.inviteDoctor, {
        doctorId: seeded.doctorId,
      });
    await t
      .withIdentity(identity('clerk|membership-doctor'))
      .mutation(api.clinicMemberships.accept, { membershipId });

    const bookingId = await t.run((ctx) =>
      ctx.db.insert('bookings', {
        patientId: patient.patientId,
        doctorId: seeded.doctorId,
        clinicId: seeded.clinicId,
        appointmentDate: '2099-07-10',
        appointmentTime: '10:00',
        appointmentDuration: 30,
        visitType: 'consultation',
        status: 'confirmed',
        confirmedAt: Date.now(),
      }),
    );

    await t
      .withIdentity(identity('clerk|membership-clinic'))
      .mutation(api.clinicMemberships.removeDoctor, {
        doctorId: seeded.doctorId,
        reason: 'تم إنهاء عضوية المختص في المركز',
      });

    const result = await t.run(async (ctx) => ({
      membership: await ctx.db.get(membershipId),
      booking: await ctx.db.get(bookingId),
      notifications: await ctx.db
        .query('notifications')
        .withIndex('by_userId', (q) => q.eq('userId', patient.patientUserId))
        .take(20),
    }));

    expect(result.membership).toMatchObject({
      status: 'ended',
      endedBy: 'clinic',
    });
    expect(result.booking).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'system',
      cancellationReason: 'تم إنهاء عضوية المختص في المركز',
    });
    expect(result.notifications).toMatchObject([
      {
        type: 'booking_cancelled',
        title: 'تم إلغاء الموعد',
        body: expect.stringContaining('تم إنهاء عضوية المختص في المركز'),
      },
    ]);
  });
});
