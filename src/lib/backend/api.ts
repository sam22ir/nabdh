import { defineApi } from './core';
import { users } from './handlers/users';
import { locations, specialties } from './handlers/reference';

// Every function the screens call. Modules still to be ported from Convex are
// listed in docs/superpowers/plans/2026-10-03-convex-to-supabase-migration.md.
export const api = defineApi({
  users,
  specialties,
  locations,
});
