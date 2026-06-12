import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Context type that both QueryCtx and MutationCtx satisfy.
 * These helpers only perform reads, so a single union type works for both.
 */
type AuthCtx = QueryCtx | MutationCtx;

/**
 * Returns the authenticated user's document _id.
 *
 * Uses Convex Auth's user id mapping, then verifies that the app-level user
 * document still exists.
 */
export async function getAuthedUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }

  return userId;
}

/**
 * Returns the full authenticated user document.
 *
 * Same auth check as getAuthedUserId, but returns the entire Doc<"users">
 * instead of just the _id.
 */
export async function getAuthedUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }

  return user;
}

/**
 * Ensures the authenticated user has one of the allowed roles.
 *
 * Returns the user document on success. Throws ConvexError when:
 *   - the caller is not authenticated, or
 *   - the user's role is not in the allowedRoles array (or is undefined).
 *
 * @example
 *   // In a mutation or query handler:
 *   const user = await requireRole(ctx, ["doctor", "super_admin"]);
 */
export async function requireRole(
  ctx: AuthCtx,
  allowedRoles: string[],
): Promise<Doc<"users">> {
  const user = await getAuthedUser(ctx);

  if (!user.role || !allowedRoles.includes(user.role)) {
    throw new ConvexError(
      `Access denied. Required role(s): ${allowedRoles.join(", ")}, but got: ${user.role ?? "none"}`,
    );
  }

  return user;
}

/**
 * Returns the authenticated user's role string, or undefined if the user
 * is not authenticated or has no role set yet.
 *
 * Unlike getAuthedUserId / getAuthedUser this does NOT throw on
 * unauthenticated callers — it is safe to use in query functions that
 * should work for both anonymous and logged-in users.
 */
export async function getUserRole(
  ctx: AuthCtx,
): Promise<string | undefined> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return undefined;

  const user = await ctx.db.get(userId);
  return user?.role;
}
