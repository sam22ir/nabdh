# Nabdh GitHub Issues Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the prioritized readiness, notification/settings, week-boundary, and doctor-visibility issues created or updated on GitHub.

**Architecture:** Keep Convex as the source of truth for business rules. Add tests before behavior changes, centralize duplicated rules, and keep Expo app changes aligned with SDK 56 versioned docs.

**Tech Stack:** Expo SDK 56, Expo Router, React Native, Convex, Convex Auth, Vitest, convex-test, Playwright.

---

## GitHub Issues

- #5 Prepare app for production readiness
- #18 Language toggle does not translate most app text
- #20 Doctor settings controls do not persist
- #23 Implement push notification delivery pipeline
- #24 Align backend and doctor UI week-start logic
- #25 Document and test doctor public visibility eligibility

`gpt-5.3-codex` was requested for subagents, but the configured account rejected that model. Use `gpt-5.5` for implementation and review subagents.

## Required Project Rules

- Before writing Expo app code, read the versioned Expo SDK 56 docs at `https://docs.expo.dev/versions/v56.0.0/`.
- Before working on Convex code, read `convex/_generated/ai/guidelines.md`.
- Use TDD for behavior changes: write the failing test, run it and verify failure, then implement the minimum change.
- Do not revert unrelated existing worktree changes.

## Task 1: Doctor Public Visibility Eligibility (#25)

**Files:**
- Modify: `CONTEXT.md`
- Create: `convex/lib/doctorVisibility.ts`
- Modify: `convex/doctors.ts`
- Modify: `convex/bookings.ts`
- Modify: `convex/doctors.test.ts`
- Optional: `convex/schema.ts`

- [ ] **Step 1: Write failing tests for legacy visibility and get-by-id eligibility**

Add test coverage in `convex/doctors.test.ts` for:

- `isProfileComplete: true`, `isVerified: false` remains public.
- `isProfileComplete: false` plus `orderRegistrationNumber.trim().length >= 3` remains public for legacy rows.
- `isProfileComplete: false` plus empty registration number is hidden.
- `getById` returns `null` for a non-public doctor.

Run:

```bash
npm test -- convex/doctors.test.ts
```

Expected: the new legacy/get-by-id tests fail before implementation.

- [ ] **Step 2: Centralize the eligibility rule**

Create `convex/lib/doctorVisibility.ts` with a pure helper equivalent to:

```ts
export type DoctorVisibilityInput = {
  isProfileComplete?: boolean;
  orderRegistrationNumber?: string;
};

export function isPublicDoctorProfile(doctor: DoctorVisibilityInput): boolean {
  return Boolean(
    doctor.isProfileComplete ||
      (doctor.orderRegistrationNumber?.trim().length ?? 0) >= 3,
  );
}
```

Use it in `convex/doctors.ts` and `convex/bookings.ts` instead of duplicated local helpers.

- [ ] **Step 3: Harden public doctor detail**

In `convex/doctors.ts`, make `getById` return `null` when the doctor is not publicly eligible. Doctor-owned editing must continue to use `getMyProfile`, not `getById`.

- [ ] **Step 4: Update domain docs**

Update `CONTEXT.md` so it says:

- Public discovery/detail/booking eligibility is profile completeness.
- Legacy compatibility keeps existing doctors with a real registration number visible.
- `isVerified` is a credential trust badge only.
- Incomplete doctors with no valid registration number are hidden and not bookable.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- convex/doctors.test.ts convex/bookings.test.ts convex/users.test.ts
npm run typecheck
```

Expected: tests and typecheck exit 0.

## Task 2: Week-Start Alignment (#24)

**Files:**
- Modify: `convex/bookings.ts`
- Modify: `convex/bookings.test.ts`
- Create: `src/lib/doctorAppointmentWeeks.ts`
- Create: `src/lib/doctorAppointmentWeeks.test.ts`
- Modify: `app/(doctor)/appointments.tsx`
- Modify: `tests/app-routes/doctor/doctorScreens.test.ts`

- [ ] **Step 1: Add failing backend boundary tests**

In `convex/bookings.test.ts`, add Sunday/Monday boundary coverage for `listDoctorWeek`.

Use dates:

- Sunday: `2099-01-04`
- Monday: `2099-01-05`
- Saturday: `2099-01-10`
- Next Sunday: `2099-01-11`

Expected backend week range for both Sunday and Monday current dates:

```ts
{
  startDate: "2099-01-04",
  endDate: "2099-01-10",
}
```

Run:

```bash
npm test -- convex/bookings.test.ts
```

Expected: fails because `listDoctorWeek` does not expose `startDate` and `endDate`.

- [ ] **Step 2: Return backend week boundaries**

In `convex/bookings.ts`, extend `listDoctorWeek` to return:

```ts
{
  startDate: start,
  endDate: end,
  days,
}
```

Keep `days` behavior otherwise unchanged.

- [ ] **Step 3: Add UI week helper tests**

Create `src/lib/doctorAppointmentWeeks.test.ts` covering:

- `2099-01-04` through `2099-01-10` renders exactly seven sections.
- First day is Sunday and second day is Monday.
- Sparse backend `days` are preserved with empty sections filled in.

Run:

```bash
npm test -- src/lib/doctorAppointmentWeeks.test.ts
```

Expected: fails before helper exists.

- [ ] **Step 4: Add UI week helper**

Create `src/lib/doctorAppointmentWeeks.ts` to build the doctor week sections from backend `startDate`, `endDate`, and sparse `days`.

Use UTC-safe parsing for `YYYY-MM-DD` and avoid local timezone shifts.

- [ ] **Step 5: Replace Monday-start UI logic**

In `app/(doctor)/appointments.tsx`:

- Import the helper.
- Build `weekSections` from `weekData.startDate`, `weekData.endDate`, and `weekData.days`.
- Remove `diffToMonday`.
- Remove the "Monday start" assumption.

- [ ] **Step 6: Add route/source guard**

In `tests/app-routes/doctor/doctorScreens.test.ts`, assert the doctor appointments screen imports the helper and no longer contains `diffToMonday`.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- convex/bookings.test.ts src/lib/doctorAppointmentWeeks.test.ts tests/app-routes/doctor/doctorScreens.test.ts
npm run typecheck
```

Expected: tests and typecheck exit 0.

## Task 3: Server-Backed Doctor Settings (#20)

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/doctorSettings.ts`
- Create: `convex/doctorSettings.test.ts`
- Modify: `app/(doctor)/settings.tsx`
- Decide: keep or shrink `src/stores/doctorSettingsStore.ts`

- [ ] **Step 1: Add failing Convex tests**

Create `convex/doctorSettings.test.ts` covering:

- Doctor gets default settings with no row.
- Doctor updates settings and reads them back.
- Patient cannot read or update doctor settings.
- Invalid `minCancelHours` is rejected.

Run:

```bash
npm test -- convex/doctorSettings.test.ts
```

Expected: fails before schema/functions exist.

- [ ] **Step 2: Add schema table**

Add `doctorSettings` in `convex/schema.ts`:

```ts
doctorSettings: defineTable({
  doctorId: v.id("doctors"),
  userId: v.id("users"),
  newBookingAlerts: v.boolean(),
  cancellationAlerts: v.boolean(),
  dailySummary: v.boolean(),
  minCancelHours: v.number(),
  updatedAt: v.number(),
})
  .index("by_doctorId", ["doctorId"])
  .index("by_userId", ["userId"]),
```

- [ ] **Step 3: Add Convex API**

Create `convex/doctorSettings.ts`:

- `getMy`: doctor-only query returning existing settings or defaults.
- `updateMy`: doctor-only mutation upserting settings.
- `getForDoctorInternal`: internal query for notification-delivery decisions.

- [ ] **Step 4: Wire doctor settings UI**

Update `app/(doctor)/settings.tsx` to use Convex as source of truth. Keep Zustand only for optimistic fallback if needed; do not let local state override confirmed server state.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- convex/doctorSettings.test.ts
npm run typecheck
```

Expected: tests and typecheck exit 0.

## Task 4: Push Notification Delivery Pipeline (#23)

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Create: `src/lib/pushNotifications.ts`
- Modify: `app/_layout.tsx`
- Modify: `convex/notifications.ts`
- Create: `convex/pushDelivery.ts`
- Modify: `convex/bookings.ts`
- Modify or create: notification/push tests

- [ ] **Step 1: Read Expo notification docs**

Before code changes, read:

- `https://docs.expo.dev/versions/v56.0.0/sdk/notifications/`
- `https://docs.expo.dev/push-notifications/sending-notifications/`

- [ ] **Step 2: Add SDK-compatible dependency**

Run:

```bash
npx expo install expo-notifications
```

Expected: `package.json` and `package-lock.json` update with SDK-compatible versions.

- [ ] **Step 3: Add failing backend tests**

Add tests that prove:

- `registerPushToken` deduplicates per user/token.
- `unregisterPushToken` only removes the current user's token.
- Booking notification creation routes through the internal notification boundary.
- Doctor-targeted notification delivery respects server-backed doctor settings.

- [ ] **Step 4: Refactor notification creation boundary**

Route direct notification inserts in `convex/bookings.ts` through `internal.notifications.create`.

Schedule delivery with:

```ts
ctx.scheduler.runAfter(0, internal.pushDelivery.deliverNotification, {
  notificationId,
});
```

- [ ] **Step 5: Add delivery action**

Create `convex/pushDelivery.ts` as an action-based delivery boundary. Actions must not use `ctx.db`; fetch notification/tokens/settings via internal queries and record delivery results via internal mutations.

- [ ] **Step 6: Add client registration**

Create `src/lib/pushNotifications.ts`:

- no-op on web
- create Android notification channel
- request permission
- get Expo push token using EAS project ID
- call `api.notifications.registerPushToken`
- unregister on sign-out when possible

Wire it from `app/_layout.tsx` or an auth-aware child component.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- convex/notifications.test.ts convex/bookings.test.ts
npm run typecheck
CI=1 npx expo install --check
```

Expected: tests, typecheck, and Expo dependency check exit 0.

## Task 5: French Support Decision (#18)

**Files:**
- Modify: `PRODUCT.md`
- Modify: `README.md` or `CONTEXT.md`
- Decide later: translation key migration and `assets/locales/fr.json`

- [ ] **Step 1: Decide MVP scope**

For MVP, either:

- Make French a real supported language for core screens, or
- Mark French as post-MVP and hide/disable the language switch.

- [ ] **Step 2: If MVP, implement in focused slices**

Move copy for patient home/search/appointments/profile and auth screens into translation resources before expanding to doctor screens.

- [ ] **Step 3: If post-MVP, remove false affordance**

Disable or hide language switching until real French copy exists.

## Task 6: Production Readiness Verification (#5)

**Files:**
- Modify: `README.md`
- Optional: `package.json`
- Optional: `playwright.config.ts`

- [ ] **Step 1: Add or document verification commands**

Baseline commands:

```bash
git status --short
node --version
npm ci
npm run typecheck
npm test
CI=1 npx expo install --check
npx expo-doctor
```

- [ ] **Step 2: Re-run patient booking web smoke**

Use the existing Playwright spec:

```bash
CI=true WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=1 npm run web -- --port 19006
E2E_BASE_URL=http://localhost:19006 npx playwright test tests/e2e/patient-booking-web.spec.ts --project=chromium-mobile-web
```

- [ ] **Step 3: Record readiness evidence**

Issue #5 can close only when command output, commit/tree state, runtime, and smoke-test evidence are recorded.
