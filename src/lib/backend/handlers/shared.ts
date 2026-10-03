import { BackendError, type Ctx } from '../core';
import { loadMe } from './users';

const ALGERIA_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no daylight saving

/** Current date in Algeria as YYYY-MM-DD. */
export function todayString(): string {
  return new Date(Date.now() + ALGERIA_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

/** The center the signed-in account is acting as (a center account, or a solo specialist in center view). */
export async function myClinicId(ctx: Ctx): Promise<string> {
  if (!ctx.userId) throw new BackendError('Authentication required');
  const me = await loadMe(ctx.userId);
  if (!me || me.role !== 'clinic' || !me.profile?._id) {
    throw new BackendError('Clinic account required');
  }
  return me.profile._id as string;
}

export function requireDoctor(ctx: Ctx): string {
  if (!ctx.userId) throw new BackendError('Authentication required');
  return ctx.userId;
}
