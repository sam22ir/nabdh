# Nabdh

Nabdh is an Expo SDK 56 React Native app for medical appointment booking in Algeria.
It uses Expo Router, Convex backend, Clerk authentication, and an Arabic-first RTL UI.

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
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key consumed by the Expo client.
- `CLERK_JWT_ISSUER_DOMAIN`: Clerk Frontend API URL from the Clerk Convex integration page. Set it in Convex with `npx convex env set CLERK_JWT_ISSUER_DOMAIN <url>`.

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

## Push Notifications

In-app notification rows are stored in Convex. Remote push delivery uses `expo-notifications`, Expo push tokens, and the Convex `pushDelivery` internal action.

For Expo SDK 56, Android push notifications require a development build or production build; Expo Go on Android does not support remote push. Configure EAS project credentials before validating device delivery. Expo web remains a no-op for push registration.

## Backend Status

Convex backend is the active backend for data, auth, scheduling, bookings, reviews, and notifications.
Supabase files are legacy reference only and should not be deployed for this app.
