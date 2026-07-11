import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalQuery, mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

type ClinicSettingsRecord = {
  autoCompleteAppointments: boolean;
  newBookingAlerts: boolean;
  cancellationAlerts: boolean;
  dailySummary: boolean;
};

const clinicSettingsValidator = v.object({
  autoCompleteAppointments: v.boolean(),
  newBookingAlerts: v.boolean(),
  cancellationAlerts: v.boolean(),
  dailySummary: v.boolean(),
});

export const defaultClinicSettings: ClinicSettingsRecord = {
  autoCompleteAppointments: true,
  newBookingAlerts: true,
  cancellationAlerts: true,
  dailySummary: false,
};

async function getAuthedClinicUserAndClinic(ctx: any) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'clinic') throw new ConvexError('Clinic account required');
  const clinic = await ctx.db
    .query('clinics')
    .withIndex('by_ownerUserId', (q: any) => q.eq('ownerUserId', user._id))
    .unique();
  if (!clinic) throw new ConvexError('Clinic profile not found');
  return { user, clinic };
}

export const getForUser = internalQuery({
  args: {
    userId: v.id('users'),
    clinicId: v.optional(v.id('clinics')),
  },
  returns: clinicSettingsValidator,
  handler: async (ctx, args): Promise<ClinicSettingsRecord> => {
    const byClinic = args.clinicId
      ? await ctx.db
          .query('clinicSettings')
          .withIndex('by_clinicId', (q: any) => q.eq('clinicId', args.clinicId))
          .unique()
      : null;
    const existing =
      byClinic ??
      (await ctx.db
        .query('clinicSettings')
        .withIndex('by_userId', (q: any) => q.eq('userId', args.userId))
        .unique());

    if (!existing) {
      return defaultClinicSettings;
    }

    return {
      autoCompleteAppointments: existing.autoCompleteAppointments,
      newBookingAlerts: existing.newBookingAlerts ?? defaultClinicSettings.newBookingAlerts,
      cancellationAlerts:
        existing.cancellationAlerts ?? defaultClinicSettings.cancellationAlerts,
      dailySummary: existing.dailySummary ?? defaultClinicSettings.dailySummary,
    };
  },
});

export const getMy = query({
  args: {},
  returns: clinicSettingsValidator,
  handler: async (ctx): Promise<ClinicSettingsRecord> => {
    const { user, clinic } = await getAuthedClinicUserAndClinic(ctx);
    return await ctx.runQuery(internal.clinicSettings.getForUser, {
      userId: user._id,
      clinicId: clinic._id,
    });
  },
});

export const updateMy = mutation({
  args: {
    autoCompleteAppointments: v.optional(v.boolean()),
    newBookingAlerts: v.optional(v.boolean()),
    cancellationAlerts: v.optional(v.boolean()),
    dailySummary: v.optional(v.boolean()),
  },
  returns: clinicSettingsValidator,
  handler: async (ctx, args): Promise<ClinicSettingsRecord> => {
    const { user, clinic } = await getAuthedClinicUserAndClinic(ctx);
    const existing = await ctx.db
      .query('clinicSettings')
      .withIndex('by_clinicId', (q: any) => q.eq('clinicId', clinic._id))
      .unique();
    const next = {
      ...defaultClinicSettings,
      ...(existing
        ? {
            autoCompleteAppointments: existing.autoCompleteAppointments,
            newBookingAlerts:
              existing.newBookingAlerts ?? defaultClinicSettings.newBookingAlerts,
            cancellationAlerts:
              existing.cancellationAlerts ?? defaultClinicSettings.cancellationAlerts,
            dailySummary: existing.dailySummary ?? defaultClinicSettings.dailySummary,
          }
        : {}),
      ...args,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
    } else {
      await ctx.db.insert('clinicSettings', {
        userId: user._id,
        clinicId: clinic._id,
        ...next,
      });
    }

    return {
      autoCompleteAppointments: next.autoCompleteAppointments,
      newBookingAlerts: next.newBookingAlerts,
      cancellationAlerts: next.cancellationAlerts,
      dailySummary: next.dailySummary,
    };
  },
});
