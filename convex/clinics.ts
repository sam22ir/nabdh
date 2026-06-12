import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireRole } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const clinicFields = {
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
} as const;

const clinicWithLocationFields = {
  ...clinicFields,
  wilayaNameAr: v.string(),
  wilayaNameFr: v.string(),
  communeNameAr: v.string(),
  communeNameFr: v.string(),
} as const;

function assertLatitude(latitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be a finite number between -90 and 90");
  }
}

function assertLongitude(longitude: number) {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be a finite number between -180 and 180");
  }
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Returns all active clinics for a given doctor. Public — callable by anyone
 * with the doctor's ID.
 *
 * Filters active clinics in memory — the result set per doctor is small
 * enough that a compound index on (doctorId, isActive) would not materially
 * improve performance.
 */
export const listByDoctor = query({
  args: { doctorId: v.id("doctors") },
  returns: v.array(v.object(clinicFields)),
  handler: async (ctx, args) => {
    const clinics = await ctx.db
      .query("clinics")
      .withIndex("by_doctorId", (q) => q.eq("doctorId", args.doctorId))
      .collect();
    return clinics.filter((c) => c.isActive);
  },
});

/**
 * Returns a single clinic with its wilaya and commune names resolved.
 *
 * Returns `null` when the clinicId does not exist.
 */
export const getById = query({
  args: { clinicId: v.id("clinics") },
  returns: v.union(v.null(), v.object(clinicWithLocationFields)),
  handler: async (ctx, args) => {
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) return null;

    const [wilaya, commune] = await Promise.all([
      ctx.db.get(clinic.wilayaId),
      ctx.db.get(clinic.communeId),
    ]);

    return {
      ...clinic,
      wilayaNameAr: wilaya?.nameAr ?? "",
      wilayaNameFr: wilaya?.nameFr ?? "",
      communeNameAr: commune?.nameAr ?? "",
      communeNameFr: commune?.nameFr ?? "",
    };
  },
});

/**
 * Returns all clinics owned by the currently authenticated doctor.
 */
export const getMyClinics = query({
  args: {},
  returns: v.array(v.object(clinicFields)),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["doctor"]);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!doctor) return [];

    return await ctx.db
      .query("clinics")
      .withIndex("by_doctorId", (q) => q.eq("doctorId", doctor._id))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Creates a new clinic for the authenticated doctor.
 *
 * The caller must have role "doctor" and a completed doctor profile.
 */
export const create = mutation({
  args: {
    name: v.string(),
    wilayaId: v.id("wilayas"),
    communeId: v.id("communes"),
    address: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    phone: v.string(),
  },
  returns: v.id("clinics"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!doctor) {
      throw new Error(
        "Doctor profile not found. Please complete your registration first.",
      );
    }

    assertLatitude(args.latitude);
    assertLongitude(args.longitude);

    return await ctx.db.insert("clinics", {
      doctorId: doctor._id,
      name: args.name,
      wilayaId: args.wilayaId,
      communeId: args.communeId,
      address: args.address,
      latitude: args.latitude,
      longitude: args.longitude,
      phone: args.phone,
      isActive: true,
    });
  },
});

/**
 * Updates an existing clinic. Only the authenticated doctor who owns the
 * clinic may update it.
 *
 * Only fields explicitly provided will be changed. Omit a key to leave it
 * unchanged.
 */
export const update = mutation({
  args: {
    clinicId: v.id("clinics"),
    name: v.optional(v.string()),
    wilayaId: v.optional(v.id("wilayas")),
    communeId: v.optional(v.id("communes")),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    phone: v.optional(v.string()),
  },
  returns: v.id("clinics"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);

    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) {
      throw new Error("Clinic not found");
    }

    // Verify the authenticated doctor owns this clinic
    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!doctor || clinic.doctorId !== doctor._id) {
      throw new Error("You do not own this clinic");
    }

    const patches: Partial<Doc<"clinics">> = {};
    if (args.name !== undefined) patches.name = args.name;
    if (args.wilayaId !== undefined) patches.wilayaId = args.wilayaId;
    if (args.communeId !== undefined) patches.communeId = args.communeId;
    if (args.address !== undefined) patches.address = args.address;
    if (args.latitude !== undefined) {
      assertLatitude(args.latitude);
      patches.latitude = args.latitude;
    }
    if (args.longitude !== undefined) {
      assertLongitude(args.longitude);
      patches.longitude = args.longitude;
    }
    if (args.phone !== undefined) patches.phone = args.phone;

    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(args.clinicId, patches);
    }

    return args.clinicId;
  },
});

/**
 * Soft-deletes a clinic by setting `isActive` to `false`.
 *
 * Only the authenticated doctor who owns the clinic may delete it. The
 * document remains in the database for audit / reactivation purposes.
 */
export const delete_ = mutation({
  args: { clinicId: v.id("clinics") },
  returns: v.id("clinics"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);

    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) {
      throw new Error("Clinic not found");
    }

    // Verify the authenticated doctor owns this clinic
    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!doctor || clinic.doctorId !== doctor._id) {
      throw new Error("You do not own this clinic");
    }

    await ctx.db.patch(args.clinicId, { isActive: false });
    return args.clinicId;
  },
});
