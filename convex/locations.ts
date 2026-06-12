import { v } from "convex/values";
import { query } from "./_generated/server";

const wilayaFields = {
  _id: v.id("wilayas"),
  _creationTime: v.number(),
  id: v.number(),
  nameAr: v.string(),
  nameFr: v.string(),
} as const;

const communeFields = {
  _id: v.id("communes"),
  _creationTime: v.number(),
  wilayaId: v.id("wilayas"),
  nameAr: v.string(),
  nameFr: v.string(),
} as const;

export const listWilayas = query({
  args: {},
  returns: v.array(v.object(wilayaFields)),
  handler: async (ctx) => {
    const wilayas = await ctx.db.query("wilayas").take(100);
    return wilayas.sort((a, b) => a.id - b.id);
  },
});

export const listCommunesByWilaya = query({
  args: { wilayaId: v.id("wilayas") },
  returns: v.array(v.object(communeFields)),
  handler: async (ctx, args) => {
    const communes = await ctx.db
      .query("communes")
      .withIndex("by_wilayaId", (q) => q.eq("wilayaId", args.wilayaId))
      .take(500);

    return communes.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
  },
});
