import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { getAuthedUserId } from "./lib/auth";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const notificationFields = {
  _id: v.id("notifications"),
  _creationTime: v.number(),
  userId: v.id("users"),
  type: v.string(),
  title: v.string(),
  body: v.string(),
  data: v.optional(v.any()),
  isRead: v.boolean(),
} as const;

const paginatedNotificationsValidator = paginationResultValidator(
  v.object(notificationFields),
);

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Returns paginated notifications for the current user, newest first.
 */
export const listMy = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginatedNotificationsValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    return await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Returns the count of unread notifications for the current user.
 */
export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthedUserId(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) =>
        q.eq("userId", userId).eq("isRead", false),
      )
      .collect();

    return unread.length;
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Marks a single notification as read. The notification must belong to the
 * current user.
 */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== userId) {
      throw new Error("This notification does not belong to you");
    }

    if (!notification.isRead) {
      await ctx.db.patch(args.notificationId, { isRead: true });
    }

    return args.notificationId;
  },
});

/**
 * Marks all of the current user's unread notifications as read.
 */
export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthedUserId(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_read", (q) =>
        q.eq("userId", userId).eq("isRead", false),
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { isRead: true });
    }

    return null;
  },
});

/**
 * Registers an Expo push token for the current user. If the token is already
 * registered under a different platform, it updates the platform.
 * If the same token already exists under this user, it returns the existing
 * document ID without creating a duplicate.
 */
export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("android"), v.literal("ios")),
  },
  returns: v.id("pushTokens"),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId_and_token", (q) =>
        q.eq("userId", userId).eq("token", args.token),
      )
      .unique();

    if (existing) {
      if (existing.platform !== args.platform) {
        await ctx.db.patch(existing._id, { platform: args.platform });
      }
      return existing._id;
    }

    return await ctx.db.insert("pushTokens", {
      userId,
      token: args.token,
      platform: args.platform,
    });
  },
});

/**
 * Removes a push token registration.
 */
export const unregisterPushToken = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);

    const token = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId_and_token", (q) =>
        q.eq("userId", userId).eq("token", args.token),
      )
      .unique();

    if (token) {
      await ctx.db.delete(token._id);
    }

    return null;
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/**
 * Creates a notification for a user. This is an internal mutation intended to
 * be called from other Convex functions (e.g. after a booking is created or
 * cancelled).
 *
 * @param userId - The user to notify.
 * @param type - Notification type string (e.g. "booking_confirmed").
 * @param title - Notification title (short, for push).
 * @param body - Notification body text.
 * @param data - Optional arbitrary payload for the client.
 */
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      isRead: false,
    });
  },
});

/**
 * Deletes notifications older than a given number of days.
 * Designed to be called daily from crons.ts.
 */
export const deleteOld = internalMutation({
  args: { days: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.days * 24 * 60 * 60 * 1000;
    const all = await ctx.db.query("notifications").take(16000);

    const toDelete = all.filter((n) => n._creationTime < cutoff);

    for (const n of toDelete) {
      await ctx.db.delete(n._id);
    }

    return toDelete.length;
  },
});
