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
          subject: "user_clerk123",
          tokenIdentifier: "https://clerk.example.test|user_clerk123",
          email: "patient@example.test",
        };
  const foundUser = overrides.foundUser ?? user;

  return {
    auth: {
      getUserIdentity: vi.fn(async () => identity),
    },
    db: {
      get: vi.fn(async (id: unknown) => (id === userId ? foundUser : null)),
      query: vi.fn((table: string) => {
        if (table !== "users") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          withIndex: vi.fn((_indexName: string, buildQuery: (q: unknown) => unknown) => {
            const q = { eq: vi.fn(() => q) };
            buildQuery(q);
            return {
              unique: vi.fn(async () => foundUser),
            };
          }),
        };
      }),
    },
  };
}

describe("Clerk auth helpers", () => {
  test("resolve the current app user id from Clerk tokenIdentifier", async () => {
    const ctx = authCtx();

    await expect(getAuthedUserId(ctx as never)).resolves.toBe(userId);

    expect(ctx.db.query).toHaveBeenCalledWith("users");
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
