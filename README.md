# Nabdh

Nabdh is an Expo SDK 56 React Native app for medical appointment booking in Algeria.
It uses Expo Router, Convex backend, Convex Auth, and an Arabic-first RTL UI.

## Requirements

- Node.js and npm
- Expo CLI through `npx expo`
- Convex CLI through `npx convex`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment files from the template:

```bash
cp .env.example .env.local
```

3. Configure Convex:

```bash
npx convex dev
```

Keep `npx convex dev` running while developing so generated Convex APIs and backend functions stay current.

## Environment

Required variables are documented in `.env.example`.

- `CONVEX_DEPLOYMENT`: Convex deployment name for local development.
- `EXPO_PUBLIC_CONVEX_URL`: public Convex deployment URL consumed by the Expo client.
- `CONVEX_SITE_URL`: Convex Auth issuer/site URL used by `convex/auth.config.ts`.
- `JWT_PRIVATE_KEY` and `JWKS`: Convex Auth signing keys. Generate real values with the Convex Auth CLI and never commit them.

Local secret files such as `.env`, `.env.local`, and `.env*.local` are ignored by git.

## Development

Run the app:

```bash
npm run web
```

Other targets:

```bash
npm run android
npm run ios
```

## Seed Data

The active mock/demo dataset lives in Convex, not Supabase. The internal seed mutation is:

```text
internal.seed.seed
```

Run it from the Convex dashboard or with an authenticated Convex dev workflow. It seeds wilayas, communes, specialties, demo doctors, clinics, schedules, appointments, reviews, and favorites.

## Verification

Run the test suite:

```bash
npm test
```

Run TypeScript:

```bash
npm run typecheck
```

Run Expo project checks:

```bash
npx expo-doctor
```

## Backend Status

Convex backend is the active backend for data, auth, scheduling, bookings, reviews, and notifications.
Supabase files are legacy reference only and should not be deployed for this app.
