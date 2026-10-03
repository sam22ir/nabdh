// -----------------------------------------------------------------------------
// Backend adapter core.
//
// Screens call `useQuery(api.module.fn, args)` / `useMutation(api.module.fn)`.
// Each `api.*` function is implemented here against Supabase. Return shapes
// mirror the former Convex functions so screens did not have to change.
// -----------------------------------------------------------------------------
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export class BackendError extends Error {
  data: unknown;
  constructor(message: string, data?: unknown) {
    super(message);
    this.name = 'BackendError';
    this.data = data ?? message;
  }
}

export type Ctx = { db: SupabaseClient; userId: string | null };
type Handler<A, R> = (ctx: Ctx, args: A) => Promise<R>;

export type FnRef<A = any, R = any> = {
  readonly name: string;
  readonly kind: 'query' | 'mutation';
  readonly _types?: { args: A; ret: R };
};

type Def<A, R> = { kind: 'query' | 'mutation'; handler: Handler<A, R> };

export function query<A = any, R = any>(handler: Handler<A, R>): Def<A, R> {
  return { kind: 'query', handler };
}
export function mutation<A = any, R = any>(handler: Handler<A, R>): Def<A, R> {
  return { kind: 'mutation', handler };
}

type Module = Record<string, Def<any, any>>;
export type ApiOf<T extends Record<string, Module>> = {
  [M in keyof T]: {
    [F in keyof T[M]]: T[M][F] extends Def<infer A, infer R> ? FnRef<A, R> : never;
  };
};

const registry = new Map<string, Def<any, any>>();

export function defineApi<T extends Record<string, Module>>(modules: T): ApiOf<T> {
  const api: Record<string, Record<string, FnRef>> = {};
  for (const [moduleName, fns] of Object.entries(modules)) {
    api[moduleName] = {};
    for (const [fnName, def] of Object.entries(fns)) {
      const name = `${moduleName}.${fnName}`;
      registry.set(name, def);
      api[moduleName][fnName] = { name, kind: def.kind };
    }
  }
  return api as ApiOf<T>;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function runFn<A, R>(ref: FnRef<A, R>, args: A): Promise<R> {
  const def = registry.get(ref.name);
  if (!def) throw new BackendError(`Unknown backend function ${ref.name}`);
  const ctx: Ctx = { db: supabase, userId: await currentUserId() };
  return (await def.handler(ctx, (args ?? {}) as A)) as R;
}

// Postgres error messages raised by our SQL functions are plain codes.
const SQL_ERROR_MESSAGES: Record<string, { code?: string; message: string }> = {
  slot_unavailable: { code: 'slot_taken', message: 'Appointment slot is not available' },
  unauthenticated: { message: 'Authentication required' },
  forbidden: { message: 'Access denied' },
  not_found: { message: 'Not found' },
  already_onboarded: { message: 'Account already set up' },
  terms_required: { message: 'You must accept the terms and privacy policy' },
  invalid_state: { message: 'This action is not allowed in the current state' },
  too_late: { message: 'Too late to cancel this appointment' },
  location_required: { message: 'Location is required' },
  wilaya_required: { message: 'Wilaya is required' },
  already_exists: { message: 'Already exists' },
};

export function fail(error: PostgrestError | { message: string }): never {
  const known = SQL_ERROR_MESSAGES[error.message];
  if (known) {
    throw new BackendError(
      known.message,
      known.code ? { code: known.code, message: known.message } : known.message,
    );
  }
  throw new BackendError(error.message);
}

/** Unwrap a supabase-js result, throwing a BackendError on failure. */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) fail(result.error);
  return result.data as T;
}

export function requireUser(ctx: Ctx): string {
  if (!ctx.userId) throw new BackendError('Authentication required');
  return ctx.userId;
}
