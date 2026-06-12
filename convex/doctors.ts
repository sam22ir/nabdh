import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getAuthedUserId, requireRole } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Shared validator fragments
// ---------------------------------------------------------------------------

const doctorFields = {
  _id: v.id("doctors"),
  _creationTime: v.number(),
  userId: v.id("users"),
  specialtyId: v.id("specialties"),
  subSpecialties: v.array(v.id("specialties")),
  bioAr: v.string(),
  bioFr: v.string(),
  yearsOfExperience: v.number(),
  languages: v.array(v.string()),
  orderRegistrationNumber: v.string(),
  isVerified: v.boolean(),
  isProfileComplete: v.boolean(),
  consultationFee: v.number(),
  followUpFee: v.number(),
  avgRating: v.number(),
  totalReviews: v.number(),
} as const;

const userProfileValidator = v.object({
  fullNameAr: v.union(v.string(), v.null()),
  phone: v.union(v.string(), v.null()),
});

const specialtyInfoValidator = v.object({
  nameAr: v.string(),
  nameFr: v.string(),
});

const userDetailValidator = v.object({
  fullNameAr: v.union(v.string(), v.null()),
  phone: v.union(v.string(), v.null()),
  fullNameFr: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  image: v.union(v.string(), v.null()),
});

const clinicInfoValidator = v.object({
  _id: v.id("clinics"),
  _creationTime: v.number(),
  doctorId: v.id("doctors"),
  name: v.string(),
  wilayaId: v.id("wilayas"),
  communeId: v.id("communes"),
  address: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  phone: v.string(),
  isActive: v.boolean(),
});

const doctorCardValidator = v.object({
  ...doctorFields,
  user: userProfileValidator,
  specialty: specialtyInfoValidator,
});

const doctorDetailValidator = v.object({
  ...doctorFields,
  user: userDetailValidator,
  specialty: specialtyInfoValidator,
  clinics: v.array(clinicInfoValidator),
});

const paginatedResponseValidator = v.object({
  page: v.array(doctorCardValidator),
  continueCursor: v.string(),
  isDone: v.boolean(),
});

const toggleFavoriteResultValidator = v.object({
  ok: v.boolean(),
  isFavorite: v.boolean(),
  error: v.union(v.literal("patient_profile_missing"), v.null()),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function enrichDoctorPage(
  ctx: any,
  page: any[],
): Promise<any[]> {
  return await Promise.all(
    page.map(async (doc) => {
      const [user, specialty] = await Promise.all([
        ctx.db.get(doc.userId),
        ctx.db.get(doc.specialtyId),
      ]);
      return {
        ...doc,
        user: {
          fullNameAr: user?.fullNameAr ?? null,
          phone: user?.phone ?? null,
        },
        specialty: {
          nameAr: specialty?.nameAr ?? "",
          nameFr: specialty?.nameFr ?? "",
        },
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Paginated listing of verified doctors sorted by avgRating descending.
 *
 * Optional filters:
 *   specialtyId  — only doctors of the given specialty (index-level)
 *   wilayaId     — only doctors who have at least one active clinic in the
 *                  given wilaya (pre-fetches clinic doctorIds)
 *   gender       — placeholder; requires a `gender` field on the `users`
 *                  table (not yet in the schema)
 *   language     — case-insensitive match on the doctor's languages array
 *
 * Because no compound index on (isVerified, avgRating) exists yet, all
 * verified doctors are collected in memory, sorted, and paginated manually.
 * Safe for tens of thousands of records.  For larger datasets add a
 * `by_verified_and_rating` index.
 */
export const listPublic = query({
  args: {
    paginationOpts: paginationOptsValidator,
    specialtyId: v.optional(v.id("specialties")),
    wilayaId: v.optional(v.id("wilayas")),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    language: v.optional(v.string()),
  },
  returns: paginatedResponseValidator,
  handler: async (ctx, args) => {
    const allDoctors = await ctx.db
      .query("doctors")
      .withIndex("by_verified", (q) => q.eq("isVerified", true))
      .collect();

    let filtered = allDoctors;

    // Filter by specialty
    if (args.specialtyId) {
      filtered = filtered.filter((d) => d.specialtyId === args.specialtyId);
    }

    // Filter by wilaya — query clinics to find doctors practising there
    if (args.wilayaId) {
      const clinics = await ctx.db
        .query("clinics")
        .withIndex("by_wilaya", (q: any) => q.eq("wilayaId", args.wilayaId!))
        .collect();
      const doctorIdsInWilaya = new Set(clinics.map((c) => c.doctorId));
      filtered = filtered.filter((d) => doctorIdsInWilaya.has(d._id));
    }

    // Filter by language (case-insensitive exact match)
    if (args.language) {
      const lang = args.language.toLowerCase();
      filtered = filtered.filter((d) =>
        d.languages.some((l) => l.toLowerCase() === lang),
      );
    }

    // Gender filter — not yet implemented.  The `users` table and `doctors`
    // table do not currently store a gender field.  Once one of them does,
    // use a compound index or a pre-filter here.

    // Sort by avgRating descending
    filtered.sort((a, b) => b.avgRating - a.avgRating);

    // Manual pagination with numeric-offset cursor
    const { numItems } = args.paginationOpts;
    const cursorStr = args.paginationOpts.cursor ?? "";
    const start = cursorStr ? parseInt(cursorStr, 10) : 0;
    if (isNaN(start) || start < 0 || start >= filtered.length) {
      return { page: [], continueCursor: "", isDone: true };
    }

    const page = filtered.slice(start, start + numItems);
    const nextCursor = String(start + numItems);
    const isDone = start + numItems >= filtered.length;

    const enriched = await enrichDoctorPage(ctx, page);

    return { page: enriched, continueCursor: nextCursor, isDone };
  },
});

/**
 * Searches verified doctors by name and specialty.
 *
 * Uses `searchIndex` on the `specialties` table (nameAr / nameFr) to find
 * matching specialties, then returns doctors belonging to those specialties.
 * Also scans the doctor's name fields (fullNameAr, fullNameFr, name) on the
 * `users` table for matches.
 *
 * For production at scale, add a `searchableText` field to the `doctors`
 * table with a `searchIndex` so that a single `withSearchIndex` call
 * replaces the current multi-step approach.
 */
export const search = query({
  args: {
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedResponseValidator,
  handler: async (ctx, args) => {
    const q = args.query.trim();
    if (!q) {
      return { page: [], continueCursor: "", isDone: true };
    }

    // -----------------------------------------------------------------------
    // Step 1 — search specialties via searchIndex
    // -----------------------------------------------------------------------
    const [specsFr, specsAr] = await Promise.all([
      ctx.db
        .query("specialties")
        .withSearchIndex("search_nameFr", (sq) =>
          sq.search("nameFr", q),
        )
        .take(30),
      ctx.db
        .query("specialties")
        .withSearchIndex("search_nameAr", (sq) =>
          sq.search("nameAr", q),
        )
        .take(30),
    ]);

    const matchingSpecIds = new Set<Id<"specialties">>();
    for (const s of specsFr) matchingSpecIds.add(s._id);
    for (const s of specsAr) matchingSpecIds.add(s._id);

    // -----------------------------------------------------------------------
    // Step 2 — load all verified doctors
    // -----------------------------------------------------------------------
    const allDoctors = await ctx.db
      .query("doctors")
      .withIndex("by_verified", (q) => q.eq("isVerified", true))
      .collect();

    // -----------------------------------------------------------------------
    // Step 3 — filter by matching specialty
    // -----------------------------------------------------------------------
    const matchedSet = new Set<Id<"doctors">>();
    for (const d of allDoctors) {
      if (
        matchingSpecIds.has(d.specialtyId) ||
        d.subSpecialties.some((s) => matchingSpecIds.has(s))
      ) {
        matchedSet.add(d._id);
      }
    }

    // -----------------------------------------------------------------------
    // Step 4 — also match by doctor name (look up users)
    // -----------------------------------------------------------------------
    const unmatched = allDoctors.filter((d) => !matchedSet.has(d._id));
    if (unmatched.length > 0) {
      const userIds = [...new Set(unmatched.map((d) => d.userId))];
      const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
      const userMap = new Map(
        users.filter(Boolean).map((u) => [u!._id, u!]),
      );
      const qLower = q.toLowerCase();
      for (const d of unmatched) {
        const u = userMap.get(d.userId);
        if (!u) continue;
        const searchText = [u.name, u.fullNameAr, u.fullNameFr]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (searchText.includes(qLower)) {
          matchedSet.add(d._id);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 5 — sort and paginate
    // -----------------------------------------------------------------------
    const matched = allDoctors
      .filter((d) => matchedSet.has(d._id))
      .sort((a, b) => b.avgRating - a.avgRating);

    const { numItems } = args.paginationOpts;
    const cursorStr = args.paginationOpts.cursor ?? "";
    const start = cursorStr ? parseInt(cursorStr, 10) : 0;
    if (isNaN(start) || start < 0 || start >= matched.length) {
      return { page: [], continueCursor: "", isDone: true };
    }

    const page = matched.slice(start, start + numItems);
    const nextCursor = String(start + numItems);
    const isDone = start + numItems >= matched.length;

    const enriched = await enrichDoctorPage(ctx, page);

    return { page: enriched, continueCursor: nextCursor, isDone };
  },
});

/**
 * Returns a single doctor with full user profile, specialty data, and all
 * clinics.  Returns null when the doctor ID does not exist.
 */
export const getById = query({
  args: { doctorId: v.id("doctors") },
  returns: v.union(doctorDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) return null;

    const [user, specialty, clinics] = await Promise.all([
      ctx.db.get(doctor.userId),
      ctx.db.get(doctor.specialtyId),
      ctx.db
        .query("clinics")
        .withIndex("by_doctorId", (q) => q.eq("doctorId", doctor._id))
        .collect(),
    ]);

    if (!user || !specialty) return null;

    return {
      ...doctor,
      user: {
        fullNameAr: user.fullNameAr ?? null,
        phone: user.phone ?? null,
        fullNameFr: user.fullNameFr ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
      },
      specialty: {
        nameAr: specialty.nameAr,
        nameFr: specialty.nameFr,
      },
      clinics,
    };
  },
});

/**
 * Returns the authenticated doctor's full profile, including user data,
 * specialty info, and all clinics.
 */
export const getMyProfile = query({
  args: {},
  returns: v.union(doctorDetailValidator, v.null()),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["doctor"]);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!doctor) return null;

    const [specialty, clinics] = await Promise.all([
      ctx.db.get(doctor.specialtyId),
      ctx.db
        .query("clinics")
        .withIndex("by_doctorId", (q) => q.eq("doctorId", doctor._id))
        .collect(),
    ]);

    return {
      ...doctor,
      user: {
        fullNameAr: user.fullNameAr ?? null,
        phone: user.phone ?? null,
        fullNameFr: user.fullNameFr ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
      },
      specialty: {
        nameAr: specialty?.nameAr ?? "",
        nameFr: specialty?.nameFr ?? "",
      },
      clinics,
    };
  },
});

/**
 * Returns all doctors the current patient has favorited, with user profile
 * and specialty data.  Requires the "patient" role.
 */
export const getFavorites = query({
  args: {},
  returns: v.array(doctorCardValidator),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!patient) return [];

    const favorites = await ctx.db
      .query("patientFavorites")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .collect();

    const doctors = await Promise.all(
      favorites.map(async (fav) => {
        const doctor = await ctx.db.get(fav.doctorId);
        if (!doctor) return null;
        const [docUser, specialty] = await Promise.all([
          ctx.db.get(doctor.userId),
          ctx.db.get(doctor.specialtyId),
        ]);
        return {
          ...doctor,
          user: {
            fullNameAr: docUser?.fullNameAr ?? null,
            phone: docUser?.phone ?? null,
          },
          specialty: {
            nameAr: specialty?.nameAr ?? "",
            nameFr: specialty?.nameFr ?? "",
          },
        };
      }),
    );

    return doctors.filter((d): d is NonNullable<typeof d> => d !== null);
  },
});

/**
 * Returns whether the current patient has favorited a doctor.
 *
 * Public doctor pages can be viewed before auth, so this query returns false
 * instead of throwing for anonymous or non-patient callers.
 */
export const isFavorite = query({
  args: { doctorId: v.id("doctors") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const user = await ctx.db.get(userId);
    if (user?.role !== "patient") return false;

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!patient) return false;

    const favorite = await ctx.db
      .query("patientFavorites")
      .withIndex("by_patientId_and_doctorId", (q) =>
        q.eq("patientId", patient._id).eq("doctorId", args.doctorId),
      )
      .first();

    return favorite !== null;
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Updates the authenticated doctor's professional profile.
 *
 * Only fields explicitly provided are changed; omitted fields keep their
 * current values.  Requires the "doctor" role.
 */
export const updateProfile = mutation({
  args: {
    fullNameAr: v.optional(v.string()),
    fullNameFr: v.optional(v.string()),
    phone: v.optional(v.string()),
    specialtyId: v.optional(v.id("specialties")),
    subSpecialties: v.optional(v.array(v.id("specialties"))),
    bioAr: v.optional(v.string()),
    bioFr: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    orderRegistrationNumber: v.optional(v.string()),
    consultationFee: v.optional(v.number()),
    followUpFee: v.optional(v.number()),
  },
  returns: v.id("doctors"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!doctor) {
      throw new ConvexError("Doctor profile not found");
    }

    if (
      args.yearsOfExperience !== undefined &&
      (!Number.isFinite(args.yearsOfExperience) || args.yearsOfExperience < 0)
    ) {
      throw new ConvexError("Years of experience must be a finite number.");
    }
    if (
      args.consultationFee !== undefined &&
      (!Number.isFinite(args.consultationFee) || args.consultationFee < 0)
    ) {
      throw new ConvexError("Consultation fee must be a finite number.");
    }
    if (
      args.followUpFee !== undefined &&
      (!Number.isFinite(args.followUpFee) || args.followUpFee < 0)
    ) {
      throw new ConvexError("Follow-up fee must be a finite number.");
    }

    const userPatch: Record<string, unknown> = {};
    if (args.fullNameAr !== undefined) userPatch.fullNameAr = args.fullNameAr;
    if (args.fullNameFr !== undefined) userPatch.fullNameFr = args.fullNameFr;
    if (args.phone !== undefined) userPatch.phone = args.phone;

    const doctorPatch: Record<string, unknown> = {};
    if (args.specialtyId !== undefined) doctorPatch.specialtyId = args.specialtyId;
    if (args.subSpecialties !== undefined) {
      doctorPatch.subSpecialties = args.subSpecialties;
    }
    if (args.bioAr !== undefined) doctorPatch.bioAr = args.bioAr;
    if (args.bioFr !== undefined) doctorPatch.bioFr = args.bioFr;
    if (args.yearsOfExperience !== undefined) {
      doctorPatch.yearsOfExperience = args.yearsOfExperience;
    }
    if (args.languages !== undefined) doctorPatch.languages = args.languages;
    if (args.orderRegistrationNumber !== undefined) {
      doctorPatch.orderRegistrationNumber = args.orderRegistrationNumber;
    }
    if (args.consultationFee !== undefined) {
      doctorPatch.consultationFee = args.consultationFee;
    }
    if (args.followUpFee !== undefined) {
      doctorPatch.followUpFee = args.followUpFee;
    }

    if (Object.keys(userPatch).length > 0) {
      await ctx.db.patch(user._id, userPatch);
    }
    if (Object.keys(doctorPatch).length > 0) {
      await ctx.db.patch(doctor._id, doctorPatch);
    }
    return doctor._id;
  },
});

/**
 * Toggles a doctor in or out of the current patient's favorites.
 *
 * If the doctor is already favourited the record is removed and the result
 * reports `isFavorite: false`. Otherwise a new favourite record is created and
 * the result reports `isFavorite: true`. Requires the "patient" role.
 */
export const toggleFavorite = mutation({
  args: { doctorId: v.id("doctors") },
  returns: toggleFavoriteResultValidator,
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["patient"]);

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!patient) {
      return {
        ok: false,
        isFavorite: false,
        error: "patient_profile_missing" as const,
      };
    }

    const existing = await ctx.db
      .query("patientFavorites")
      .withIndex("by_patientId_and_doctorId", (q) =>
        q.eq("patientId", patient._id).eq("doctorId", args.doctorId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return {
        ok: true,
        isFavorite: false,
        error: null,
      };
    }

    await ctx.db.insert("patientFavorites", {
      patientId: patient._id,
      doctorId: args.doctorId,
    });
    return {
      ok: true,
      isFavorite: true,
      error: null,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/**
 * Recalculates a doctor's average rating and total review count from all
 * non-hidden reviews.
 *
 * Intended to be called automatically by the reviews module after a review
 * is created, updated, or its visibility toggled.  Ratings are rounded to
 * one decimal place.
 */
export const updateRating = internalMutation({
  args: { doctorId: v.id("doctors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_doctorId_and_isHidden", (q) =>
        q.eq("doctorId", args.doctorId).eq("isHidden", false),
      )
      .collect();

    const validReviews = reviews.filter(
      (review) =>
        Number.isFinite(review.overallRating) &&
        review.overallRating >= 1 &&
        review.overallRating <= 5,
    );
    const totalReviews = validReviews.length;
    let avgRating = 0;

    if (totalReviews > 0) {
      const sum = validReviews.reduce((acc, r) => acc + r.overallRating, 0);
      avgRating = Math.round((sum / totalReviews) * 10) / 10;
    }

    await ctx.db.patch(args.doctorId, {
      avgRating,
      totalReviews,
    });

    return null;
  },
});
