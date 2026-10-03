import { defineApi } from './core';
import { bookings } from './handlers/bookings';
import { locations, specialties } from './handlers/reference';
import { pending } from './handlers/pending';
import { schedules } from './handlers/schedules';
import { users } from './handlers/users';

// Real handlers override the not-yet-ported placeholders in `pending`.
// Progress is tracked in docs/superpowers/plans/2026-10-03-convex-to-supabase-migration.md.
export const api = defineApi({
  ...pending,
  bookings,
  users: { ...pending.users, ...users },
  specialties,
  locations,
  schedules: { ...pending.schedules, ...schedules },
});
