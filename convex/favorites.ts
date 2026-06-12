import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./lib/auth";

// ---------------------------------------------------------------------------
// Toggle-favorite logic lives in doctors.ts
//   import { toggleFavorite } from "./doctors";
// That mutation is public and handles the full toggle (add / remove) for the
// current patient.  This file only exposes read-side queries.
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

const favoriteDoctorValidator = v.object({
  ...doctorFields,
  user: v.object({
    fullNameAr: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
  }),
  specialty: v.object({
    nameAr: v.string(),
    nameFr: v.string(),
  }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FavoriteDoctor = any;

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Lists every doctor the current patient has favorited, enriched with user
 * profile and specialty data.
 *
 * Requires the "patient" role.  Returns an empty array when the patient has
 * no favourites or when the patient profile has not been created yet.
 */
export const listMy = query({
  args: {},
  returns: v.array(favoriteDoctorValidator),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!patient) {
      return [];
    }

    const favorites = await ctx.db
      .query("patientFavorites")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .order("desc")
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
