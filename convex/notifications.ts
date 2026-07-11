import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

const ALGERIA_OFFSET_MS = 60 * 60 * 1000;

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayString() {
  return formatDateOnly(new Date(Date.now() + ALGERIA_OFFSET_MS));
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    return await ctx.db
      .query('notifications')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .take(50);
  },
});

export const markRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    await getAuthedUser(ctx);
    await ctx.db.patch(args.notificationId, { isRead: true });
    return { ok: true };
  },
});

export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal('android'), v.literal('ios')),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_userId_and_token', (q) =>
        q.eq('userId', user._id).eq('token', args.token),
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert('pushTokens', {
      userId: user._id,
      token: args.token,
      platform: args.platform,
    });
  },
});

export const unregisterPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_userId_and_token', (q) =>
        q.eq('userId', user._id).eq('token', args.token),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

export const getForDelivery = internalQuery({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.notificationId);
  },
});

export const listPushTokensForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pushTokens')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .take(100);
  },
});

export const createForUser = internalMutation({
  args: {
    userId: v.id('users'),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      isRead: false,
    });

    await ctx.scheduler.runAfter(0, internal.pushDelivery.deliverNotification, {
      notificationId,
    });

    return notificationId;
  },
});

export const sendDailySummaries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const doctors = await ctx.db.query('doctors').take(200);
    const appointmentDate = todayString();
    let created = 0;

    for (const doctor of doctors) {
      const legacyClinic = await ctx.db
        .query('clinics')
        .withIndex('by_doctorId', (q) => q.eq('doctorId', doctor._id))
        .unique();
      const membership = await ctx.db
        .query('clinicMemberships')
        .withIndex('by_doctorId_and_status', (q) =>
          q.eq('doctorId', doctor._id).eq('status', 'accepted'),
        )
        .unique();
      const clinicId = legacyClinic?._id ?? membership?.clinicId;
      if (!clinicId) continue;

      const settings = await ctx.runQuery(internal.clinicSettings.getForUser, {
        userId: doctor.userId,
        clinicId,
      });
      if (!settings.dailySummary) continue;

      const todaysBookings = await ctx.db
        .query('bookings')
        .withIndex('by_doctorId_and_appointmentDate', (q) =>
          q.eq('doctorId', doctor._id).eq('appointmentDate', appointmentDate),
        )
        .take(200);

      if (todaysBookings.length === 0) continue;

      const confirmedCount = todaysBookings.filter(
        (booking) => booking.status === 'confirmed',
      ).length;

      await ctx.runMutation(internal.notifications.createForUser, {
        userId: doctor.userId,
        type: 'daily_summary',
        title: 'ملخص اليوم',
        body: `لديك ${todaysBookings.length} موعداً اليوم، منها ${confirmedCount} في الانتظار.`,
        data: {
          clinicId,
          appointmentDate,
          total: todaysBookings.length,
          confirmed: confirmedCount,
        },
      });
      created += 1;
    }

    return { created };
  },
});

export const deleteOld = internalMutation({
  args: { days: v.number() },
  handler: async () => {
    return { deleted: 0 };
  },
});
