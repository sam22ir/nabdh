import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import { getAuthedUser, getAuthedUserId, getUserRole, requireRole } from "./auth";

const userId = "user_123" as never;
const user = {
  _id: userId,
  role: "patient",
};

function authCtx(overrides: { identity?: unknown; foundUser?: unknown } = {}) {
  const identity =
    "identity" in overrides
      ? overrides.identity
      : {
          subject: `${userId}|session_123`,
          tokenIdentifier: "password:renamed@example.test",
        };
  const foundUser = overrides.foundUser ?? user;

  return {
    auth: {
      getUserIdentity: vi.fn(async () => identity),
    },
    db: {
      get: vi.fn(async (id: unknown) => (id === userId ? foundUser : null)),
      query: vi.fn(() => {
        throw new Error("tokenIdentifier lookup should not be used for Convex Auth users");
      }),
    },
  };
}

describe("Convex auth helpers", () => {
  test("resolve the current Convex Auth user id from the authenticated subject", async () => {
    const ctx = authCtx();

    await expect(getAuthedUserId(ctx as never)).resolves.toBe(userId);

    expect(ctx.db.get).toHaveBeenCalledWith(userId);
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  test("return the current user document and role without tokenIdentifier lookup", async () => {
    const ctx = authCtx();

    await expect(getAuthedUser(ctx as never)).resolves.toBe(user);
    await expect(getUserRole(ctx as never)).resolves.toBe("patient");
    await expect(requireRole(ctx as never, ["patient"])).resolves.toBe(user);
  });

  test("throw for unauthenticated callers", async () => {
    const ctx = authCtx({ identity: null });

    await expect(getAuthedUserId(ctx as never)).rejects.toBeInstanceOf(ConvexError);
  });
});
