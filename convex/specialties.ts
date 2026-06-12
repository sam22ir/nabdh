import { v } from "convex/values";
import { query } from "./_generated/server";

const specialtyFields = {
  _id: v.id("specialties"),
  _creationTime: v.number(),
  nameAr: v.string(),
  nameFr: v.string(),
  icon: v.string(),
  parentId: v.optional(v.id("specialties")),
} as const;

export const list = query({
  args: {},
  returns: v.array(v.object(specialtyFields)),
  handler: async (ctx) => {
    const specialties = await ctx.db.query("specialties").take(100);
    return specialties.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
  },
});
