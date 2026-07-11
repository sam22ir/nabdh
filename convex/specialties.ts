import { v } from 'convex/values';
import { query } from './_generated/server';
import {
  specialtyDisplayName,
  type SpecialtyNameSource,
} from './lib/specialties';

const specialtyFields = {
  _id: v.id('specialties'),
  _creationTime: v.number(),
  name: v.string(),
  icon: v.string(),
  parentId: v.optional(v.id('specialties')),
} as const;

export const list = query({
  args: {},
  returns: v.array(v.object(specialtyFields)),
  handler: async (ctx) => {
    const specialties = await ctx.db.query('specialties').take(100);
    return specialties
      .map((specialty) => ({
        _id: specialty._id,
        _creationTime: specialty._creationTime,
        name: specialtyDisplayName(specialty as SpecialtyNameSource),
        icon: specialty.icon,
        ...(specialty.parentId ? { parentId: specialty.parentId } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
