# نبض (Nabdh) — Domain Glossary

A medical appointment booking platform connecting Algerian patients with private-practice doctors. The name نبض means "pulse" in Arabic.

Built with React Native + Expo SDK 56 (Android-first, iOS-ready), Supabase backend (Postgres + Row Level Security + Realtime), Supabase Auth with Google as the only sign-in method, Expo Router for file-based navigation, TanStack Query, and Zustand for local UI preferences. RTL-first Arabic UI with French support. StyleSheet + shared theme tokens (no NativeWind). Single app with role-gated Patient/Doctor shells.

The active data model, authorization (RLS) and business logic live in `supabase/migrations`. The `convex/` folder is the previous backend, kept only until the migration is finished (see `docs/superpowers/plans/2026-10-03-convex-to-supabase-migration.md`). Do not deploy `supabase/legacy_migrations`.

**Profile** (الملف الفرعي):
A sub-identity under a Patient's account representing a family member (spouse, child, parent). A Patient can have multiple Profiles. When booking, the Patient selects which Profile the appointment is for. Each Profile carries its own name, DOB, gender, and medical info.
_Avoid_: sub-account, dependent, family member

## Actors

**Patient** (المريض):
A person who uses the app to find doctors and book appointments. Authenticated with Google only. Phone number is required on profile but is not an auth factor.
_Avoid_: user, client, customer

**Doctor** (الطبيب):
A private-practice physician with a completed profile. Manages their schedule, confirms appointments, and responds to reviews. Authenticated with Google only. Manual verification of the نقابة registration number is a trust badge, not the public visibility gate.
_Avoid_: provider, practitioner, clinician

**Public Doctor Visibility**:
A Doctor is publicly discoverable, viewable, and bookable when their profile is complete. Legacy doctor rows with a real registration number (`orderRegistrationNumber.trim().length >= 3`) remain public for compatibility even if `isProfileComplete` is false. `isVerified` means the app team manually checked credentials; it must not hide an otherwise complete Doctor from patient discovery.
_Avoid_: using `isVerified` as the discovery or booking gate

**Clinic Admin** (مدير العيادة):
Manages appointments and schedules for multiple doctors at a single medical center. Future role — not in MVP.
_Avoid_: secretary, receptionist

**Super Admin** (مدير التطبيق):
Reviews doctor registrations, verifies credentials, manages content. Internal team member — not a public-facing role.

## Core concepts

**Appointment** (موعد / Booking):
A reserved time slot at a specific clinic with a specific doctor. Has a lifecycle: confirmed → completed (or cancelled/no-show). The spec uses "booking" as the database term and "موعد" as the user-facing term. Use **Appointment** in code.
_Avoid_: reservation, session, visit

**Slot** (فترة):
A discrete time window of `appointment_duration` length (e.g. 20 minutes) within a doctor's working hours. Slots are computed from the doctor's schedule, not stored individually.
_Avoid_: time block, opening

**Clinic** (العيادة):
A physical location where a doctor sees patients. A doctor can work at multiple clinics, each with its own address, schedule, and phone number.
_Avoid_: practice, office, cabinet

**Schedule** (جدول العمل):
The recurring weekly pattern of working hours for a specific clinic. Defines days of week, start/end times, appointment duration, and patient capacity.
_Avoid_: calendar, availability, hours

**Review** (تقييم):
A 5-star rating with four sub-ratings (punctuality, diagnosis clarity, professionalism, cleanliness) left by a patient after a completed appointment. Only patients who booked through the app can review. Doctors can reply once.
_Avoid_: rating, feedback, comment

## Relationships

- A **Patient** has many **Appointments** with many **Doctors**
- A **Doctor** works at one or more **Clinics**
- A **Clinic** has one **Schedule** (recurring weekly) and zero or more **Schedule Exceptions** (one-off changes)
- An **Appointment** belongs to one **Patient**, one **Doctor**, and one **Clinic**
- A **Review** belongs to exactly one completed **Appointment**

## Flagged ambiguities

- "الزيارة" (visit) in the spec sometimes means the appointment and sometimes the actual physical encounter — resolved: use **Appointment** for the booked slot, and "visit" only in user-facing text.
- The spec uses both "booking" (table name) and "appointment" (user-facing) — resolved: use **Appointment** in code and documentation, let l10n handle the Arabic.
