import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type AuthCtx = QueryCtx | MutationCtx;

export async function getOptionalAuthedUser(
  ctx: AuthCtx,
): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
}

export async function getAuthedUser(ctx: AuthCtx): Promise<Doc<'users'>> {
  const user = await getOptionalAuthedUser(ctx);
  if (!user) {
    throw new ConvexError('Authentication required');
  }
  return user;
}

export async function getAuthedUserId(ctx: AuthCtx): Promise<Id<'users'>> {
  return (await getAuthedUser(ctx))._id;
}

export async function requireRole(
  ctx: AuthCtx,
  allowedRoles: Array<Doc<'users'>['role']>,
): Promise<Doc<'users'>> {
  const user = await getAuthedUser(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new ConvexError('Access denied');
  }
  return user;
}

export async function getUserRole(
  ctx: AuthCtx,
): Promise<Doc<'users'>['role'] | undefined> {
  const user = await getOptionalAuthedUser(ctx);
  return user?.role;
}
