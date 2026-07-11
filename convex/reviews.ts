import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

async function getPatient(ctx: any) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'patient') throw new ConvexError('Patient account required');
  const patient = await ctx.db
    .query('patients')
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique();
  if (!patient) throw new ConvexError('Patient profile not found');
  return patient;
}

export const listByDoctor = query({
  args: {
    doctorId: v.id('doctors'),
    paginationOpts: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('reviews')
      .withIndex('by_doctorId_and_isHidden', (q) =>
        q.eq('doctorId', args.doctorId).eq('isHidden', false),
      )
      .take(50);
  },
});

export const getStats = query({
  args: { doctorId: v.id('doctors') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    return {
      avgRating: doctor?.avgRating ?? 0,
      totalReviews: doctor?.totalReviews ?? 0,
    };
  },
});

export const getMyPending = query({
  args: {},
  returns: v.any(),
  handler: async () => {
    return [];
  },
});

export const create = mutation({
  args: {
    bookingId: v.id('bookings'),
    overallRating: v.number(),
    punctualityRating: v.optional(v.number()),
    diagnosisRating: v.optional(v.number()),
    professionalismRating: v.optional(v.number()),
    cleanlinessRating: v.optional(v.number()),
    comment: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const patient = await getPatient(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.patientId !== patient._id) {
      throw new ConvexError('Booking not found');
    }

    return await ctx.db.insert('reviews', {
      bookingId: args.bookingId,
      patientId: patient._id,
      doctorId: booking.doctorId,
      overallRating: args.overallRating,
      punctualityRating: args.punctualityRating ?? args.overallRating,
      diagnosisRating: args.diagnosisRating ?? args.overallRating,
      professionalismRating: args.professionalismRating ?? args.overallRating,
      cleanlinessRating: args.cleanlinessRating ?? args.overallRating,
      comment: args.comment,
      isAnonymous: args.isAnonymous ?? false,
      isHidden: false,
    });
  },
});
