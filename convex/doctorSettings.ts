import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalQuery, mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

type DoctorSettingsRecord = {
  newBookingAlerts: boolean;
  cancellationAlerts: boolean;
  dailySummary: boolean;
};

const doctorSettingsValidator = v.object({
  newBookingAlerts: v.boolean(),
  cancellationAlerts: v.boolean(),
  dailySummary: v.boolean(),
});

export const defaultDoctorSettings: DoctorSettingsRecord = {
  newBookingAlerts: true,
  cancellationAlerts: true,
  dailySummary: false,
};

export const getForUser = internalQuery({
  args: { userId: v.id('users') },
  returns: doctorSettingsValidator,
  handler: async (ctx, args): Promise<DoctorSettingsRecord> => {
    const existing = await ctx.db
      .query('doctorSettings')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique();

    if (!existing) {
      return defaultDoctorSettings;
    }

    return {
      newBookingAlerts: existing.newBookingAlerts,
      cancellationAlerts: existing.cancellationAlerts,
      dailySummary: existing.dailySummary,
    };
  },
});

export const getMy = query({
  args: {},
  returns: doctorSettingsValidator,
  handler: async (ctx): Promise<DoctorSettingsRecord> => {
    const user = await getAuthedUser(ctx);
    return await ctx.runQuery(internal.doctorSettings.getForUser, { userId: user._id });
  },
});

export const updateMy = mutation({
  args: {
    newBookingAlerts: v.optional(v.boolean()),
    cancellationAlerts: v.optional(v.boolean()),
    dailySummary: v.optional(v.boolean()),
  },
  returns: doctorSettingsValidator,
  handler: async (ctx, args): Promise<DoctorSettingsRecord> => {
    const user = await getAuthedUser(ctx);
    const existing = await ctx.db
      .query('doctorSettings')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();
    const next = {
      ...defaultDoctorSettings,
      ...(existing
        ? {
            newBookingAlerts: existing.newBookingAlerts,
            cancellationAlerts: existing.cancellationAlerts,
            dailySummary: existing.dailySummary,
          }
        : {}),
      ...args,
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
    } else {
      await ctx.db.insert('doctorSettings', {
        userId: user._id,
        ...next,
      });
    }

    return next;
  },
});
