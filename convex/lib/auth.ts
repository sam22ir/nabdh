import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Context type that both QueryCtx and MutationCtx satisfy.
 * These helpers only perform reads, so a single union type works for both.
 */
type AuthCtx = QueryCtx | MutationCtx;

async function getUserByTokenIdentifier(
  ctx: AuthCtx,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();
}

async function getLegacySubjectUser(
  ctx: AuthCtx,
  subject: string,
): Promise<Doc<"users"> | null> {
  const userId = subject.split("|")[0] as Id<"users">;
  if (!userId) return null;
  return await ctx.db.get(userId);
}

export async function getOptionalAuthedUser(
  ctx: AuthCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (user) return user;

  return await getLegacySubjectUser(ctx, identity.subject);
}

/**
 * Returns the authenticated user's document _id.
 *
 * Uses the identity tokenIdentifier as the canonical app-user mapping. The
 * subject fallback keeps existing Convex Auth development rows usable during
 * the Clerk migration.
 */
export async function getAuthedUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }

  const user = await getOptionalAuthedUser(ctx);
  if (!user) {
    throw new ConvexError("User not found");
  }

  return user._id;
}

/**
 * Returns the full authenticated user document.
 *
 * Same auth check as getAuthedUserId, but returns the entire Doc<"users">
 * instead of just the _id.
 */
export async function getAuthedUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }

  const user = await getOptionalAuthedUser(ctx);
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
  const user = await getOptionalAuthedUser(ctx);
  return user?.role;
}
