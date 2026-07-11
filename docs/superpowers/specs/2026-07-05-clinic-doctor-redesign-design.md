# Clinic And Doctor Redesign Design

## Context

Nabdh currently treats `doctor` as the only professional account type. Doctors own clinic rows, clinic schedules, exceptions, and appointment worklists. The redesign adds a separate clinic account while keeping doctors as independent accounts. A doctor can operate appointments only after joining one clinic.

## Confirmed Requirements

- Account selection has three roles: patient, doctor, clinic.
- Clinic registration uses phone/password auth. Clinic name, phone number, and wilaya are mandatory. Email, address, and Google Maps link are optional. Commune is removed from the clinic flow.
- Doctors keep their own accounts.
- A doctor may belong to one accepted clinic at a time.
- Doctors and clinics can find each other through simple in-app search.
- A doctor can request to join a clinic. A clinic can invite a doctor. The receiving side is notified and must accept.
- Both the clinic and the accepted doctor can edit that doctor's schedules, exceptions, and appointment states.
- Patient booking order is clinic first, then doctor, then date/time, then confirmation.
- Patient search supports both doctor and clinic results.
- If a patient starts from a doctor result, booking opens that doctor's clinic path with the doctor preselected.
- Doctors without an accepted clinic are visible to patients, but not bookable.
- Clinics without accepted doctors are visible to patients, but not bookable.
- Appointments only happen through a clinic.
- If the clinic is unavailable, all doctors are unavailable. If one doctor is unavailable, the clinic stays available when another doctor is available. If the clinic has only that unavailable doctor, the clinic appears unavailable.
- If a membership ends, future confirmed appointments for that doctor at that clinic are cancelled automatically and patients receive a notification with the reason.
- Do not introduce pricing or finance features in this redesign.
- Preserve the current Nabdh visual theme: Arabic-first, calm, official, fast, restrained blue accent, no decorative redesign.

## Data Model

`users.role` expands to `patient | doctor | clinic`. `users.gender` becomes optional so clinic accounts do not need patient/doctor demographic fields.

`clinics` becomes the public clinic profile table. Existing doctor-owned clinic fields stay compatible during migration, but new clinic accounts write `ownerUserId` and do not require `doctorId` or address. Clinic rows keep `name`, `phone`, `wilayaId`, `isActive`, and optional `email`, `emailNormalized`, `address`, `latitude`, `longitude`, and `mapUrl`.

`clinicMemberships` links one doctor to one clinic:

- `clinicId`
- `doctorId`
- `requestedBy: doctor | clinic`
- `status: pending | accepted | rejected | cancelled | ended`
- timestamps for created, updated, accepted, and ended states

The acceptance mutation enforces that a doctor has at most one accepted membership. Ending a membership cancels future confirmed appointments for that doctor at that clinic and sends patient notifications.

`schedules` and `scheduleExceptions` add optional `doctorId`. New schedule and exception writes for booking availability are doctor-scoped. Clinic-level unavailability is represented by `clinics.isActive === false` and clinic-level exceptions with no `doctorId`.

`bookings` continues to store both `clinicId` and `doctorId`, because appointments are still assigned to a doctor while always being made through a clinic.

## Backend APIs

`users.registerAccount` supports `clinic` registration with `clinicName`, `phone`, `wilayaId`, optional `email`, optional `address`, and optional map location fields.

`clinics` adds public list/search/detail APIs for patient clinic discovery and booking context. Existing doctor-owned clinic APIs stay as transitional compatibility where possible, but clinic-owned APIs become the main path.

`clinicMemberships` provides:

- doctor sends join request to clinic
- clinic sends invite to doctor
- receiver accepts
- receiver rejects
- requester cancels pending request
- doctor leaves accepted clinic
- clinic removes doctor
- list my requests/invites/memberships

`schedules` supports doctor-scoped operations from both accepted doctor and owning clinic. A clinic can also create clinic-level closure exceptions.

`bookings.getAvailableSlots` accepts `clinicId`, `doctorId`, and `date`, then evaluates clinic availability, accepted membership, clinic closure, doctor closure, doctor schedule, and existing bookings. `bookings.create` validates the same relationship before inserting.

Doctor worklist queries continue to show the accepted doctor's appointments. Clinic worklist queries show appointments for all accepted doctors in that clinic, with optional doctor filtering.

## Frontend Flow

Auth:

- Home role screen shows Patient, Doctor, Clinic.
- Clinic register/login screens mirror the existing phone/password flow.
- Finalize registration routes clinic accounts to a new clinic app group.

Patient:

- Search includes a segmented control for doctors and clinics.
- Clinic results show clinic name, wilaya, optional address, and whether booking is currently available.
- Doctor results remain visible even without clinic membership. Their booking CTA is disabled unless an accepted clinic exists.
- Booking screen `booking/clinic` becomes the clinic/doctor selection step. It receives `clinicId` and optional `doctorId`.
- Date/time and confirmation require both `clinicId` and `doctorId`.

Doctor:

- Doctor dashboard/schedule/appointments remain visible for accepted doctors.
- If the doctor has no accepted clinic, operational screens show a clear membership-required state and entry points to search clinics and view incoming invites.
- Doctor can send clinic join requests, accept/reject invites, and leave a clinic.

Clinic:

- New clinic tab group: dashboard, doctors, appointments, schedule, profile/settings.
- Doctors tab supports searching doctors, sending invites, accepting incoming doctor requests, and removing accepted doctors.
- Schedule tab lets clinic staff select a doctor and edit that doctor's schedule/exceptions. It also exposes clinic-level availability/closure.
- Appointments tab lists all clinic appointments, with filtering by doctor and status.
- Profile/settings edits clinic name, phone, wilaya, optional email, optional address, optional Google Maps link, notification toggles, and account actions.

## UI Direction

Keep the current component vocabulary: Cairo/Inter fonts, `theme.colors.background`, `surface`, `official`, `primary`, restrained borders, compact operational rows, and bottom tabs. Use icons only where they clarify standard actions. Avoid a marketing-style redesign, nested cards, decorative medical illustrations, pricing rows, or commune fields.

## Testing

Backend tests cover role registration, membership request/accept/reject/end, single accepted clinic per doctor, slot availability layering, booking validation, and auto-cancellation notifications.

Frontend/source tests cover clinic auth routes, root role routing, patient search mode, booking route parameters, doctor membership-required state, clinic tab routes, and removal of commune/pricing copy from touched flows.
