# Nabdh Frontend Redesign Design

## Summary

Redesign the high-visibility Nabdh patient experience around the confirmed product direction: calm, official, fast. The first production slice covers the shared visual system, onboarding, patient home, search, empty/loading states, and doctor cards.

## Design Direction

Use a restrained product palette. The app should stay light because patients and doctors are using phones in clinics, waiting rooms, homes, and daylight conditions where legibility matters more than atmosphere.

Avoid generic blue hospital UI, childish emoji onboarding, decorative medical illustrations, oversized rounded cards, and soft SaaS dashboard styling. Trust should come from clear doctor data, clinic context, appointment status, availability, verification, and predictable actions.

## Scope

Production-ready first pass for the patient entry and discovery flow:

- Shared `theme` tokens for official surfaces, text hierarchy, focus, and semantic states.
- Shared UI primitives for buttons, badges, panels, app headers, loading states, and trust rows.
- Onboarding redesigned around icon-led official slides and role selection.
- Patient home redesigned around next appointment, specialties, and nearby doctors.
- Search and doctor card surfaces aligned to the shared system.

Doctor dashboard/profile/schedule screens follow after this slice using the same system.

## Key States

- Loading states should be clear and official, not only a centered spinner.
- Empty states should teach the next action.
- Status labels should use text and icon support, not color alone.
- Arabic RTL and French-length strings must wrap without overlapping.
- Touch targets should remain comfortable on smaller Android devices.

## Implementation Notes

Keep the implementation inside the current Expo SDK 56 React Native app. Use `StyleSheet`, existing Cairo/Inter fonts, Expo Router, and Ionicons. Do not introduce another design framework or icon set.

The worktree already contains unrelated backend/profile changes, so keep redesign edits scoped to frontend/theme/component files.
