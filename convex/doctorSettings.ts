import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireRole } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

const SUPPORTED_MIN_CANCEL_HOURS = [1, 2, 3, 6, 12, 24, 48] as const;

const doctorSettingsFields = {
  doctorId: v.id("doctors"),
  userId: v.id("users"),
  newBookingAlerts: v.boolean(),
  cancellationAlerts: v.boolean(),
  dailySummary: v.boolean(),
  minCancelHours: v.number(),
} as const;

const doctorSettingsValidator = v.object(doctorSettingsFields);

type DoctorSettings = {
  doctorId: Id<"doctors">;
  userId: Id<"users">;
  newBookingAlerts: boolean;
  cancellationAlerts: boolean;
  dailySummary: boolean;
  minCancelHours: number;
};

type DoctorSettingsPatch = {
  newBookingAlerts?: boolean;
  cancellationAlerts?: boolean;
  dailySummary?: boolean;
  minCancelHours?: number;
};

function defaultSettings(
  doctorId: Id<"doctors">,
  userId: Id<"users">,
): DoctorSettings {
  return {
    doctorId,
    userId,
    newBookingAlerts: true,
    cancellationAlerts: true,
    dailySummary: false,
    minCancelHours: 6,
  };
}

function publicSettings(doc: Doc<"doctorSettings">): DoctorSettings {
  return {
    doctorId: doc.doctorId,
    userId: doc.userId,
    newBookingAlerts: doc.newBookingAlerts,
    cancellationAlerts: doc.cancellationAlerts,
    dailySummary: doc.dailySummary,
    minCancelHours: doc.minCancelHours,
  };
}

function validateMinCancelHours(value: number | undefined) {
  if (
    value !== undefined &&
    !SUPPORTED_MIN_CANCEL_HOURS.includes(
      value as (typeof SUPPORTED_MIN_CANCEL_HOURS)[number],
    )
  ) {
    throw new ConvexError("Unsupported cancellation hours value.");
  }
}

async function getDoctorForUser(ctx: any, userId: Id<"users">) {
  const doctor = await ctx.db
    .query("doctors")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();

  if (!doctor) {
    throw new ConvexError("Doctor profile not found.");
  }

  return doctor;
}

async function getSettingsByDoctorId(
  ctx: any,
  doctorId: Id<"doctors">,
): Promise<Doc<"doctorSettings"> | null> {
  return await ctx.db
    .query("doctorSettings")
    .withIndex("by_doctorId", (q: any) => q.eq("doctorId", doctorId))
    .unique();
}

export const getMy = query({
  args: {},
  returns: doctorSettingsValidator,
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorForUser(ctx, user._id);
    const existing = await getSettingsByDoctorId(ctx, doctor._id);

    return existing
      ? publicSettings(existing)
      : defaultSettings(doctor._id, user._id);
  },
});

export const updateMy = mutation({
  args: {
    newBookingAlerts: v.optional(v.boolean()),
    cancellationAlerts: v.optional(v.boolean()),
    dailySummary: v.optional(v.boolean()),
    minCancelHours: v.optional(v.number()),
  },
  returns: doctorSettingsValidator,
  handler: async (ctx, args) => {
    validateMinCancelHours(args.minCancelHours);

    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorForUser(ctx, user._id);
    const existing = await getSettingsByDoctorId(ctx, doctor._id);
    const now = Date.now();

    const next = {
      ...(existing ? publicSettings(existing) : defaultSettings(doctor._id, user._id)),
      ...args,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        newBookingAlerts: next.newBookingAlerts,
        cancellationAlerts: next.cancellationAlerts,
        dailySummary: next.dailySummary,
        minCancelHours: next.minCancelHours,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("doctorSettings", {
        ...next,
        updatedAt: now,
      });
    }

    return next;
  },
});

export const getForDoctorInternal = internalQuery({
  args: { doctorId: v.id("doctors") },
  returns: doctorSettingsValidator,
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) {
      throw new ConvexError("Doctor profile not found.");
    }

    const existing = await getSettingsByDoctorId(ctx, args.doctorId);
    return existing
      ? publicSettings(existing)
      : defaultSettings(args.doctorId, doctor.userId);
  },
});
