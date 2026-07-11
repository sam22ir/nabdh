# Doctor Notification Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the doctor notification toggles into real backend-controlled push notifications for new bookings, cancellations, and daily summaries.

**Architecture:** Persist doctor notification preferences in Convex so both the settings screen and push delivery read the same source of truth. Create notification records from booking events, then route them through the existing Expo push pipeline while filtering by the doctor’s saved preferences. Add a daily-summary cron as a separate backend producer that uses the same notification path.

**Tech Stack:** Expo Router, Expo Notifications, Convex queries/mutations/internal actions, Vitest, Convex tests

---

### Task 1: Persist doctor notification settings in Convex

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/doctorSettings.ts`
- Modify: `convex/doctorSettings.test.ts` or `convex/bookings.test.ts` if reused
- Modify: `app/(doctor)/settings.tsx`

- [ ] Add a `doctorSettings` table keyed by `userId`
- [ ] Update `doctorSettings.getMy` to read existing settings or return defaults
- [ ] Update `doctorSettings.updateMy` to upsert persisted settings
- [ ] Keep the frontend settings screen using the same API, with local store only as temporary UI fallback

### Task 2: Create a reusable backend notification producer

**Files:**
- Modify: `convex/notifications.ts`
- Modify: `convex/pushDelivery.ts`
- Modify: `convex/schema.ts`

- [ ] Add an internal mutation that inserts a notification row
- [ ] Schedule `internal.pushDelivery.deliverNotification` after insert
- [ ] Extend push delivery to read doctor settings before sending push
- [ ] Map notification types to saved settings flags

### Task 3: Trigger doctor notifications from booking mutations

**Files:**
- Modify: `convex/bookings.ts`
- Modify: `convex/bookings.test.ts`

- [ ] On booking creation, notify the booked doctor if `newBookingAlerts` is enabled
- [ ] On booking cancellation, notify the doctor if `cancellationAlerts` is enabled
- [ ] Ensure duplicate or malformed notification payloads are avoided

### Task 4: Add daily summary production

**Files:**
- Modify: `convex/crons.ts`
- Modify: `convex/notifications.ts` or new summary module if needed
- Modify: `convex/bookings.ts` only if shared query helpers are required
- Modify: `convex/bookings.test.ts` or add focused notification tests

- [ ] Add a cron that runs once per day on Algeria time assumptions used by bookings
- [ ] Build a lightweight summary for each doctor with upcoming workload data
- [ ] Create a `daily_summary` notification only when `dailySummary` is enabled

### Task 5: Verify the full vertical slice

**Files:**
- Modify tests only as needed

- [ ] Run focused Convex and route tests covering settings persistence and notification triggers
- [ ] Confirm push registration code stays compatible with Expo Go limitations
- [ ] Leave the UI text unchanged unless a bug appears during wiring
