# Nabdh | نبض

Nabdh is an Arabic-first mobile app for finding and managing medical appointments in Algeria. It brings patients, doctors, and clinics into one scheduling flow built around real clinic availability.

The app is built with Expo and React Native, and is currently under active development.

## What Nabdh Does

### For patients

- Discover doctors and clinics by specialty and location.
- Review doctor profiles, clinic details, availability, and patient reviews.
- Book an appointment through a clinic: choose the clinic, doctor, date, and time.
- Track upcoming, past, and cancelled appointments.
- Save favorite doctors and receive in-app appointment updates.

### For doctors

- Build a professional profile and join a clinic through an invitation or request workflow.
- Manage clinic-specific schedules and availability exceptions.
- View daily, weekly, and monthly appointment worklists.
- Update appointment states, add doctor notes, and review appointment history.
- Control booking and notification preferences.

### For clinics

- Create a public clinic profile with location and contact details.
- Invite doctors, review incoming membership requests, and manage active members.
- Configure clinic closures and doctor schedules.
- Manage appointments across the clinic and filter them by doctor or status.

## How Booking Works

Appointments always belong to a clinic and a doctor. Nabdh checks the clinic's status, the doctor's accepted clinic membership, schedule exceptions, and existing bookings before offering a time slot.

```text
Patient -> Clinic -> Doctor -> Date and time -> Appointment confirmation
```

Doctors and clinics can each manage the appointment workflow once a doctor has an accepted clinic membership. If that membership ends, affected future appointments are cancelled and patients are notified.

## Product Principles

- Arabic-first, right-to-left experience designed for Algerian users.
- Operational scheduling rather than a directory-only experience.
- Clear roles and permissions for patients, doctors, and clinics.
- Calm, mobile-focused interface using Cairo and Inter typography.

## Technology

| Area | Stack |
| --- | --- |
| Mobile app | Expo SDK 56, React Native, Expo Router |
| Authentication | Clerk |
| Backend and real-time data | Convex |
| Forms and validation | React Hook Form, Zod |
| Notifications | Expo Notifications and Convex actions |
| Monitoring | Sentry |
| Testing | Vitest and TypeScript |

## Project Structure

```text
app/        Expo Router screens for auth, patient, doctor, and clinic flows
convex/     Convex schema, queries, mutations, scheduled jobs, and tests
src/        Shared UI components, state, validation, and app utilities
assets/     Application icons, splash assets, and bundled fonts
```

## Getting Started

### Prerequisites

- Node.js and npm
- An Expo-compatible Android, iOS, or web environment
- A Convex project
- A Clerk application

### Install and configure

```bash
npm install
cp .env.example .env.local
```

Set the values in `.env.local` for your Convex deployment, Convex URL, and Clerk publishable key. Configure the Clerk issuer in Convex as well:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN <your-clerk-frontend-api-url>
npx convex dev
```

Keep `npx convex dev` running during local development so the generated Convex API stays in sync.

### Run the app

```bash
npm run web
```

For native development:

```bash
npm run android
npm run ios
```

## Environment Variables

The complete local template is in [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `CONVEX_DEPLOYMENT` | Convex deployment used by the local CLI |
| `EXPO_PUBLIC_CONVEX_URL` | Public Convex URL used by the Expo app |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk key used by the Expo app |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk issuer configured in Convex |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional client-side Sentry DSN |

Never commit real credentials. `.env`, `.env.local`, and other local environment files are ignored by Git.

## Development Data

The demo data lives in Convex. The internal seed mutation is `internal.seed.seed`; run it from the Convex dashboard or through an authenticated Convex development workflow. It creates sample locations, specialties, clinics, doctors, schedules, appointments, reviews, and favorites.

## Quality Checks

```bash
npm test
npm run typecheck
npx expo-doctor
```

## Notifications

Nabdh stores in-app notifications in Convex and can deliver remote notifications through Expo push tokens. On Android with Expo SDK 56, remote push notifications require a development or production build; Expo Go does not support this delivery path.

## Backend

Convex is the active backend for authentication integration, scheduling, appointments, clinic membership, reviews, favorites, and notifications. Supabase-related files are retained only as legacy reference and should not be deployed for Nabdh.
