# Patient Upcoming Appointment Modal Design

## Summary

When a patient taps the upcoming appointment card on the home screen, the app should open a centered modal with a ticket-style appointment details card. The design should feel cleaner and more formal than the current compact preview card, while staying mobile-first and readable on small screens.

This modal is view-only in the first version. It is meant to help the patient quickly review the appointment details in one place.

## Goals

- Present the upcoming appointment in a clearer, more complete layout.
- Use the provided visual direction as inspiration without copying it literally.
- Keep the modal compact enough for phone screens.
- Preserve Arabic-first RTL readability.

## Out of Scope

- Copy appointment number action
- Share action
- Real QR generation
- Doctor photo upload or real image support
- Editing, cancelling, or rescheduling from this modal

## Entry Point

- Surface: patient home screen
- Trigger: tapping the existing upcoming appointment card

## Behavior

- Tapping the upcoming appointment card opens a centered modal above a dimmed backdrop.
- Tapping outside the modal closes it.
- A close affordance inside the modal also closes it.
- The current home screen remains visible behind the overlay.

## Modal Content

The modal contains one main appointment ticket card with these sections:

1. Date and time column
   - Strong visual treatment for the date
   - Time shown clearly below it

2. Main appointment body
   - Placeholder avatar area
   - Doctor name
   - Specialty
   - Clinic name
   - Clinic address if available

3. Footer details
   - Appointment number area
   - QR placeholder block
   - Reminder note telling the patient to arrive early

## Content Rules

- Do not show appointment count.
- Do not show the phrase "medical appointment".
- Use a placeholder/avatar instead of a real doctor photo for now.
- Use existing appointment data where available.
- If clinic address is missing, show the clinic name only and keep the layout stable.

## Visual Direction

- Inspired by the provided reference image:
  - clean white ticket card
  - strong structured layout
  - visually distinct date/time column
  - clear appointment number area
  - QR block near the bottom
- Adapted to the current product design system:
  - existing theme colors
  - existing typography
  - existing spacing rhythm
  - moderate border radius suited to app UI

## Accessibility

- Modal must be dismissible without precision tapping.
- Text contrast should meet current app standards.
- Layout must remain readable on narrow mobile screens.
- Long doctor or clinic names should wrap cleanly without clipping.

## Implementation Notes

- Keep the existing compact appointment card on the home screen as the entry preview.
- Add local modal state to the patient home screen.
- Build the modal card with existing React Native primitives and current theme tokens.
- Use a styled placeholder for the QR area rather than a generated image.

## Testing

- Verify the modal opens from the upcoming appointment card.
- Verify close by backdrop press and close button.
- Verify the modal still renders well with:
  - long doctor names
  - long clinic names
  - missing clinic address
  - small mobile viewport
