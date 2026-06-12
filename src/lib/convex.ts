import { ConvexReactClient, ConvexProvider, useQuery } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is not set. Create a .env file with your Convex deployment URL.",
  );
}

export const convex = new ConvexReactClient(convexUrl);

export { ConvexProvider, ConvexReactClient };

/**
 * Wraps `useQuery` from `convex/react`.
 *
 * The app uses this instead of TanStack React Query.
 */
export function useConvexQuery(
  query: Parameters<typeof useQuery>[0],
  ...args: Parameters<typeof useQuery>[1] extends undefined
    ? []
    : [Parameters<typeof useQuery>[1]]
): ReturnType<typeof useQuery> {
  return useQuery(query, ...args);
}
