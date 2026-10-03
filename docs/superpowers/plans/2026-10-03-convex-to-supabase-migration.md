# Convex + Clerk -> Supabase migration plan

Status: **plan only, nothing applied.** Owner decision (2026-10-03): move the
whole backend from Convex to Supabase, remove Clerk, use Google sign-in with
no email confirmation, and make first-time onboarding very short for every
role. The owner was advised that keeping Convex and adding Google sign-in was
the cheaper path and chose the full migration anyway. This supersedes
`2026-07-01-google-auth-profile-completion-plan.md` (Clerk-based).

## Open decisions (block Phase 0)

1. **Which Supabase project?** Two exist in the owner's org:
   `green-algeria-db` (`bxzlrqyhlbzyejhlqtni`, INACTIVE) and `lamsa-dev`
   (`osxbqwwjysnaqjjmmyqd`, ACTIVE, created 2026-09-30). Neither is confirmed
   to be for Nabdh. Do not write to either until the owner confirms, or a new
   project is created (costs money - needs owner approval).
2. **Real users/data in production Convex?** If none, skip Phase 6.
3. **Phone + password login:** keep as a fallback for people without Google,
   or Google-only? (Convex users currently log in by phone number.)
4. **Health-adjacent data:** `patients.chronicDiseases`, `patients.allergies`
   (stored empty by the app today), `encounterNotes`, and
   `reviews.diagnosisRating`. Recommendation: **drop them** in the new schema
   (also helps with Google Play's health-app classification). Needs owner OK.

## Target architecture

| Today (Convex/Clerk) | Supabase |
|---|---|
| Clerk email/password + email code | Supabase Auth, Google provider, "Confirm email" off |
| `users` (+ tokenIdentifier) | `profiles` keyed by `auth.users.id` (uuid) |
| Convex tables (`schema.ts`) | Postgres tables, uuid PKs, `created_at timestamptz` |
| Indexes | btree indexes + a unique partial index on active bookings per doctor/date/time (replaces app-level conflict checks) |
| Queries | PostgREST selects under RLS, or `rpc()` for joins/search/slots |
| Mutations with transactions | `plpgsql` functions (`security invoker` unless noted) |
| Live queries (`useQuery`) | TanStack Query + Supabase Realtime invalidation on `bookings`, `notifications` |
| Convex crons (`crons.ts`) | `pg_cron` -> Edge Function (daily summary, cleanup, auto-complete) |
| `pushDelivery.ts` | Edge Function (Expo push API) fired by a DB webhook on `notifications` insert |
| `searchIndex('search_name')` | `pg_trgm` / `ilike` |
| `convex-test` | pgTAP or vitest against `supabase start` (needs Docker) |
| Sentry, Expo, EAS | unchanged |

Google sign-in on Expo: use `@react-native-google-signin/google-signin` and
`supabase.auth.signInWithIdToken`. Requires an Expo dev/EAS build (not Expo
Go) and Google Cloud OAuth clients (Web + Android with the Play app-signing
SHA-1). Those are owner-side console tasks.

Security model (the part that must not be rushed): every table gets RLS
enabled in the same migration that creates it. Roles are `patient`, `doctor`,
`clinic`, stored in `profiles.role`, **never** trusted from client metadata.
Role is set once by an `onboard()` RPC. Any `security definer` function pins
`search_path`. Run `get_advisors` (security) after every migration.

## Onboarding target (all roles)

One screen: **Continue with Google**. Name and email come from Google. Then
one question: client / specialist / center.
- Client -> straight to search; phone asked at first booking only.
- Specialist -> specialty + wilaya, then done; schedule/bio via a
  "complete your profile" prompt.
- Center -> name + wilaya, then done.
Legal acceptance (`termsVersion`, `privacyVersion`, `legalAcceptedAt`) is a
single checkbox line on the same screen.

## Phases

0. **Decisions + infra:** answer the open decisions; create/choose the project;
   Google Cloud OAuth setup; store keys as env vars (never in the repo).
1. **Schema + RLS + seed:** translate `convex/schema.ts` to
   `supabase/migrations/*.sql`; seed wilayas, communes, specialties; RLS
   policies per role; pgTAP tests for the policies.
2. **Auth + onboarding:** Supabase client, Google sign-in, `onboard()` RPC,
   new `app/index.tsx` routing, delete Clerk screens and
   `EmailVerificationPanel`.
3. **Read paths:** specialties, doctors search, clinics, schedules/slots,
   favorites, reviews, notifications. Adapter hooks in `src/lib/api/` that keep
   screen diffs small.
4. **Write paths:** bookings first (create/cancel/status/no-show), then
   clinic memberships, schedules, settings, account deletion.
5. **Notifications:** push tokens, Edge Function delivery, cron jobs.
6. **Data migration (only if real data):** export Convex -> import with id
   mapping; users must re-sign in with Google, link by verified email.
7. **Cutover:** switch env, ship a new build, then delete `convex/`,
   `@clerk/*`, `convex` deps, `src/lib/supabase.ts` stub, and the legacy SQL.

Work happens on a long-lived branch. Convex stays untouched and deployable
until Phase 7 so rollback is trivial.

## Risks

- Convex gives transactions + realtime for free; every guarantee has to be
  re-created explicitly (unique index for slot conflicts, `for update` locks in
  RPCs, realtime subscriptions).
- 22 tests already fail on `main` and the Convex test harness will be thrown
  away, so new tests must be written, not ported.
- RLS mistakes leak data across roles. Treat advisors + policy tests as gates.
- Google-only sign-in excludes users without a Google account (see decision 3).
- Existing sessions/accounts do not carry over; Clerk users must re-onboard.
