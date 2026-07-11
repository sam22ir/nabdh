/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);
const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split('|').at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

async function seedEncounter(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert('specialties', { name: 'طب عام', icon: 'medical' });
    const wilayaId = await ctx.db.insert('wilayas', { id: 16, name: 'الجزائر' });
    const clinicUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|notes-clinic', fullName: 'عيادة النبض', role: 'clinic',
      phone: '+213555810000', phoneNormalized: '+213555810000',
      phoneLoginKey: 'dz213555810000', isActive: true,
    });
    const doctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|notes-doctor', fullName: 'د. المعالج', role: 'doctor',
      phone: '+213555810001', phoneNormalized: '+213555810001',
      phoneLoginKey: 'dz213555810001', isActive: true,
    });
    const otherDoctorUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|notes-other', fullName: 'د. آخر', role: 'doctor',
      phone: '+213555810002', phoneNormalized: '+213555810002',
      phoneLoginKey: 'dz213555810002', isActive: true,
    });
    const patientUserId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|notes-patient', fullName: 'المريض', role: 'patient',
      phone: '+213555810003', phoneNormalized: '+213555810003',
      phoneLoginKey: 'dz213555810003', isActive: true,
    });
    const doctorId = await ctx.db.insert('doctors', {
      userId: doctorUserId, specialtyId, bio: '', yearsOfExperience: 4,
      avgRating: 0, totalReviews: 0,
    });
    await ctx.db.insert('doctors', {
      userId: otherDoctorUserId, specialtyId, bio: '', yearsOfExperience: 2,
      avgRating: 0, totalReviews: 0,
    });
    const patientId = await ctx.db.insert('patients', {
      userId: patientUserId, chronicDiseases: [], allergies: [],
    });
    const clinicId = await ctx.db.insert('clinics', {
      ownerUserId: clinicUserId, name: 'عيادة النبض', wilayaId,
      phone: '+213555810000', isActive: true,
    });
    const now = Date.now();
    const membershipId = await ctx.db.insert('clinicMemberships', {
      clinicId, doctorId, requestedBy: 'clinic', status: 'accepted',
      createdAt: now, updatedAt: now, acceptedAt: now,
    });
    const bookingId = await ctx.db.insert('bookings', {
      patientId, doctorId, clinicId, appointmentDate: '2026-07-01',
      appointmentTime: '09:00', appointmentDuration: 30,
      visitType: 'consultation', status: 'completed', completedAt: now,
    });
    return { bookingId, membershipId };
  });
}

test('only the treating doctor can add an encounter note', async () => {
  const t = convexTest(schema, modules);
  const { bookingId } = await seedEncounter(t);

  await expect(t.withIdentity(identity('clerk|notes-other')).mutation(api.encounterNotes.add, {
    bookingId, content: 'غير مسموح', visibility: 'care_team',
  })).rejects.toThrow('Access denied');
});

test('departed doctor keeps old shared notes but cannot see later clinic notes', async () => {
  const t = convexTest(schema, modules);
  const { bookingId, membershipId } = await seedEncounter(t);

  await t.withIdentity(identity('clerk|notes-doctor')).mutation(api.encounterNotes.add, {
    bookingId, content: 'قبل المغادرة', visibility: 'care_team',
  });
  await t.run(async (ctx) => {
    const endedAt = Date.now() + 10;
    await ctx.db.patch(membershipId, { status: 'ended', endedAt, updatedAt: endedAt });
  });
  await t.withIdentity(identity('clerk|notes-clinic')).mutation(api.encounterNotes.add, {
    bookingId, content: 'بعد المغادرة', visibility: 'care_team',
  });

  const doctorNotes = await t.withIdentity(identity('clerk|notes-doctor'))
    .query(api.encounterNotes.listForBooking, { bookingId });
  const clinicNotes = await t.withIdentity(identity('clerk|notes-clinic'))
    .query(api.encounterNotes.listForBooking, { bookingId });

  expect(doctorNotes.map((note: { content: string }) => note.content)).toEqual(['قبل المغادرة']);
  expect(clinicNotes.map((note: { content: string }) => note.content)).toEqual([
    'بعد المغادرة', 'قبل المغادرة',
  ]);
});
