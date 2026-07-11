import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_EXPO_PUSH_MESSAGES = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function shouldDeliverPush(
  ctx: ActionCtx,
  notification: Doc<"notifications">,
): Promise<boolean> {
  if (!notification) return false;

  const clinicId = notification.data?.clinicId;
  if (
    (notification.type === "new_booking" ||
      notification.type === "booking_cancelled" ||
      notification.type === "daily_summary") &&
    clinicId
  ) {
    const settings = await ctx.runQuery(internal.clinicSettings.getForUser, {
      userId: notification.userId,
      clinicId,
    });

    if (notification.type === "new_booking") {
      return settings.newBookingAlerts;
    }
    if (notification.type === "booking_cancelled") {
      return settings.cancellationAlerts;
    }
    if (notification.type === "daily_summary") {
      return settings.dailySummary;
    }
  }

  return true;
}

export const deliverNotification = internalAction({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notification = await ctx.runQuery(
      internal.notifications.getForDelivery,
      { notificationId: args.notificationId },
    );
    if (!notification) return null;
    if (!(await shouldDeliverPush(ctx, notification))) return null;

    const tokens = await ctx.runQuery(
      internal.notifications.listPushTokensForUser,
      { userId: notification.userId },
    );
    if (tokens.length === 0) return null;

    const messages = tokens.map((token: Doc<"pushTokens">) => ({
      to: token.token,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      sound: "default",
    }));

    for (const batch of chunk(messages, MAX_EXPO_PUSH_MESSAGES)) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        throw new Error(`Expo push API failed with HTTP ${response.status}`);
      }
    }

    return null;
  },
});
