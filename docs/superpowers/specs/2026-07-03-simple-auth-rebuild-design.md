# Simple Auth Rebuild Design

## Goal

Rebuild Nabdh authentication from scratch around a simple, Arabic-only, role-first flow. Remove onboarding slides, Google OAuth, Convex Auth password flow, profile-completion detours, French/i18n support, and old mock-era auth complexity.

The MVP has two public roles only:

- Patient
- Doctor

The user chooses a role before auth. Patient and doctor have separate login/register routes and the selected role must match the account role. Once an account is created, its role is permanent. A future account deletion feature can allow a user to create a new account with a different role.

## Decisions

- Remove Google sign-in/sign-up entirely for now.
- Add Google later only for doctor onboarding and review identity.
- Remove onboarding slides entirely.
- Root `/` becomes the role-choice screen.
- Public entry shows two cards: Patient and Doctor, Arabic copy, icons, no marketing slides.
- Keep the current visual style as much as possible; no redesign in this rebuild.
- Keep global RTL forced.
- Remove French everywhere in MVP.
- Remove i18next, `languageStore`, language switching, French locale files, and related tests.
- Use direct Arabic strings.
- Keep Clerk as the only auth/session provider.
- Remove `@convex-dev/auth` password flow and auth routes from app usage.
- Convex stores Nabdh account/profile data and maps to Clerk identity.
- Delete old non-reference mock/domain data after the new schema/functions deploy.
- Keep reference data required by the app: `specialties`, `wilayas`, and `communes`.
- Delete Clerk users manually from the correct Clerk dashboard during final cleanup, after verifying the instance.

## Route Structure

New routes:

- `/`: role choice
- `/(auth)/patient/login`
- `/(auth)/patient/register`
- `/(auth)/doctor/login`
- `/(auth)/doctor/register`
- `/(patient)`: patient app shell
- `/(doctor)/dashboard`: doctor app shell

Deleted routes:

- `/(auth)/onboarding`
- `/(auth)/login`
- `/(auth)/register`
- `/complete-profile`
- `/sso-callback`

The old auth files are replaced, not patched in place. Expo Router should not keep hidden obsolete auth routes.

## Role Choice Persistence

The pre-auth selected role is stored in `AsyncStorage`.

- It survives app restarts.
- It is highlighted on the role-choice screen.
- Logout returns to role choice and keeps the stored role highlighted.
- A user can change the selected role before login/signup.
- After signup, backend account role is permanent and cannot be changed in-app.

## Registration Fields

Patient registration:

- Full name
- Gender
- Phone number, required
- Email, optional
- Password
- Confirm password

Doctor registration:

- Full name
- Gender
- Specialty, required from Convex `specialties`
- Phone number, required
- Email, optional
- Password
- Confirm password

Removed from signup:

- Wilaya
- Commune
- Date of birth
- Doctor registration/order number
- French name
- Google profile completion fields

Registration creates the core Convex profile immediately:

- Patient: `users` row plus `patients` row
- Doctor: `users` row plus `doctors` row

After registration:

- Patient routes to `/(patient)`
- Doctor routes to `/(doctor)/dashboard`

## Login Rules

Login uses phone + password only in this rebuild.

- Phone is required for every account.
- Email is optional and not a login identifier yet.
- Email login can be added later.
- Login route is role-specific.
- If credentials are correct but role mismatches the chosen login path, show a clear role mismatch error and keep the user on that screen.

Phone handling:

- Store `phone` exactly as typed, after trimming leading/trailing spaces.
- Store `phoneNormalized` for duplicate checks.
- Store `phoneLoginKey` as an internal normalized Clerk username/login key.
- Do not show `phoneLoginKey` to users.
- Duplicate checks treat local Algerian mobile formats and `+213` formats as the same number.
- Login asks for the display phone format. The app converts it to `phoneLoginKey` for Clerk, then verifies the signed-in Convex user still matches the selected role and stored display `phone` value.
- No confirm-phone field.

Phone validation:

- Accept Algerian mobile numbers.
- Accept local `05`, `06`, `07` formats.
- Accept `+213` mobile format.

Email handling:

- Email is optional for both roles.
- Store display email when provided.
- Store `emailNormalized` when provided.
- Enforce global uniqueness only for provided emails.
- Blank email is allowed for multiple users.

Password:

- Minimum 8 characters.
- Clerk stores and verifies passwords.

Duplicate account rules:

- `phoneNormalized` is globally unique for now.
- Provided `emailNormalized` is globally unique for now.
- Users cannot sign up with the same phone or email in another role unless the original account is deleted later.
- If signup uses a phone/email already registered, block signup and offer a redirect to the existing role's login.

## Clerk Integration

Clerk owns authentication sessions and password handling.

- Use `phoneLoginKey` as the Clerk username/identifier so spaces and `+213` formatting do not break Clerk authentication.
- Keep the user-facing phone display value in Convex as `phone`.
- Use password in Clerk.
- Do not use Clerk Google/OAuth code in this rebuild.
- Remove `useSSO`, `makeRedirectUri`, Google buttons, callback route, and Google tests.
- Convex auth mapping uses `ctx.auth.getUserIdentity().tokenIdentifier`.
- `users.tokenIdentifier` maps to Clerk `identity.tokenIdentifier`.

If Clerk username/password support needs dashboard configuration, setup must be verified before implementation is marked done.

## Convex Schema Direction

Simplify auth-related tables:

### `users`

Owns shared account identity:

- `tokenIdentifier`
- `fullName`
- `gender`
- `role`
- `phone`
- `phoneNormalized`
- `email`
- `emailNormalized`
- `isActive`

Remove from users:

- `fullNameAr`
- `fullNameFr`
- French-specific fields
- Convex Auth password assumptions
- public `clinic_admin` and `super_admin` auth paths from signup

### `patients`

Contains:

- `userId`
- `chronicDiseases`
- `allergies`

Medical arrays initialize empty.

Remove or make non-required from patient signup path:

- `dateOfBirth`
- `communeId`
- emergency contact fields

### `doctors`

Contains:

- `userId`
- `specialtyId`
- `subSpecialties`
- `bio`
- `yearsOfExperience`
- `languages`
- `consultationFee`
- `followUpFee`
- `avgRating`
- `totalReviews`

Defaults:

- `subSpecialties`: empty
- `bio`: empty
- `yearsOfExperience`: `0`
- `languages`: Arabic default
- fees: `0`
- ratings: `0`

Remove entirely:

- `isVerified`
- `isProfileComplete`
- `orderRegistrationNumber`
- `bioFr`

Doctor public visibility:

- Active user
- User role is doctor
- Doctor row exists
- Valid `specialtyId`

No verification badge. No profile-completion gate.

### Reference Tables

Remove French fields and rename Arabic fields to neutral names:

- `specialties.nameAr` -> `specialties.name`
- `wilayas.nameAr` -> `wilayas.name`
- `communes.nameAr` -> `communes.name`
- Remove `nameFr`

Keep these tables and their data. Do not empty them during auth cleanup.

## Domain Data Cleanup

After new schema/functions are deployed:

Delete old non-reference data:

- `users`
- `patients`
- `doctors`
- `patientProfiles`
- `clinics`
- `schedules`
- `scheduleExceptions`
- `bookings`
- `reviews`
- `patientFavorites`
- `notifications`
- `pushTokens`
- old auth/session/account tables from Convex Auth
- `doctorSettings`

Keep:

- `specialties`
- `wilayas`
- `communes`

Clerk users:

- Delete manually from the correct Clerk dashboard.
- Verify project/instance before deletion.
- Do not delete Clerk users until the new auth implementation is ready.

## Patient/Doctor App Compatibility

The auth rewrite must update dependent queries, components, and tests to match the simplified schema.

Known affected areas:

- Patient tabs currently redirect to onboarding for invalid auth; they should route to role choice or role-specific login.
- Doctor tabs currently redirect to onboarding for invalid auth; same change needed.
- Doctor cards currently show verified/unverified badge; remove.
- Doctor detail currently expects `isVerified`, `isProfileComplete`, `bioFr`, `nameFr`; update.
- Search/discovery currently uses specialty French search fields; update to Arabic-only `name`.
- Bookings and doctor worklists currently return French fields; update.
- Doctor profile currently edits French name/bio; remove.
- Favorites and search types currently include verification and French fields; update.
- Tests that assert onboarding slides, Google completion, French fields, or verification badges must be removed or rewritten.

Booking behavior:

- Doctor can appear publicly before clinic/schedule exists.
- Booking flow should show no available clinic/slots until the doctor configures clinic/schedule.

## Error Handling

Registration:

- Duplicate phone: show that this phone is already registered and offer redirect to the existing role login.
- Duplicate provided email: same behavior.
- Specialty list unavailable: doctor registration should show a blocking error because specialty is required from Convex.
- Password mismatch: inline error.
- Password too short: inline error.
- Invalid phone: inline error.

Login:

- Invalid phone/password: generic invalid credentials.
- Correct credentials but wrong selected role: role mismatch error and stay on current role login.

Session:

- Existing logged-in session routes by backend account role.
- Missing/invalid session routes to root role choice.

## Testing Requirements

Write failing tests before implementation changes.

Required coverage:

- Route tree: no onboarding, no complete-profile, no sso-callback, new role-specific auth routes exist.
- Root role choice: stores selected role, highlights last selected role.
- Auth screens: no Google imports/buttons, no i18next, no French copy.
- Patient register fields and validation.
- Doctor register fields and validation, including Convex specialties.
- Phone normalization helper tests for Algerian mobile formats.
- Duplicate phone/email Convex mutation tests.
- Role mismatch login behavior tests.
- Convex schema/query tests for removed fields: no `isVerified`, no `isProfileComplete`, no French fields.
- Doctor discovery tests: active doctor with specialty is public.
- Booking tests: doctor with no clinic/schedule appears but has no slots.
- Cleanup tool tests or dry-run checks before any destructive data operation.

## Implementation Order

1. Write the implementation plan.
2. Add failing tests for the new route/auth/schema behavior.
3. Update Convex schema and helpers.
4. Update Clerk-based auth flow and role-specific screens.
5. Remove Google, onboarding, complete-profile, Convex Auth usage, i18next, French fields/state.
6. Update patient/doctor app queries/components for simplified data shapes.
7. Run tests and typecheck.
8. Deploy Convex schema/functions.
9. Run non-reference data cleanup only after deployment succeeds.
10. Manually delete Clerk users from the verified Clerk dashboard.
11. Run Expo/phone smoke test.

## Out of Scope

- Google sign-in/sign-up.
- Google review identity.
- Doctor verification/admin review.
- Account deletion implementation.
- New visual redesign.
- Email login.
- Same phone across roles.
- OTP.
- Payments, delivery, chat, or broader product work.
