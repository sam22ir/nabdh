# Nabdh Doctor Tabs Redesign Design

## Summary

Redesign the doctor-facing tabs first, before touching patient tabs. The approved direction is an operational doctor console: schedule-first, denser than the patient app, built for daily clinic work rather than marketing polish.

Patient tabs stay out of this implementation phase. After the doctor tabs are implemented and shown for review, the patient tabs can be redesigned in a second phase using the same core visual system but a calmer discovery-oriented rhythm.

## Product Direction

Nabdh should feel calm, official, and fast. For doctors, that means the interface should make the day's operational work obvious: see appointments, identify the next patient, update appointment state, manage schedule capacity, keep the public profile complete, and adjust settings without hunting through decorative screens.

The doctor UI should be related to the patient UI but not identical. Patients need reassurance and guided choice. Doctors need density, status triage, and fast repeated actions.

## Scope

Phase 1 covers only the doctor tab shell and these doctor tabs:

- `app/(doctor)/dashboard.tsx`
- `app/(doctor)/appointments.tsx`
- `app/(doctor)/schedule.tsx`
- `app/(doctor)/profile.tsx`
- `app/(doctor)/settings.tsx`
- Shared doctor-facing UI primitives and theme tokens if needed

Phase 1 must not redesign patient tabs:

- `app/(patient)/index.tsx`
- `app/(patient)/search.tsx`
- `app/(patient)/appointments.tsx`
- `app/(patient)/favorites.tsx`
- `app/(patient)/profile.tsx`
- Patient booking screens

Patient tabs should only be touched if required to keep shared types or theme code compiling, and any such touch must be minimal.

## Visual System

Use the existing restrained product palette as the base. Doctor screens can lean harder on the official color for headers, active segments, appointment times, and action priority, but inactive states stay neutral and readable.

Core visual rules:

- Arabic RTL remains the primary layout.
- Use Cairo for Arabic UI text and the existing app font setup.
- Keep card radii restrained, around the existing 8-14px system.
- Avoid decorative medical illustration and emoji UI.
- Use semantic status colors with text labels, not color alone.
- Prefer structured rows, segmented controls, and inline panels over large decorative cards.
- Use bottom sheets only for focused appointment details and editing tasks, not as default navigation.

## Doctor Dashboard

The dashboard becomes the doctor's command center for today.

It should show:

- A compact official header with today's date and selected clinic context.
- Three to four operational counters, such as today's appointments, waiting/confirmed, completed, and cancelled/no-show.
- The next patient as the first actionable item.
- A timeline-style list for today's appointments, ordered by time.
- Appointment rows that expose patient name, visit type, reason or note preview, time, and status.
- Fast actions through the appointment detail sheet: mark completed, mark no-show, save doctor note.

The dashboard should not feel like a generic statistics page. Counts are useful only because they orient the doctor before the appointment list.

## Appointments Tab

The appointments tab becomes a filtered worklist.

It should keep the existing today/week/month model but make the structure clearer:

- Segmented control for today, week, and month.
- Today view optimized for status triage and repeated actions.
- Week view grouped by day with empty days still visible enough to explain availability.
- Month view used as an overview, not a dense calendar replacement.
- Appointment detail sheet shared with dashboard where practical.
- Empty states should explain what no appointments means for the selected period.

The tab should avoid duplicating unrelated dashboard summary content. Its job is browsing and acting on appointment records.

## Schedule Tab

The schedule tab becomes a clinic-hours editor with stronger structure.

It should show:

- Clinic selector if the doctor has multiple clinics.
- Weekly schedule rows by day.
- Clear enabled/closed state per day.
- Start time, end time, appointment duration, and max patients per day close together.
- Schedule exceptions in a separate section with date, reason, closed/custom-hours status, and edit/delete actions.
- Save feedback that is visible but not disruptive.

The editing model can keep existing modal-based time pickers if they are already stable, but the main screen should read as a compact weekly operations view.

## Profile Tab

The profile tab should focus on public trust and completion.

It should show:

- A profile completion indicator based on required public-profile fields.
- Sections for personal information, professional information, languages, fees, and clinic information.
- Verification and registration context as factual status, not decorative trust theater.
- Inline validation and clear save feedback.

This tab should make incomplete or weak public-profile data easy for doctors to identify and fix.

## Settings Tab

The settings tab should be quieter and more utilitarian.

It should show:

- Account and app preferences grouped clearly.
- Notification-related controls near the top if present.
- Language/RTL settings where applicable.
- Session/account actions near the bottom.
- Destructive or sign-out actions visually distinct from normal rows.

Avoid making settings a dashboard. It is a maintenance surface.

## Shared Components

Introduce or extend shared primitives only when they remove duplication across the doctor tabs. Likely useful primitives:

- `DoctorHeader` for official compact headers.
- `MetricStrip` or a simple stat row for operational counters.
- `SegmentedControl` for tab-like filters.
- `AppointmentWorkItem` for dense appointment rows.
- `StatusBadge` or reuse the existing `Badge` primitive with stronger appointment vocabulary.
- `BottomSheet` or a constrained appointment detail panel if current modal code is duplicated.

The implementation should prefer the existing `StyleSheet` and component patterns. Do not introduce a new UI framework.

## States And Edge Cases

Doctor tabs need explicit states for:

- Loading appointment and schedule data.
- No appointments today.
- No appointments for the selected week/month period.
- Missing clinic or schedule setup.
- Profile incomplete.
- Save success and save failure.
- Appointment action failure.
- Long Arabic and French labels.
- Small Android widths.

Loading should use structured skeleton-like placeholders or compact loading rows where practical, not only full-screen spinners.

## Testing And Verification

Verification should include:

- Existing route tests for doctor screens.
- Focused component or text-presence tests for the redesigned doctor tabs where current tests expect old labels or structure.
- `npm test` or the relevant focused Vitest suites.
- TypeScript/typecheck command used by this project.
- Expo web smoke after implementation, using the existing watcher fallback if needed.

Before showing the doctor tabs, run a local visual smoke test and capture the key doctor routes in browser or emulator where available.

## Out Of Scope

- Patient tab redesign.
- Patient booking flow redesign.
- Backend schema changes.
- Convex query behavior changes unless required by existing doctor UI data.
- New roles such as clinic admin or super admin.
- Payment, messaging, or new notification features.
