# Clinic Doctor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clinic accounts, doctor-clinic membership requests, and clinic-first patient booking while preserving the existing Nabdh theme.

**Architecture:** Extend the existing Convex role/profile model instead of replacing it wholesale. New clinic accounts own clinic profile rows, doctors remain separate users, and accepted `clinicMemberships` controls booking access, schedules, exceptions, and worklists.

**Tech Stack:** Expo Router, React Native, Clerk, Convex, Vitest, convex-test.

---

## Files

- Modify: `convex/schema.ts` for role, clinic, membership, schedule, exception, notification indexes.
- Modify: `convex/users.ts` for clinic registration and role routing.
- Modify: `convex/clinics.ts` for clinic-owned profiles, public clinic search, and booking context.
- Create: `convex/clinicMemberships.ts` for request, invite, acceptance, rejection, leaving, removal, and membership queries.
- Modify: `convex/schedules.ts` for doctor-scoped schedule and exception authorization.
- Modify: `convex/bookings.ts` for clinic-first slot validation, clinic worklists, and membership-end cancellation helpers.
- Modify: `convex/notifications.ts` if needed for reusable patient/clinic/doctor notifications.
- Modify tests under `convex/*.test.ts`.
- Modify: `src/lib/roleSelection.ts`, `src/lib/pendingRegistration.ts`, `src/lib/authFormValidation.ts`, and tests.
- Create: `app/(auth)/clinic/register.tsx`, `app/(auth)/clinic/login.tsx`.
- Modify: `app/(auth)/finalize-registration.tsx`, `app/(auth)/_layout.tsx`, `app/index.tsx`, `app/_layout.tsx`.
- Create: `app/(clinic)/_layout.tsx`, `dashboard.tsx`, `doctors.tsx`, `appointments.tsx`, `schedule.tsx`, `profile.tsx`, `settings.tsx`.
- Modify: `app/(patient)/search.tsx`, `app/(patient)/booking/clinic.tsx`, `app/(patient)/booking/datetime.tsx`, `app/(patient)/booking/confirm.tsx`, `app/(patient)/doctor/[id].tsx`, `app/(patient)/_layout.tsx`.
- Modify: `app/(doctor)/dashboard.tsx`, `app/(doctor)/appointments.tsx`, `app/(doctor)/schedule.tsx`, `app/(doctor)/profile.tsx`, `app/(doctor)/_layout.tsx`.
- Add focused source tests under `tests/app-routes/**` and `src/lib/*.test.ts`.

### Task 1: Backend Tests For Clinic Accounts And Membership

- [ ] Write failing tests in `convex/users.test.ts` proving `registerAccount` creates a clinic user and clinic profile without gender, commune, required address, required map link, or pricing fields.
- [ ] Write failing tests in `convex/clinicMemberships.test.ts` proving doctor requests, clinic invites, receiver acceptance, one accepted clinic per doctor, and leave/remove flows.
- [ ] Run `npm test -- convex/users.test.ts convex/clinicMemberships.test.ts`.
- [ ] Expected: fails because clinic role and membership APIs do not exist yet.

### Task 2: Schema And Registration

- [ ] Update `convex/schema.ts` with the widened role, optional clinic-safe user gender, clinic ownership fields, membership table, and doctor-scoped schedule/exception indexes.
- [ ] Update `convex/users.ts` to validate and create clinic accounts.
- [ ] Keep patient and doctor registration behavior unchanged.
- [ ] Run the tests from Task 1.
- [ ] Expected: clinic registration tests pass; membership tests still fail until Task 3.

### Task 3: Membership API

- [ ] Implement `convex/clinicMemberships.ts` with request, invite, accept, reject, cancel, leave, remove, and list queries.
- [ ] Create notifications for incoming request/invite and membership decisions.
- [ ] On leave/remove, cancel future confirmed bookings and notify patients with an Arabic reason.
- [ ] Run `npm test -- convex/clinicMemberships.test.ts`.
- [ ] Expected: membership tests pass.

### Task 4: Availability And Booking Tests

- [ ] Write failing tests in `convex/bookings.test.ts` proving `getAvailableSlots` requires accepted doctor-clinic membership, blocks clinic closures, blocks doctor closures, and keeps a clinic available when another accepted doctor has slots.
- [ ] Write failing tests proving booking creation rejects invalid doctor-clinic pairs and accepts valid pairs.
- [ ] Run `npm test -- convex/bookings.test.ts`.
- [ ] Expected: fails until bookings and schedules are updated.

### Task 5: Schedules And Bookings Implementation

- [ ] Update `convex/schedules.ts` so accepted doctors and owning clinics can edit doctor-scoped schedules and exceptions.
- [ ] Update `convex/bookings.ts` so slot generation and creation require `clinicId + doctorId`, accepted membership, active clinic, clinic-level availability, doctor-level availability, and available slot.
- [ ] Add clinic worklist queries for clinic dashboard and appointments.
- [ ] Run `npm test -- convex/schedules.test.ts convex/bookings.test.ts`.
- [ ] Expected: focused backend tests pass.

### Task 6: Clinic Discovery Backend

- [ ] Add public clinic list/search/detail/booking-context queries in `convex/clinics.ts`.
- [ ] Add doctor card fields for `acceptedClinicId` and `isBookable`.
- [ ] Run `npm test -- convex/clinics.test.ts convex/doctors.test.ts`.
- [ ] Expected: focused public discovery tests pass.

### Task 7: Auth And Role Frontend Tests

- [ ] Write failing tests for `PublicAuthRole` including clinic, pending clinic registration fields, clinic auth routes, root stack route, and index role card.
- [ ] Run `npm test -- src/lib/roleSelection.test.ts src/lib/authFormValidation.test.ts tests/app-routes/auth tests/app-routes/indexRouting.test.ts`.
- [ ] Expected: fails until frontend role plumbing is implemented.

### Task 8: Auth And Role Frontend Implementation

- [ ] Update role selection, pending registration, and auth validation helpers.
- [ ] Add clinic register/login screens using the current theme and phone/password flow.
- [ ] Update finalize registration and root routing to support clinic users.
- [ ] Add `(clinic)` to the root stack.
- [ ] Run the tests from Task 7.
- [ ] Expected: focused auth tests pass.

### Task 9: Patient Clinic-First Booking UI

- [ ] Update patient search to switch between doctor and clinic results.
- [ ] Update doctor result booking to route to `booking/clinic?clinicId=...&doctorId=...` when bookable.
- [ ] Update booking clinic step to select a doctor inside the clinic, preselecting a doctor when supplied.
- [ ] Update date/time and confirmation to call slot and booking APIs with both clinic and doctor ids.
- [ ] Add source tests for route params and no commune/pricing text.
- [ ] Run focused patient route tests.

### Task 10: Doctor And Clinic Operational UI

- [ ] Add clinic tab group using existing doctor operational visual patterns.
- [ ] Add clinic doctors screen for requests, invites, accepted doctors, and removal.
- [ ] Add clinic schedule screen with doctor selector and clinic-level closure.
- [ ] Add clinic appointments screen with all clinic appointments and doctor filtering.
- [ ] Add doctor membership-required states and doctor-side request/invite management.
- [ ] Run focused route tests and source checks.

### Task 11: Verification

- [ ] Run focused Convex tests touched by the redesign.
- [ ] Run focused app-route/source tests touched by the redesign.
- [ ] Run `npm run typecheck`.
- [ ] Fix regressions found by verification.

## Self-Review

- Spec coverage: all confirmed requirements are mapped to schema, API, patient flow, doctor flow, clinic flow, and tests.
- Placeholder scan: no requirement is left as an unnamed later task.
- Migration risk: schema changes are widened where existing documents may exist. Required new relationships are enforced in new write paths first.
- Scope control: finance/pricing and commune are explicitly excluded.
- UI consistency: all new screens reuse current theme, typography, tabs, and operational row/card vocabulary.
