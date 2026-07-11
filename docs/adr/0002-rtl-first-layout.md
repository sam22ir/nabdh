# ADR 0002: RTL-first layout strategy

**Status:** Accepted
**Date:** 2026-06-06

## Context

نبض targets Algerian Arabic-speaking users (94%+ of the market). The app displays Arabic (RTL) content alongside French (LTR) content. React Native defaults to LTR layout. Every component, animation, and text input must be built with RTL awareness.

## Decision

All layout code is authored **RTL-first**:

- Use `start`/`end` directional variants (`paddingStart`, `marginEnd`) instead of `left`/`right` in all `StyleSheet` definitions
- `textAlign: 'right'` default for Arabic-mode `TextInput`
- Expo Router stack navigators configured with `gestureDirection: 'rtl'`
- Icons and directional arrows mirrored via `I18nManager.isRTL`
- French content blocks explicitly set `writingDirection: 'ltr'` and `textAlign: 'left'`
- RTL correctness verified on a physical Android device running Arabic locale before merge

## Alternatives considered

1. **LTR-first, flip with I18nManager** — simpler development but produces subtle layout bugs (animations, absolute positioning, drawer gestures) that are hard to diagnose on real devices
2. **Separate RTL/LTR components** — doubles the component surface; not viable for a solo developer

## Consequences

- All components must be reviewed for RTL before merge
- French/numeric rendering requires explicit LTR overrides on a per-element basis
- iOS RTL behavior is forgiving; Android RTL on Arabic locale is strict — testing must happen on Android
- Future contributors must understand and follow RTL-first conventions
