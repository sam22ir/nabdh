/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function seedNotificationData() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "notifications@example.test",
      role: "patient",
      fullNameAr: "مريض",
      isActive: true,
    });

    await ctx.db.insert("notifications", {
      userId,
      type: "booking_confirmed",
      title: "موعد مؤكد",
      body: "تم تأكيد الموعد",
      isRead: false,
    });

    return { userId };
  });

  return { t, ids };
}

async function seedPushTokenData() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "push-user@example.test",
      role: "patient",
      fullNameAr: "مريض التنبيهات",
      isActive: true,
    });
    const otherUserId = await ctx.db.insert("users", {
      email: "push-other@example.test",
      role: "patient",
      fullNameAr: "مريض آخر",
      isActive: true,
    });
    return { userId, otherUserId };
  });

  return { t, ids };
}

function asUser(
  t: Awaited<ReturnType<typeof seedNotificationData>>["t"],
  userId: Id<"users">,
) {
  return t.withIdentity({
    subject: `${userId}|session`,
    tokenIdentifier: "password:notifications@example.test",
  });
}

describe("notifications.listMy", () => {
  test("returns paginated notifications for the current user", async () => {
    const { t, ids } = await seedNotificationData();

    const result = await asUser(t, ids.userId).query(api.notifications.listMy, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].userId).toBe(ids.userId);
  });
});

describe("push token lookup", () => {
  test("uses a compound index for user and token lookup", () => {
    const schemaSource = readFileSync(
      join(process.cwd(), "convex/schema.ts"),
      "utf8",
    );
    const notificationsSource = readFileSync(
      join(process.cwd(), "convex/notifications.ts"),
      "utf8",
    );

    expect(schemaSource).toContain("by_userId_and_token");
    expect(schemaSource).toContain("by_token");
    expect(notificationsSource).toContain('withIndex("by_userId_and_token"');
    expect(notificationsSource).toContain('withIndex("by_token"');
  });

  test("deduplicates token registration for the current user", async () => {
    const { t, ids } = await seedPushTokenData();
    const session = t.withIdentity({
      subject: `${ids.userId}|session`,
      tokenIdentifier: "password:push-user@example.test",
    });

    const first = await session.mutation(api.notifications.registerPushToken, {
      token: "ExponentPushToken[abc]",
      platform: "android",
    });
    const second = await session.mutation(api.notifications.registerPushToken, {
      token: "ExponentPushToken[abc]",
      platform: "ios",
    });

    expect(second).toBe(first);
    const tokens = await t.run(async (ctx) => {
      return await ctx.db
        .query("pushTokens")
        .withIndex("by_userId", (q) => q.eq("userId", ids.userId))
        .collect();
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      token: "ExponentPushToken[abc]",
      platform: "ios",
    });
  });

  test("unregisters only the current user's token", async () => {
    const { t, ids } = await seedPushTokenData();
    await t.run(async (ctx) => {
      await ctx.db.insert("pushTokens", {
        userId: ids.userId,
        token: "ExponentPushToken[shared]",
        platform: "android",
      });
      await ctx.db.insert("pushTokens", {
        userId: ids.otherUserId,
        token: "ExponentPushToken[shared]",
        platform: "android",
      });
    });

    await t
      .withIdentity({
        subject: `${ids.userId}|session`,
        tokenIdentifier: "password:push-user@example.test",
      })
      .mutation(api.notifications.unregisterPushToken, {
        token: "ExponentPushToken[shared]",
      });

    const tokens = await t.run(async (ctx) => {
      return await ctx.db.query("pushTokens").collect();
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].userId).toBe(ids.otherUserId);
  });

  test("moves a reused device token to the current user", async () => {
    const { t, ids } = await seedPushTokenData();
    await t.run(async (ctx) => {
      await ctx.db.insert("pushTokens", {
        userId: ids.otherUserId,
        token: "ExponentPushToken[device]",
        platform: "android",
      });
    });

    await t
      .withIdentity({
        subject: `${ids.userId}|session`,
        tokenIdentifier: "password:push-user@example.test",
      })
      .mutation(api.notifications.registerPushToken, {
        token: "ExponentPushToken[device]",
        platform: "ios",
      });

    const tokens = await t.run(async (ctx) => {
      return await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", "ExponentPushToken[device]"))
        .collect();
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      userId: ids.userId,
      platform: "ios",
    });
  });
});

describe("booking notification boundary", () => {
  test("bookings route notification creation through the internal boundary", () => {
    const bookingsSource = readFileSync(
      join(process.cwd(), "convex/bookings.ts"),
      "utf8",
    );
    const notificationsSource = readFileSync(
      join(process.cwd(), "convex/notifications.ts"),
      "utf8",
    );
    const pushDeliverySource = readFileSync(
      join(process.cwd(), "convex/pushDelivery.ts"),
      "utf8",
    );

    expect(bookingsSource).toContain("internal.notifications.create");
    expect(bookingsSource).not.toContain('ctx.db.insert("notifications"');
    expect(bookingsSource).toContain("doctorId: args.doctorId");
    expect(bookingsSource).toContain("doctorId: booking.doctorId");
    expect(bookingsSource).toContain("doctorId: oldBooking.doctorId");
    expect(notificationsSource).toContain("ctx.scheduler.runAfter");
    expect(notificationsSource).toContain(
      "internal.pushDelivery.deliverNotification",
    );
    expect(pushDeliverySource).toContain(
      "internal.doctorSettings.getForDoctorInternal",
    );
  });
});
