import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getAuthedUserId } from "./lib/auth";

// ---------------------------------------------------------------------------
// Shared return-shape helpers (used by both `me` and `getProfile`).
// Keeping these at module scope avoids duplicating field lists across every
// function that returns user + profile data.
// ---------------------------------------------------------------------------

const userFields = {
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  image: v.optional(v.string()),
  fullNameAr: v.optional(v.string()),
  fullNameFr: v.optional(v.string()),
  role: v.optional(
    v.union(
      v.literal("patient"),
      v.literal("doctor"),
      v.literal("clinic_admin"),
      v.literal("super_admin"),
    ),
  ),
  wilayaId: v.optional(v.id("wilayas")),
  avatarUrl: v.optional(v.string()),
  isActive: v.optional(v.boolean()),
} as const;

const patientProfileFields = {
  _id: v.id("patients"),
  _creationTime: v.number(),
  userId: v.id("users"),
  dateOfBirth: v.string(),
  gender: v.union(v.literal("male"), v.literal("female")),
  communeId: v.id("communes"),
  bloodType: v.optional(
    v.union(
      v.literal("A+"),
      v.literal("A-"),
      v.literal("B+"),
      v.literal("B-"),
      v.literal("AB+"),
      v.literal("AB-"),
      v.literal("O+"),
      v.literal("O-"),
    ),
  ),
  chronicDiseases: v.array(v.string()),
  allergies: v.array(v.string()),
  emergencyContactName: v.optional(v.string()),
  emergencyContactPhone: v.optional(v.string()),
} as const;

const doctorProfileFields = {
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

/**
 * Helper: fetch the patient record for a given userId.
 */
async function getPatientProfile(ctx: any, userId: string) {
  return await ctx.db
    .query("patients")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
}

/**
 * Helper: fetch the doctor record for a given userId.
 */
async function getDoctorProfile(ctx: any, userId: string) {
  return await ctx.db
    .query("doctors")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Returns the currently authenticated user with their patient or doctor
 * profile joined under the `profile` key.
 *
 * Returns `null` when the caller is not logged in — safe to use without
 * guarding on the client side.
 */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      ...userFields,
      profile: v.union(v.null(), v.object(patientProfileFields), v.object(doctorProfileFields)),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    let profile: any = null;
    if (user.role === "patient") {
      profile = await getPatientProfile(ctx, userId);
    } else if (user.role === "doctor") {
      profile = await getDoctorProfile(ctx, userId);
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      fullNameAr: user.fullNameAr,
      fullNameFr: user.fullNameFr,
      role: user.role,
      wilayaId: user.wilayaId,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      profile,
    };
  },
});

/**
 * Public profile lookup. Returns the user and their joined profile for
 * a given userId.
 *
 * Returns `null` when the userId does not exist.
 */
export const getProfile = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      ...userFields,
      profile: v.union(v.null(), v.object(patientProfileFields), v.object(doctorProfileFields)),
    }),
  ),
  handler: async (ctx, args) => {
    const callerId = await getAuthedUserId(ctx);
    const caller = await ctx.db.get(callerId);
    if (callerId !== args.userId && caller?.role !== "super_admin") {
      throw new ConvexError("Access denied. You can only read your own profile.");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    let profile: any = null;
    if (user.role === "patient") {
      profile = await getPatientProfile(ctx, args.userId);
    } else if (user.role === "doctor") {
      profile = await getDoctorProfile(ctx, args.userId);
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      fullNameAr: user.fullNameAr,
      fullNameFr: user.fullNameFr,
      role: user.role,
      wilayaId: user.wilayaId,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      profile,
    };
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Completes the signup flow by setting the user's full name, role, wilaya,
 * and role-specific profile data.
 *
 * The caller must already have an authenticated session (created by
 * Convex Auth at sign-in). This mutation:
 *   1. Looks up the user by their session tokenIdentifier.
 *   2. Patches the user document with the provided fields.
 *   3. Creates a patient or doctor record if one does not already exist.
 *
 * If the user already has a profile of a *different* role (e.g. they are
 * registered as a patient but trying to register as a doctor), the mutation
 * throws — change the existing role through the admin flow instead.
 *
 * @returns The user's document _id.
 */
export const register = mutation({
  args: {
    fullNameAr: v.string(),
    role: v.union(v.literal("patient"), v.literal("doctor")),
    wilayaId: v.id("wilayas"),

    // Patient-specific — required when role === "patient"
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    communeId: v.optional(v.id("communes")),

    // Doctor-specific — required when role === "doctor"
    specialtyId: v.optional(v.id("specialties")),
    orderRegistrationNumber: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    if (args.role === "patient") {
      if (!args.communeId || !args.dateOfBirth || !args.gender) {
        throw new ConvexError(
          "Patient profile required: commune, birth date, and gender are required.",
        );
      }
    }

    // ---------------------------------------------------------------
    // 1. Patch the user document
    // ---------------------------------------------------------------
    await ctx.db.patch(userId, {
      fullNameAr: args.fullNameAr,
      role: args.role,
      wilayaId: args.wilayaId,
      isActive: true,
    });

    // ---------------------------------------------------------------
    // 2. Check for conflicting profiles
    // ---------------------------------------------------------------
    if (args.role === "doctor") {
      const existingPatient = await ctx.db
        .query("patients")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();
      if (existingPatient) {
        throw new Error("User is already registered as a patient. Cannot register as a doctor.");
      }
    } else {
      const existingDoctor = await ctx.db
        .query("doctors")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();
      if (existingDoctor) {
        throw new Error("User is already registered as a doctor. Cannot register as a patient.");
      }
    }

    // ---------------------------------------------------------------
    // 3. Create role-specific record when the role-specific profile data
    //    has already been collected. Basic signup can complete first.
    // ---------------------------------------------------------------
    if (args.role === "doctor") {
      if (args.specialtyId && args.orderRegistrationNumber) {
        const existingDoctor = await ctx.db
          .query("doctors")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first();

        if (!existingDoctor) {
          await ctx.db.insert("doctors", {
            userId,
            specialtyId: args.specialtyId,
            subSpecialties: [],
            bioAr: "",
            bioFr: "",
            yearsOfExperience: 0,
            languages: [],
            orderRegistrationNumber: args.orderRegistrationNumber,
            isVerified: false,
            isProfileComplete: false,
            consultationFee: 0,
            followUpFee: 0,
            avgRating: 0,
            totalReviews: 0,
          });
        }
      }
    } else {
      const existingPatient = await ctx.db
        .query("patients")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      if (!existingPatient) {
        await ctx.db.insert("patients", {
          userId,
          dateOfBirth: args.dateOfBirth!,
          gender: args.gender!,
          communeId: args.communeId!,
          chronicDiseases: [],
          allergies: [],
        });
      }
    }

    return userId;
  },
});

/**
 * Updates the authenticated user's profile fields.
 *
 * Only the fields that are explicitly provided will be changed. Pass
 * `undefined` (omit the key) to leave a field unchanged.
 */
export const updateProfile = mutation({
  args: {
    fullNameAr: v.optional(v.string()),
    fullNameFr: v.optional(v.string()),
    phone: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    wilayaId: v.optional(v.id("wilayas")),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    const patches: Record<string, unknown> = {};
    if (args.fullNameAr !== undefined) patches.fullNameAr = args.fullNameAr;
    if (args.fullNameFr !== undefined) patches.fullNameFr = args.fullNameFr;
    if (args.phone !== undefined) patches.phone = args.phone;
    if (args.avatarUrl !== undefined) patches.avatarUrl = args.avatarUrl;
    if (args.wilayaId !== undefined) patches.wilayaId = args.wilayaId;

    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(userId, patches);
    }

    return userId;
  },
});

/**
 * Soft-deletes the authenticated user's account by setting `isActive` to
 * `false`. The user document and any associated records remain in the
 * database for audit / reactivation purposes.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const userId = await getAuthedUserId(ctx);
    await ctx.db.patch(userId, { isActive: false });
    return userId;
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (callable from other Convex functions, not the client)
// ---------------------------------------------------------------------------

/**
 * Sets a user's role. Intended for use by super_admin operations where
 * role escalation or correction is needed.
 */
export const setUserRole = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("patient"),
      v.literal("doctor"),
      v.literal("clinic_admin"),
      v.literal("super_admin"),
    ),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
    return args.userId;
  },
});
