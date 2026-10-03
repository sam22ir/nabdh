import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  useInfiniteQuery,
  useQuery as useReactQuery,
  useQueryClient,
} from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { runFn, type FnRef } from './core';

const REALTIME_TABLES = [
  'bookings',
  'notifications',
  'clinic_memberships',
  'schedules',
  'schedule_exceptions',
] as const;

function useRealtimeInvalidation(userId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries(), 300);
    };
    let channel = supabase.channel(`app-changes-${userId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, invalidate);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}

function QueryLifecycle({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null>(null);

  // Drop cached data when the signed-in account changes.
  useEffect(() => {
    if (previousUser.current !== userId) {
      queryClient.clear();
      previousUser.current = userId;
    }
  }, [queryClient, userId]);

  // Refetch when the app returns to the foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => sub.remove();
  }, []);

  useRealtimeInvalidation(userId);
  return <>{children}</>;
}

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } }),
    [],
  );
  return (
    <QueryClientProvider client={client}>
      <QueryLifecycle>{children}</QueryLifecycle>
    </QueryClientProvider>
  );
}

/** Live-ish query. `undefined` while loading, `'skip'` disables it. */
export function useQuery<A, R>(ref: FnRef<A, R>, args?: A | 'skip'): R | undefined {
  const { userId, isLoaded } = useAuth();
  const skip = args === 'skip' || !isLoaded;
  const query = useReactQuery({
    queryKey: [ref.name, args ?? {}, userId],
    queryFn: async () => (await runFn(ref, (args ?? {}) as A)) ?? null,
    enabled: !skip,
  });
  if (query.error) throw query.error;
  return skip ? undefined : (query.data as R | undefined);
}

export function useMutation<A, R>(ref: FnRef<A, R>) {
  const queryClient = useQueryClient();
  return useCallback(
    async (args?: A): Promise<R> => {
      const result = await runFn(ref, (args ?? {}) as A);
      void queryClient.invalidateQueries();
      return result;
    },
    [queryClient, ref],
  );
}

type PaginatedPage = { page: unknown[]; isDone: boolean; continueCursor: string | null };

export function usePaginatedQuery<A, R extends PaginatedPage>(
  ref: FnRef<A, R>,
  args: A | 'skip',
  options: { initialNumItems: number },
) {
  const { userId, isLoaded } = useAuth();
  const skip = args === 'skip' || !isLoaded;
  const pageSize = useRef(options.initialNumItems);
  const query = useInfiniteQuery({
    queryKey: [ref.name, 'paginated', args, userId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      runFn(ref, {
        ...((args === 'skip' ? {} : args) as object),
        paginationOpts: { numItems: pageSize.current, cursor: pageParam },
      } as unknown as A),
    getNextPageParam: (last) => (last.isDone ? undefined : (last.continueCursor ?? undefined)),
    enabled: !skip,
  });
  if (query.error) throw query.error;

  const results = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.page),
    [query.data],
  );
  const status = skip || query.isLoading
    ? 'LoadingFirstPage'
    : query.isFetchingNextPage
      ? 'LoadingMore'
      : query.hasNextPage
        ? 'CanLoadMore'
        : 'Exhausted';
  const loadMore = useCallback(
    (numItems?: number) => {
      if (numItems) pageSize.current = numItems;
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    [query],
  );

  return { results: results as any[], status, isLoading: status === 'LoadingFirstPage', loadMore };
}

/** Imperative access (replaces useConvex()). */
export function useBackend() {
  return useMemo(
    () => ({
      query: <A, R>(ref: FnRef<A, R>, args?: A) => runFn(ref, (args ?? {}) as A),
      mutation: <A, R>(ref: FnRef<A, R>, args?: A) => runFn(ref, (args ?? {}) as A),
    }),
    [],
  );
}

export function useAuthState() {
  const { isLoaded, isSignedIn } = useAuth();
  return { isLoading: !isLoaded, isAuthenticated: isSignedIn };
}
