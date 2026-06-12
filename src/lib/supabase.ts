// -----------------------------------------------------------------------------
// Supabase client stub
// -----------------------------------------------------------------------------
// The app uses Convex as its primary backend. This stub satisfies imports
// in transitional code that still references Supabase. Remove once all
// Supabase calls are migrated to Convex mutations.
// -----------------------------------------------------------------------------

const WARN = () =>
  console.warn(
    "[supabase stub] Supabase is not configured. Install @supabase/supabase-js and set SUPABASE_URL/SUPABASE_ANON_KEY to enable.",
  );

interface SupabaseMaybeSingle {
  single(): SupabasePromise;
}

type SupabaseFilter = SupabaseMaybeSingle & {
  eq(col: string, val: unknown): SupabaseFilter;
  neq(col: string, val: unknown): SupabaseFilter;
  in(col: string, vals: unknown[]): SupabaseFilter;
  gte(col: string, val: unknown): SupabaseFilter;
  lte(col: string, val: unknown): SupabaseFilter;
  order(col: string, opts?: { ascending?: boolean }): SupabaseFilter;
  limit(n: number): SupabasePromise;
  range(from: number, to: number): SupabasePromise;
  then: <TResult1 = SupabaseResult, TResult2 = never>(
    onfulfilled?: (value: SupabaseResult) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) => Promise<TResult1 | TResult2>;
};

interface SupabasePromise extends PromiseLike<SupabaseResult> {
  then: <TResult1 = SupabaseResult, TResult2 = never>(
    onfulfilled?: (value: SupabaseResult) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) => Promise<TResult1 | TResult2>;
}

interface SupabaseResult {
  data: unknown;
  error: Error | null;
  count: number | null;
}

interface SupabaseDeleteBuilder {
  eq(col: string, val: unknown): SupabasePromise;
}

interface SupabaseInsertBuilder {
  then: <TResult1 = SupabaseResult, TResult2 = never>(
    onfulfilled?: (value: SupabaseResult) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) => Promise<TResult1 | TResult2>;
}

function stubResult(): SupabaseResult {
  WARN();
  return { data: null, error: new Error("Supabase is not configured"), count: 0 };
}

function makeSelectBuilder(
  selectArgs?: { count?: "exact" },
): SupabaseFilter {
  const filter: SupabaseFilter = {
    eq: () => filter,
    neq: () => filter,
    in: () => filter,
    gte: () => filter,
    lte: () => filter,
    order: () => filter,
    limit: () => makePromise(selectArgs),
    range: () => makePromise(selectArgs),
    single: () => makePromise(selectArgs),
    then: (onfulfilled, onrejected) => {
      if (selectArgs?.count === "exact") {
        return Promise.resolve({ data: null, error: null, count: 0 }).then(
          onfulfilled,
          onrejected,
        );
      }
      return Promise.resolve(stubResult()).then(onfulfilled, onrejected);
    },
  };
  return filter;
}

function makePromise(selectArgs?: { count?: "exact" }): SupabasePromise {
  if (selectArgs?.count === "exact") {
    return Promise.resolve({ data: null, error: null, count: 0 });
  }
  return Promise.resolve(stubResult());
}

function createStubClient() {
  return {
    from: (_table: string) => ({
      insert: (_data: Record<string, unknown>): SupabaseInsertBuilder =>
        Promise.resolve(stubResult()),
      delete: (): SupabaseDeleteBuilder => ({
        eq: () => Promise.resolve(stubResult()),
      }),
      select: (
        _columns?: string,
        opts?: { count?: "exact"; head?: boolean },
      ): SupabaseFilter => makeSelectBuilder(opts),
    }),
  };
}

export const supabase = createStubClient();
