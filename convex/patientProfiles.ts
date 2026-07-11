import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

export const listMy = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    await getAuthedUser(ctx);
    return [];
  },
});

export const create = mutation({
  args: {
    fullName: v.optional(v.string()),
    fullNameAr: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    bloodType: v.optional(v.string()),
    chronicDiseases: v.optional(v.array(v.string())),
    allergies: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async () => {
    throw new ConvexError('Family profiles are not part of this MVP');
  },
});
