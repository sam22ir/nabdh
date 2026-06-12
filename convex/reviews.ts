import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { getAuthedUserId, requireRole } from "./lib/auth";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const publicReviewFields = {
  _id: v.id("reviews"),
  _creationTime: v.number(),
  doctorId: v.id("doctors"),
  overallRating: v.number(),
  punctualityRating: v.number(),
  diagnosisRating: v.number(),
  professionalismRating: v.number(),
  cleanlinessRating: v.number(),
  comment: v.optional(v.string()),
  isAnonymous: v.boolean(),
  doctorReply: v.optional(v.string()),
} as const;

const publicReviewValidator = v.object(publicReviewFields);
const paginatedReviewsValidator = paginationResultValidator(publicReviewValidator);

const ratingFields = [
  "overallRating",
  "punctualityRating",
  "diagnosisRating",
  "professionalismRating",
  "cleanlinessRating",
] as const;

function assertValidRating(rating: number) {
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Ratings must be finite numbers between 1 and 5");
  }
}

function hasValidRatingValues(review: Doc<"reviews">) {
  return ratingFields.every((field) => {
    const rating = review[field];
    return Number.isFinite(rating) && rating >= 1 && rating <= 5;
  });
}

function toPublicReview(review: Doc<"reviews">) {
  const publicReview: {
    _id: Id<"reviews">;
    _creationTime: number;
    doctorId: Id<"doctors">;
    overallRating: number;
    punctualityRating: number;
    diagnosisRating: number;
    professionalismRating: number;
    cleanlinessRating: number;
    comment?: string;
    isAnonymous: boolean;
    doctorReply?: string;
  } = {
    _id: review._id,
    _creationTime: review._creationTime,
    doctorId: review.doctorId,
    overallRating: review.overallRating,
    punctualityRating: review.punctualityRating,
    diagnosisRating: review.diagnosisRating,
    professionalismRating: review.professionalismRating,
    cleanlinessRating: review.cleanlinessRating,
    isAnonymous: review.isAnonymous,
  };

  if (review.comment !== undefined) publicReview.comment = review.comment;
  if (review.doctorReply !== undefined) {
    publicReview.doctorReply = review.doctorReply;
  }

  return publicReview;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Paginated reviews for a specific doctor, newest first. Public.
 */
export const listByDoctor = query({
  args: {
    doctorId: v.id("doctors"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedReviewsValidator,
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("reviews")
      .withIndex("by_doctorId_and_isHidden", (q) =>
        q.eq("doctorId", args.doctorId).eq("isHidden", false),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.filter(hasValidRatingValues).map(toPublicReview),
    };
  },
});

/**
 * Review statistics for a doctor: average ratings, total count, and star
 * distribution percentages. Only non-hidden reviews are counted.
 */
export const getStats = query({
  args: { doctorId: v.id("doctors") },
  returns: v.object({
    totalCount: v.number(),
    avgOverall: v.number(),
    avgPunctuality: v.number(),
    avgDiagnosis: v.number(),
    avgProfessionalism: v.number(),
    avgCleanliness: v.number(),
    starDistribution: v.array(
      v.object({
        stars: v.number(),
        count: v.number(),
        percentage: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_doctorId_and_isHidden", (q) =>
        q.eq("doctorId", args.doctorId).eq("isHidden", false),
      )
      .collect();

    const validReviews = reviews.filter(hasValidRatingValues);
    const totalCount = validReviews.length;

    if (totalCount === 0) {
      return {
        totalCount: 0,
        avgOverall: 0,
        avgPunctuality: 0,
        avgDiagnosis: 0,
        avgProfessionalism: 0,
        avgCleanliness: 0,
        starDistribution: [1, 2, 3, 4, 5].map((stars) => ({
          stars,
          count: 0,
          percentage: 0,
        })),
      };
    }

    const sumOverall = validReviews.reduce((s, r) => s + r.overallRating, 0);
    const sumPunctuality = validReviews.reduce(
      (s, r) => s + r.punctualityRating,
      0,
    );
    const sumDiagnosis = validReviews.reduce(
      (s, r) => s + r.diagnosisRating,
      0,
    );
    const sumProfessionalism = validReviews.reduce(
      (s, r) => s + r.professionalismRating,
      0,
    );
    const sumCleanliness = validReviews.reduce(
      (s, r) => s + r.cleanlinessRating,
      0,
    );

    // Star distribution from 1 to 5 based on overallRating
    const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of validReviews) {
      const star = Math.round(r.overallRating);
      if (star >= 1 && star <= 5) {
        starCounts[star] = (starCounts[star] ?? 0) + 1;
      }
    }

    const starDistribution = [1, 2, 3, 4, 5].map((stars) => ({
      stars,
      count: starCounts[stars],
      percentage:
        totalCount > 0
          ? Math.round((starCounts[stars] / totalCount) * 100)
          : 0,
    }));

    return {
      totalCount,
      avgOverall: Math.round((sumOverall / totalCount) * 10) / 10,
      avgPunctuality: Math.round((sumPunctuality / totalCount) * 10) / 10,
      avgDiagnosis: Math.round((sumDiagnosis / totalCount) * 10) / 10,
      avgProfessionalism: Math.round((sumProfessionalism / totalCount) * 10) / 10,
      avgCleanliness: Math.round((sumCleanliness / totalCount) * 10) / 10,
      starDistribution,
    };
  },
});

/**
 * Returns completed bookings from the last 30 days that the current patient
 * has not yet reviewed. Auth required, patient role.
 */
export const getMyPending = query({
  args: {},
  returns: v.array(
    v.object({
      bookingId: v.id("bookings"),
      appointmentDate: v.string(),
      appointmentTime: v.string(),
      appointmentDuration: v.number(),
      visitType: v.union(
        v.literal("first"),
        v.literal("followup"),
        v.literal("consultation"),
      ),
      doctorId: v.id("doctors"),
      doctorName: v.string(),
      clinicId: v.id("clinics"),
      clinicName: v.string(),
      completedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!patient) return [];

    // Threshold: 30 days ago
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // All bookings for this patient
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .collect();

    // Filter by completed within last 30 days
    const recentCompleted = bookings.filter(
      (b) =>
        b.status === "completed" &&
        b.completedAt !== undefined &&
        b.completedAt >= thirtyDaysAgo,
    );

    // Check for existing reviews by bookingId
    const pending: Array<{
      booking: Doc<"bookings">;
      doctorName: string;
      clinicName: string;
    }> = [];

    for (const booking of recentCompleted) {
      const existingReview = await ctx.db
        .query("reviews")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", booking._id))
        .first();

      if (existingReview) continue; // Already reviewed

      // Fetch doctor user and clinic names
      const [doctorDoc, clinic] = await Promise.all([
        ctx.db.get(booking.doctorId).then((d) => {
          if (!d) return null;
          return ctx.db.get(d.userId);
        }),
        ctx.db.get(booking.clinicId),
      ]);

      pending.push({
        booking,
        doctorName: doctorDoc?.name ?? doctorDoc?.fullNameFr ?? "Medecin",
        clinicName: clinic?.name ?? "Clinique",
      });
    }

    return pending.map((p) => ({
      bookingId: p.booking._id,
      appointmentDate: p.booking.appointmentDate,
      appointmentTime: p.booking.appointmentTime,
      appointmentDuration: p.booking.appointmentDuration,
      visitType: p.booking.visitType,
      doctorId: p.booking.doctorId,
      doctorName: p.doctorName,
      clinicId: p.booking.clinicId,
      clinicName: p.clinicName,
      completedAt: p.booking.completedAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Creates a review for a completed booking. Validates that:
 * - The booking exists and has status "completed".
 * - The booking belongs to the current patient.
 * - No review already exists for this bookingId.
 *
 * After inserting the review, recalculates the doctor's average rating via
 * the internal updateDoctorRating mutation.
 */
export const create = mutation({
  args: {
    bookingId: v.id("bookings"),
    overallRating: v.number(),
    punctualityRating: v.number(),
    diagnosisRating: v.number(),
    professionalismRating: v.number(),
    cleanlinessRating: v.number(),
    comment: v.optional(v.string()),
    isAnonymous: v.boolean(),
  },
  returns: v.id("reviews"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["patient"]);

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!patient) throw new Error("Patient profile not found");

    // Validate the booking
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "completed") {
      throw new Error("Can only review completed appointments");
    }
    if (booking.patientId !== patient._id) {
      throw new Error("This booking does not belong to you");
    }

    // Check no duplicate review
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .first();
    if (existing) {
      throw new Error("You have already reviewed this appointment");
    }

    for (const rating of [
      args.overallRating,
      args.punctualityRating,
      args.diagnosisRating,
      args.professionalismRating,
      args.cleanlinessRating,
    ]) {
      assertValidRating(rating);
    }

    const reviewId = await ctx.db.insert("reviews", {
      bookingId: args.bookingId,
      patientId: patient._id,
      doctorId: booking.doctorId,
      overallRating: args.overallRating,
      punctualityRating: args.punctualityRating,
      diagnosisRating: args.diagnosisRating,
      professionalismRating: args.professionalismRating,
      cleanlinessRating: args.cleanlinessRating,
      comment: args.comment,
      isAnonymous: args.isAnonymous,
      isHidden: false,
    });

    // Recalculate doctor's rating
    await ctx.runMutation(internal.reviews.updateDoctorRating, { doctorId: booking.doctorId });

    return reviewId;
  },
});

/**
 * Doctor replies to a review. The reply is stored in the `doctorReply` field.
 * A doctor can only reply once — if `doctorReply` is already set, this
 * mutation throws.
 *
 * The caller must be the doctor who was reviewed.
 */
export const reply = mutation({
  args: {
    reviewId: v.id("reviews"),
    reply: v.string(),
  },
  returns: v.id("reviews"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);

    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new Error("Review not found");

    if (review.doctorReply !== undefined) {
      throw new Error("You have already replied to this review");
    }

    // Verify this doctor is the one being reviewed
    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!doctor || doctor._id !== review.doctorId) {
      throw new Error("You can only reply to reviews about yourself");
    }

    await ctx.db.patch(args.reviewId, { doctorReply: args.reply });
    return args.reviewId;
  },
});

/**
 * Updates the numeric ratings and/or comment on a review.
 * Only the patient who wrote the review may update it, and only within 48
 * hours of creation.
 *
 * After updating, the doctor's average rating is recalculated.
 */
export const update = mutation({
  args: {
    reviewId: v.id("reviews"),
    overallRating: v.optional(v.number()),
    punctualityRating: v.optional(v.number()),
    diagnosisRating: v.optional(v.number()),
    professionalismRating: v.optional(v.number()),
    cleanlinessRating: v.optional(v.number()),
    comment: v.optional(v.string()),
  },
  returns: v.id("reviews"),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) throw new Error("Review not found");

    // Verify ownership
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!patient || review.patientId !== patient._id) {
      throw new Error("You can only update your own reviews");
    }

    // 48-hour edit window
    const fortyEightHours = 48 * 60 * 60 * 1000;
    if (Date.now() - review._creationTime > fortyEightHours) {
      throw new Error("Reviews can only be edited within 48 hours of posting");
    }

    const patches: Partial<Doc<"reviews">> = {};
    if (args.overallRating !== undefined) {
      assertValidRating(args.overallRating);
      patches.overallRating = args.overallRating;
    }
    if (args.punctualityRating !== undefined) {
      assertValidRating(args.punctualityRating);
      patches.punctualityRating = args.punctualityRating;
    }
    if (args.diagnosisRating !== undefined) {
      assertValidRating(args.diagnosisRating);
      patches.diagnosisRating = args.diagnosisRating;
    }
    if (args.professionalismRating !== undefined) {
      assertValidRating(args.professionalismRating);
      patches.professionalismRating = args.professionalismRating;
    }
    if (args.cleanlinessRating !== undefined) {
      assertValidRating(args.cleanlinessRating);
      patches.cleanlinessRating = args.cleanlinessRating;
    }
    if (args.comment !== undefined) patches.comment = args.comment;

    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(args.reviewId, patches);
    }

    // Recalculate doctor's rating after rating changes
    await ctx.runMutation(internal.reviews.updateDoctorRating, { doctorId: review.doctorId });

    return args.reviewId;
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/**
 * Recalculates a doctor's average rating and total review count from all
 * non-hidden reviews, then updates the doctor document.
 */
export const updateDoctorRating = internalMutation({
  args: { doctorId: v.id("doctors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_doctorId_and_isHidden", (q) =>
        q.eq("doctorId", args.doctorId).eq("isHidden", false),
      )
      .collect();

    const validReviews = reviews.filter(hasValidRatingValues);
    const totalReviews = validReviews.length;
    let avgRating = 0;

    if (totalReviews > 0) {
      const sum = validReviews.reduce((s, r) => s + r.overallRating, 0);
      avgRating = Math.round((sum / totalReviews) * 10) / 10;
    }

    await ctx.db.patch(args.doctorId, {
      avgRating,
      totalReviews,
    });

    return null;
  },
});
