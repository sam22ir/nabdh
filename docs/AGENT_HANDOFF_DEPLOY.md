# Agent handoff: deploy the neutral-wording backend changes

## Status

The owner (Samir, personal Google Play developer account) asked for medical
wording to be replaced with neutral wording in the app, to improve the chance
of Google Play accepting it. That work is merged to `main` in
[PR #27](https://github.com/sam22ir/nabdh/pull/27):

- Arabic UI text: doctor/patient/clinic -> مختص/عميل/مركز, no "د." title prefix.
- Specialty names are neutralized **server-side** by `neutralSpecialtyName()` in
  `convex/lib/specialties.ts` (e.g. "طب القلب" -> "القلب"). No data migration.
- Push notification text and server error strings use the same vocabulary.

**Not done yet: the Convex backend has not been deployed.** The previous
session had no Convex credentials. Until it is deployed, production still
returns the old specialty names and old notification wording.

The owner has **explicitly authorized** you to run the production deploy. They
could not add credentials themselves, so ask them for exactly one thing if the
credentials below are missing (see "If you are blocked").

## What to do

1. `git checkout main && git pull origin main`
2. Install deps without touching the lockfile (it is out of sync with
   `package.json` - `react-native-worklets` is missing from it, pre-existing):
   `npm install --no-save --no-package-lock --legacy-peer-deps`
3. Read `convex/_generated/ai/guidelines.md` (required by `CLAUDE.md`).
4. Confirm credentials exist: `CONVEX_DEPLOY_KEY` must be set in the
   environment (a **production** deploy key). Do not print its value.
   Also confirm the network allows `*.convex.cloud` / `*.convex.site`.
5. Deploy: `npx convex deploy` (non-interactive with the deploy key).
   Do not run `npx convex dev` and do not use `--yes` flags that wipe data.
6. Verify (read-only):
   - Specialty list returns neutral names (no "طب" prefix).
   - A new booking notification reads "مختص"/"مركز", not "طبيب"/"عيادة".
7. Report to the owner what was deployed and the verification result.

## If you are blocked

- No `CONVEX_DEPLOY_KEY`: tell the owner to add it as an environment variable
  in the cloud environment settings (environment menu in the session title bar
  -> Edit). Generate it in the Convex dashboard under
  Settings -> URL & Deploy Key (production). **Never ask them to paste the key
  into chat.** A new session picks it up.
- Network denied for a Convex host: tell the owner which host, and ask them to
  allow it under Network access -> Custom -> Allowed domains.
- The owner said they cannot do either. Then stop and say so; do not try to
  work around missing credentials. The fallback is the owner running
  `npx convex deploy` from an up-to-date `main` on their own machine.

## Do not

- Do not change production data or run seed/destructive mutations.
- Do not commit any key, token or `.env` file.
- Do not open a PR for this document unless the owner asks.

## Other open items for the owner (not agent work)

- Rewrite the Arabic Play Store listing text and screenshots to match the
  neutral wording (listing lives in Play Console, not in this repo).
- Answer the Health apps declaration accurately.
- Build and upload a new release (strings are in the app bundle).
- Google may still require an organization account for a doctor-booking app;
  if rejected again, read the exact reason under Play Console -> Policy status.
