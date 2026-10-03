# Convex + Clerk -> Supabase migration plan

Status: **Phase 1 and the auth/onboarding half of Phase 2 are done (Supabase project `nabdh`, `oeexmfgpfotimfsqkntp`, eu-west-1). Phases 3-7 (porting the remaining Convex functions) are not done.** See "Progress" at the end. Owner decision (2026-10-03): move the
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

## Progress

**Phase 1 - done.** Applied to the `nabdh` project and kept in
`supabase/migrations/`: schema, RLS + column-level grants, reference data
(69 wilayas, 9 communes, 22 neutral specialty names), onboarding functions
(`onboard_patient/doctor/clinic`, Google-name prefill, terms acceptance
required), `get_available_slots`, `create_booking`, `cancel_booking`,
`set_booking_status`, `update_booking_doctor_note`. Verified with
`supabase/tests/booking_flow.sql` (RLS visibility, no double booking,
privilege-escalation attempts blocked, state machine) and the security
advisor (only the intended "signed-in users can call this function" notices).

Decisions taken without owner input (all reversible, migrations are plain SQL):
- Production data not migrated (new empty project, greenfield).
- Phone is a profile field only; login is Google-only.
- Dropped `chronicDiseases`, `allergies`, `diagnosisRating`; **kept** booking
  notes (`booking_notes`) and `doctor_note` to preserve the existing feature.

**Next (Phase 2+), in order:**
1. Owner: enable the Google provider in Supabase (Authentication -> Providers)
   with Google Cloud OAuth client IDs; turn off "Confirm email".
2. Remaining SQL: clinic membership functions (request/invite/accept/reject/
   cancel/leave/remove), reviews create/reply, booking notes add, doctor/clinic
   account deletion, favorites toggle, push token upsert, daily summary and
   cleanup via `pg_cron`, Edge Function for push delivery.
3. App: Supabase client + Google sign-in + new onboarding screens, replace
   Convex hooks (~116 call sites in 38 files), then delete Clerk/Convex.

**Phase 2 (auth + onboarding) - code done 2026-10-03, not yet run on a device.**
Spec: `docs/superpowers/specs/2026-10-03-google-only-onboarding-design.md`.
- `src/lib/supabase.ts`, `src/lib/auth.tsx` (Google ID token -> Supabase),
  `src/lib/backend/*` (adapter: `useQuery/useMutation/usePaginatedQuery`
  against Supabase with Realtime invalidation; every screen now imports from
  `@/lib/backend`, no screen imports Convex or Clerk).
- Screens: `app/index.tsx` (role cards + Continue with Google + legal notice),
  `app/onboarding.tsx` (client: no form; specialist: specialty + wilaya, then
  "work alone?" pop-up with solo center + default schedule; center: name,
  wilaya, required location, optional phone), `LocationField` + `MapPicker`
  (GPS or OpenStreetMap/Leaflet), role switch in settings, account deletion by
  typed confirmation.
- Clerk screens, captcha, phone-login code and the Clerk dependency are gone.

**Owner actions still needed before it can run**
1. Supabase -> Authentication -> Providers -> Google: enable, paste the Web
   client ID and secret, add the Android client ID to Authorized Client IDs;
   turn off "Confirm email".
2. Put `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` and in the EAS environment.
3. Run `supabase/migrations/20261003000010_delete_my_account.sql` once in the
   Supabase SQL editor (the MCP tool holds DELETE statements for human
   confirmation, so it was not applied automatically).
4. Build a development build (Google sign-in and the map need native code;
   Expo Go will not work).

**Remaining backend work (Phase 3/4)**: 73 functions in 12 modules are listed in
`src/lib/backend/handlers/pending.ts`; each throws "Not implemented yet" until
ported. Port module by module (bookings, clinicMemberships, clinics, doctors,
reviews, schedules, notifications, clinicSettings, doctorSettings,
encounterNotes, patientProfiles) and delete the entry as you go. Also needed:
Edge Function for push delivery, `pg_cron` jobs, and removing `convex/` at
cutover. Drop the disabled legacy `onboard_clinic(text, smallint, text, text,
text, text)` overload when convenient.

**Phase 4a - bookings module ported (2026-10-03).** All 22 `bookings.*`
functions now run on Supabase (`src/lib/backend/handlers/bookings.ts`):
patient lists/home, specialist today/week/month/home/history, center list/
history/counters, create/reschedule/cancel, status changes, doctor note,
slots, and attendance sync. New SQL: `reschedule_booking`,
`sync_clinic_attendance` (+ `private.process_clinic_attendance`, to be run by
`pg_cron` later), `count_clinic_doctors_working`. Verified with
`supabase/tests/booking_lifecycle.sql`. `clinic_settings.auto_complete_appointments`
now defaults to true like the old backend. 51 functions remain in
`handlers/pending.ts`.
