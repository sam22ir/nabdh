import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/auth";

const patientProfileFields = {
  _id: v.id("patientProfiles"),
  _creationTime: v.number(),
  parentUserId: v.id("users"),
  fullNameAr: v.string(),
  dateOfBirth: v.string(),
  gender: v.union(v.literal("male"), v.literal("female")),
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
} as const;

export const listMy = query({
  args: {},
  returns: v.array(v.object(patientProfileFields)),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);

    return await ctx.db
      .query("patientProfiles")
      .withIndex("by_parentUserId", (q) => q.eq("parentUserId", user._id))
      .collect();
  },
});

export const create = mutation({
  args: {
    fullNameAr: v.string(),
    dateOfBirth: v.string(),
    gender: v.union(v.literal("male"), v.literal("female")),
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
  },
  returns: v.id("patientProfiles"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["patient"]);

    return await ctx.db.insert("patientProfiles", {
      parentUserId: user._id,
      fullNameAr: args.fullNameAr.trim(),
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      bloodType: args.bloodType,
      chronicDiseases: args.chronicDiseases,
      allergies: args.allergies,
    });
  },
});
