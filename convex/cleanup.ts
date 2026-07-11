import { v } from 'convex/values';
import { mutation } from './_generated/server';

const cleanupTables = [
  'bookings',
  'reviews',
  'patientFavorites',
  'notifications',
  'pushTokens',
  'schedules',
  'scheduleExceptions',
  'clinics',
  'patients',
  'doctors',
  'users',
] as const;

export const cleanupNonReferenceData = mutation({
  args: {
    dryRun: v.boolean(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const result: Record<string, number> = {};

    for (const table of cleanupTables) {
      const rows = await ctx.db.query(table).take(args.batchSize);
      result[table] = rows.length;
      if (!args.dryRun) {
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
      }
    }

    return { dryRun: args.dryRun, tables: result };
  },
});
