import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

const visibilityValidator = v.union(
  v.literal('doctor_private'),
  v.literal('care_team'),
  v.literal('patient_visible'),
);

async function getDoctorForUser(ctx: any, user: Doc<'users'>) {
  return await ctx.db
    .query('doctors')
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique();
}

async function getClinicForUser(ctx: any, user: Doc<'users'>) {
  return await ctx.db
    .query('clinics')
    .withIndex('by_ownerUserId', (q: any) => q.eq('ownerUserId', user._id))
    .unique();
}

async function getMembership(ctx: any, booking: Doc<'bookings'>) {
  const memberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_clinicId_and_doctorId', (q: any) =>
      q.eq('clinicId', booking.clinicId).eq('doctorId', booking.doctorId),
    )
    .order('desc')
    .take(20);
  return memberships.find(
    (membership: Doc<'clinicMemberships'>) =>
      membership.status === 'accepted' || membership.status === 'ended',
  );
}

export const add = mutation({
  args: {
    bookingId: v.id('bookings'),
    content: v.string(),
    visibility: visibilityValidator,
  },
  returns: v.id('encounterNotes'),
  handler: async (ctx, args) => {
    const content = args.content.trim();
    if (!content) throw new ConvexError('Note content is required');
    if (content.length > 4000) throw new ConvexError('Note is too long');

    const user = await getAuthedUser(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new ConvexError('Booking not found');

    if (user.role === 'doctor') {
      const doctor = await getDoctorForUser(ctx, user);
      if (!doctor || booking.doctorId !== doctor._id) {
        throw new ConvexError('Access denied');
      }
      const clinic = await ctx.db.get(booking.clinicId);
      const membership = await getMembership(ctx, booking);
      const hasCurrentAccess =
        clinic?.doctorId === doctor._id || membership?.status === 'accepted';
      if (!hasCurrentAccess) {
        throw new ConvexError('Current clinic membership is required to add notes');
      }
    } else if (user.role === 'clinic') {
      const clinic = await getClinicForUser(ctx, user);
      if (!clinic || booking.clinicId !== clinic._id) {
        throw new ConvexError('Access denied');
      }
      if (args.visibility === 'doctor_private') {
        throw new ConvexError('Clinic notes must be shared with the care team');
      }
    } else {
      throw new ConvexError('Access denied');
    }

    return await ctx.db.insert('encounterNotes', {
      bookingId: booking._id,
      patientId: booking.patientId,
      doctorId: booking.doctorId,
      clinicId: booking.clinicId,
      authorUserId: user._id,
      authorRole: user.role,
      authorName: user.fullName,
      visibility: args.visibility,
      content,
      createdAt: Date.now(),
    });
  },
});

export const listForBooking = query({
  args: { bookingId: v.id('bookings') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new ConvexError('Booking not found');

    let doctor: Doc<'doctors'> | null = null;
    let membership: Doc<'clinicMemberships'> | undefined;
    if (user.role === 'doctor') {
      doctor = await getDoctorForUser(ctx, user);
      if (!doctor || booking.doctorId !== doctor._id) {
        throw new ConvexError('Access denied');
      }
      membership = await getMembership(ctx, booking);
    } else if (user.role === 'clinic') {
      const clinic = await getClinicForUser(ctx, user);
      if (!clinic || booking.clinicId !== clinic._id) {
        throw new ConvexError('Access denied');
      }
    } else {
      throw new ConvexError('Access denied');
    }

    const notes = await ctx.db
      .query('encounterNotes')
      .withIndex('by_bookingId_and_createdAt', (q: any) =>
        q.eq('bookingId', booking._id),
      )
      .order('desc')
      .take(100);

    const visibleNotes = notes.filter((note: Doc<'encounterNotes'>) => {
      if (user.role === 'clinic') return note.visibility !== 'doctor_private';
      if (note.visibility === 'doctor_private') {
        return note.authorUserId === user._id;
      }
      if (membership?.status !== 'ended') return true;
      return note.createdAt <= (membership.endedAt ?? membership.updatedAt);
    });

    if (visibleNotes.length === 0 && booking.doctorNote?.trim()) {
      const doctorUser = doctor ? await ctx.db.get(doctor.userId) : null;
      return [{
        _id: `legacy:${booking._id}`,
        bookingId: booking._id,
        authorName: doctorUser?.fullName ?? 'الطبيب',
        authorRole: 'doctor',
        visibility: 'care_team',
        content: booking.doctorNote,
        createdAt: booking.completedAt ?? booking._creationTime,
        isLegacy: true,
      }];
    }

    return visibleNotes;
  },
});
