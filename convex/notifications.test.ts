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
    expect(notificationsSource).toContain('withIndex("by_userId_and_token"');
  });
});
