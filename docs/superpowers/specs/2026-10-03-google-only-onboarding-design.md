# Google-only onboarding (agreed with the owner, 2026-10-03)

Status: **agreed in chat, not built.** Open points at the bottom need an answer
before implementation starts. Supersedes the Clerk email/password flow and
`2026-07-01-google-auth-profile-completion-plan.md`.

## Principles
- The only way to sign in is **Continue with Google**. No email, password,
  phone login, captcha or email code.
- The user chooses a role **first** (three cards), then signs in with Google.
- Returning users: the role stored on the account wins over the card tapped;
  show a one-line notice if they differ.
- Continuing = accepting the Terms and Privacy Policy. Show the notice with
  links under the button (no checkbox). Store `terms_version`,
  `privacy_version`, `legal_accepted_at` at onboarding.
- No gender anywhere in sign-up (column stays nullable, unused).
- Phone number is **optional for every role** and never blocks onboarding.
- The display name comes from the Google account and can be edited later in
  the profile.
- iOS / Sign in with Apple: not now (Android first).

## Per role
| Role | Asked after Google |
|---|---|
| Client | Nothing. Straight into search. |
| Specialist | Specialty + wilaya, then the "do you work alone?" pop-up. |
| Center | Center name + wilaya. Location (optional, see below). Phone optional. |

### Center location (two ways, no Google Maps)
1. **Use my current location** (device GPS, foreground permission only); the
   position becomes the center's location after a confirm step.
2. **Pick on a map**: pop-up OpenStreetMap map, the user moves the pin and
   confirms.
Stored in `clinics.latitude/longitude`. Map UI: WebView + Leaflet with OSM
tiles (no API key, works on Android and web). Attribution is shown. The public
OSM tile server has a fair-use policy; switch tile provider if traffic grows.

### Solo specialist
- After creating a specialist account, a pop-up asks: **"Do you work alone?"**
- If yes: the app creates a **solo center** owned by the same account
  (name defaults to the specialist's name, editable; wilaya copied; location
  optional), plus an accepted membership so the specialist is bookable
  immediately. One Google account holds **both roles**.
- **Settings has a "switch role" button** (specialist view <-> center view).
- Solo centers are hidden from the public "centers" list; patients find the
  practice through the specialist's card. A solo center cannot "leave" itself.
- If no: normal path, join centers later (search + request or accept invite).

### Role rules
- Clients: one role per Google account.
- Centers: one role per Google account.
- Specialists: one role, **plus** one solo center if they choose it.
- Deleting the account deletes both roles' data.

## Data-model changes needed (Supabase)
- `clinics.is_solo boolean`, unique partial index: one solo clinic per owner.
- `clinics.phone` becomes nullable.
- `create_solo_practice()` security definer function: only a doctor, only once;
  inserts the clinic, accepted membership, `clinic_settings`.
- `profile_private.phone` already optional. Drop gender from sign-up code.
- Dual-role presentation: `users.me` returns the specialist account normally;
  when the device's active mode is "center" and the account owns a solo
  center it presents the center profile, so existing center screens work
  unchanged. Active mode is stored on the device.

## Later phase (agreed "ok")
- Center invites a specialist with a WhatsApp share link + code.

## Open points
1. Is the center **location required or optional**? (Proposed: optional, nudged
   from a checklist, since search is by wilaya.)
2. How patients **open** a center's location: proposed `geo:` link (opens
   whatever maps app is installed) with an OSM link fallback, replacing the
   current "open in Google Maps" button.
3. **Default schedule** for new specialists (Sun-Thu 09:00-16:00, 30 min,
   one-tap confirm). Assumed yes.
4. **Play Console:** device location must be declared in Data safety and
   mentioned in the privacy policy.
5. With phone optional everywhere, appointment reminders rely on push
   notifications only.
