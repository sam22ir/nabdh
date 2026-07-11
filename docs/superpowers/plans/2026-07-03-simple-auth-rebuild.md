# Simple Auth Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current onboarding/Google/profile-completion auth system with a simple Arabic-only role-first Clerk + Convex auth flow for patients and doctors.

**Architecture:** Expo Router owns route boundaries, Clerk owns sessions/passwords, and Convex owns Nabdh account/profile rows keyed by `identity.tokenIdentifier`. The root route becomes role choice; role-specific auth routes create or verify Clerk sessions, then Convex creates or reads immutable-role profile data. Existing app screens are updated to consume the simplified Arabic-only schema.

**Tech Stack:** Expo SDK 56, Expo Router, React Native, Clerk Expo, Convex, Vitest, convex-test, AsyncStorage.

---

## Required Reading Before Code

- `AGENTS.md`: Expo SDK 56 and Convex guidance.
- `https://docs.expo.dev/versions/v56.0.0/`: versioned Expo docs.
- `convex/_generated/ai/guidelines.md`: Convex function/schema/test rules.
- `docs/superpowers/specs/2026-07-03-simple-auth-rebuild-design.md`: accepted product decisions.

## File Structure

Create:

- `src/lib/phone.ts`: Algerian phone display, normalized duplicate key, and Clerk login key helpers.
- `src/lib/roleSelection.ts`: AsyncStorage persistence for the pre-auth selected role.
- `src/lib/authFormValidation.ts`: shared patient/doctor form validation helpers.
- `app/(auth)/patient/login.tsx`: patient phone/password login.
- `app/(auth)/patient/register.tsx`: patient registration.
- `app/(auth)/doctor/login.tsx`: doctor phone/password login.
- `app/(auth)/doctor/register.tsx`: doctor registration with Convex specialties.
- `convex/cleanup.ts`: batched non-reference cleanup mutations with dry-run counts.
- `tests/app-routes/auth/roleRoutes.test.ts`: route tree and removed-route assertions.
- `tests/app-routes/auth/patientAuth.test.ts`: patient auth screen source assertions.
- `tests/app-routes/auth/doctorAuth.test.ts`: doctor auth screen source assertions.
- `src/lib/phone.test.ts`: phone helper tests.
- `src/lib/roleSelection.test.ts`: selected-role persistence tests.
- `src/lib/authFormValidation.test.ts`: field validation tests.
- `convex/cleanup.test.ts`: cleanup dry-run and batched delete tests.

Modify:

- `package.json`: remove unused i18n, Google auth session, and Convex Auth packages after code no longer imports them.
- `app/_layout.tsx`: remove `I18nextProvider` and i18n readiness gate; keep Clerk and Convex providers.
- `app/index.tsx`: replace redirect-only screen with role choice and signed-in role routing.
- `app/(auth)/_layout.tsx`: keep auth stack layout for nested patient/doctor routes.
- `convex/schema.ts`: remove `authTables`, simplify `users`, `patients`, `doctors`, and reference names.
- `convex/users.ts`: replace Google/profile-completion functions with Clerk identity account/profile functions.
- `convex/lib/auth.ts`: keep identity lookup by `tokenIdentifier`, update required role/profile helpers.
- `convex/doctors.ts`: remove verification/profile-completion and French fields from discovery.
- `convex/bookings.ts`, `convex/clinics.ts`, `convex/favorites.ts`, `convex/locations.ts`, `convex/schedules.ts`, `convex/specialties.ts`: update field names and role/profile assumptions.
- `src/lib/types.ts`: replace bilingual and verification fields with neutral Arabic-only types.
- `src/components/DoctorCard.tsx`: remove verified badge and French fallback logic.
- `app/(patient)/**/*.tsx`, `app/(doctor)/**/*.tsx`: update route guards and field names.
- `tests/app-routes/auth/login.test.ts`, `tests/app-routes/auth/register.test.ts`, `tests/app-routes/auth/onboarding.test.ts`, `tests/app-routes/auth/googleCompletion.test.ts`, `tests/app-routes/auth/ssoCallback.test.ts`, `tests/app-routes/indexRouting.test.ts`: replace old assertions with role-first auth assertions or delete obsolete test files.

Delete:

- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/onboarding.tsx`
- `app/complete-profile.tsx`
- `app/sso-callback.tsx`
- `src/lib/i18n.ts`
- `src/stores/languageStore.ts`
- `src/stores/languageStore.test.ts`
- `assets/locales/fr.json`

## Technical Decisions

- Convex `users.phone` stores the display phone after `trim()`.
- Convex `users.phoneNormalized` stores the duplicate key as `+2135XXXXXXXX`, `+2136XXXXXXXX`, or `+2137XXXXXXXX`.
- Convex `users.phoneLoginKey` stores the Clerk username key as `dz2135XXXXXXXX`, `dz2136XXXXXXXX`, or `dz2137XXXXXXXX`.
- Login forms convert the submitted phone to `phoneLoginKey` before calling Clerk.
- After Clerk signs in, the app calls Convex to verify selected role and display phone. If display phone or role mismatches, sign out and show the mismatch error.
- Optional email is stored as display `email` and normalized `emailNormalized`; blank email remains `undefined`.
- Role is immutable after Convex row creation.

---

### Task 1: Preflight And Guardrails

**Files:**
- Read: `AGENTS.md`
- Read: `convex/_generated/ai/guidelines.md`
- Read: `docs/superpowers/specs/2026-07-03-simple-auth-rebuild-design.md`
- Inspect: `git status --short`

- [ ] **Step 1: Confirm the working tree before implementation**

Run:

```bash
git status --short
```

Expected: existing modified auth files may be present. Do not revert files that predate this plan.

- [ ] **Step 2: Read project rules**

Run:

```bash
sed -n '1,220p' AGENTS.md
sed -n '1,520p' convex/_generated/ai/guidelines.md
sed -n '1,260p' docs/superpowers/specs/2026-07-03-simple-auth-rebuild-design.md
```

Expected: Expo SDK 56 docs requirement, Convex validator/index/auth rules, and the approved auth decisions are visible.

- [ ] **Step 3: Check Expo SDK alignment before editing**

Run:

```bash
npx expo install --check
```

Expected: either "Dependencies are up to date" or a concrete Expo-compatible package list to address before final verification.

- [ ] **Step 4: Commit the plan before implementation**

Run:

```bash
git add docs/superpowers/specs/2026-07-03-simple-auth-rebuild-design.md docs/superpowers/plans/2026-07-03-simple-auth-rebuild.md
git commit -m "docs: plan simple auth rebuild"
```

Expected: one docs commit. If unrelated dirty files exist, leave them unstaged.

---

### Task 2: Phone And Email Identity Helpers

**Files:**
- Create: `src/lib/phone.ts`
- Create: `src/lib/phone.test.ts`
- Modify: `src/lib/authIdentifiers.ts`
- Test: `src/lib/authIdentifiers.test.ts`

- [ ] **Step 1: Write failing phone helper tests**

Create `src/lib/phone.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildPhoneIdentity,
  normalizeOptionalEmail,
  validatePasswordPair,
} from "./phone";

describe("buildPhoneIdentity", () => {
  test.each([
    ["0555123456", "+213555123456", "dz213555123456", "0555123456"],
    ["  0555123456  ", "+213555123456", "dz213555123456", "0555123456"],
    ["05 55 12 34 56", "+213555123456", "dz213555123456", "05 55 12 34 56"],
    ["+213555123456", "+213555123456", "dz213555123456", "+213555123456"],
    ["+213 555 123 456", "+213555123456", "dz213555123456", "+213 555 123 456"],
    ["0666123456", "+213666123456", "dz213666123456", "0666123456"],
    ["0777123456", "+213777123456", "dz213777123456", "0777123456"],
  ])("normalizes %s", (raw, phoneNormalized, phoneLoginKey, phone) => {
    expect(buildPhoneIdentity(raw)).toEqual({
      phone,
      phoneNormalized,
      phoneLoginKey,
    });
  });

  test.each(["", "021123456", "0444123456", "+33123456789", "05551234"])(
    "rejects invalid Algerian mobile %s",
    (raw) => {
      expect(() => buildPhoneIdentity(raw)).toThrow(/phone/i);
    },
  );
});

describe("normalizeOptionalEmail", () => {
  test("keeps blank email empty", () => {
    expect(normalizeOptionalEmail("   ")).toEqual({
      email: undefined,
      emailNormalized: undefined,
    });
  });

  test("normalizes provided email for duplicate checks", () => {
    expect(normalizeOptionalEmail("  USER@Example.TEST  ")).toEqual({
      email: "USER@Example.TEST",
      emailNormalized: "user@example.test",
    });
  });
});

describe("validatePasswordPair", () => {
  test("accepts matching eight-character passwords", () => {
    expect(validatePasswordPair("12345678", "12345678")).toBeNull();
  });

  test("rejects short passwords", () => {
    expect(validatePasswordPair("1234567", "1234567")).toMatch(/8/);
  });

  test("rejects mismatched passwords", () => {
    expect(validatePasswordPair("12345678", "12345679")).toMatch(/match/i);
  });
});
```

- [ ] **Step 2: Run the failing helper tests**

Run:

```bash
npx vitest run src/lib/phone.test.ts
```

Expected: FAIL because `src/lib/phone.ts` does not exist.

- [ ] **Step 3: Implement phone helpers**

Create `src/lib/phone.ts`:

```ts
export type PhoneIdentity = {
  phone: string;
  phoneNormalized: string;
  phoneLoginKey: string;
};

export type OptionalEmailIdentity = {
  email: string | undefined;
  emailNormalized: string | undefined;
};

export function buildPhoneIdentity(raw: string): PhoneIdentity {
  const phone = raw.trim();
  const compact = phone.replace(/[\s().-]/g, "");
  const digits = compact.replace(/\D/g, "");

  let nationalDigits: string;
  if (/^0[567]\d{8}$/.test(digits) && !compact.startsWith("+")) {
    nationalDigits = digits.slice(1);
  } else if (/^213[567]\d{8}$/.test(digits) && compact.startsWith("+")) {
    nationalDigits = digits.slice(3);
  } else {
    throw new Error("Invalid Algerian mobile phone number");
  }

  return {
    phone,
    phoneNormalized: `+213${nationalDigits}`,
    phoneLoginKey: `dz213${nationalDigits}`,
  };
}

export function normalizeOptionalEmail(raw?: string): OptionalEmailIdentity {
  const email = raw?.trim() ?? "";
  if (email.length === 0) {
    return { email: undefined, emailNormalized: undefined };
  }

  const emailNormalized = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
    throw new Error("Invalid email address");
  }

  return { email, emailNormalized };
}

export function validatePasswordPair(
  password: string,
  confirmPassword: string,
): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password !== confirmPassword) {
    return "Passwords must match";
  }
  return null;
}
```

- [ ] **Step 4: Bridge old auth identifier imports**

Replace `src/lib/authIdentifiers.ts` with:

```ts
export {
  buildPhoneIdentity,
  normalizeOptionalEmail,
  validatePasswordPair,
} from "./phone";

export function normalizePhoneForAuth(raw: string): string {
  return buildPhoneIdentity(raw).phoneNormalized;
}

export function normalizeEmailForAuth(raw: string): string {
  const { emailNormalized } = normalizeOptionalEmail(raw);
  if (!emailNormalized) {
    throw new Error("Invalid email address");
  }
  return emailNormalized;
}
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
npx vitest run src/lib/phone.test.ts src/lib/authIdentifiers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/phone.ts src/lib/phone.test.ts src/lib/authIdentifiers.ts src/lib/authIdentifiers.test.ts
git commit -m "feat: add phone identity helpers"
```

---

### Task 3: Selected Role Persistence

**Files:**
- Create: `src/lib/roleSelection.ts`
- Create: `src/lib/roleSelection.test.ts`

- [ ] **Step 1: Write failing selected-role tests**

Create `src/lib/roleSelection.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getStoredAuthRole,
  setStoredAuthRole,
  AUTH_ROLE_STORAGE_KEY,
} from "./roleSelection";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

describe("role selection persistence", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("returns null when no role is stored", async () => {
    expect(await getStoredAuthRole()).toBeNull();
  });

  test("stores patient role", async () => {
    await setStoredAuthRole("patient");
    expect(storage.get(AUTH_ROLE_STORAGE_KEY)).toBe("patient");
    expect(await getStoredAuthRole()).toBe("patient");
  });

  test("stores doctor role", async () => {
    await setStoredAuthRole("doctor");
    expect(storage.get(AUTH_ROLE_STORAGE_KEY)).toBe("doctor");
    expect(await getStoredAuthRole()).toBe("doctor");
  });
});
```

- [ ] **Step 2: Run the failing selected-role tests**

Run:

```bash
npx vitest run src/lib/roleSelection.test.ts
```

Expected: FAIL because `src/lib/roleSelection.ts` does not exist.

- [ ] **Step 3: Implement selected-role persistence**

Create `src/lib/roleSelection.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AUTH_ROLE_STORAGE_KEY = "nabdh.selectedAuthRole";

export type PublicAuthRole = "patient" | "doctor";

export async function getStoredAuthRole(): Promise<PublicAuthRole | null> {
  const value = await AsyncStorage.getItem(AUTH_ROLE_STORAGE_KEY);
  return value === "patient" || value === "doctor" ? value : null;
}

export async function setStoredAuthRole(role: PublicAuthRole): Promise<void> {
  await AsyncStorage.setItem(AUTH_ROLE_STORAGE_KEY, role);
}
```

- [ ] **Step 4: Run selected-role tests**

Run:

```bash
npx vitest run src/lib/roleSelection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/roleSelection.ts src/lib/roleSelection.test.ts
git commit -m "feat: persist selected auth role"
```

---

### Task 4: Route Tree Tests For New Auth Shape

**Files:**
- Create: `tests/app-routes/auth/roleRoutes.test.ts`
- Modify: `tests/app-routes/indexRouting.test.ts`
- Delete or replace: old onboarding/Google route tests after new tests fail.

- [ ] **Step 1: Write failing route tree test**

Create `tests/app-routes/auth/roleRoutes.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const appPath = (...parts: string[]) => join(process.cwd(), "app", ...parts);

describe("role-first auth route tree", () => {
  test("has patient and doctor auth routes", () => {
    expect(existsSync(appPath("(auth)", "patient", "login.tsx"))).toBe(true);
    expect(existsSync(appPath("(auth)", "patient", "register.tsx"))).toBe(true);
    expect(existsSync(appPath("(auth)", "doctor", "login.tsx"))).toBe(true);
    expect(existsSync(appPath("(auth)", "doctor", "register.tsx"))).toBe(true);
  });

  test("removes old auth detour routes", () => {
    expect(existsSync(appPath("(auth)", "onboarding.tsx"))).toBe(false);
    expect(existsSync(appPath("(auth)", "login.tsx"))).toBe(false);
    expect(existsSync(appPath("(auth)", "register.tsx"))).toBe(false);
    expect(existsSync(appPath("complete-profile.tsx"))).toBe(false);
    expect(existsSync(appPath("sso-callback.tsx"))).toBe(false);
  });

  test("root is role choice and not onboarding redirect", () => {
    const source = readFileSync(appPath("index.tsx"), "utf8");
    expect(source).toContain("setStoredAuthRole");
    expect(source).toContain("/(auth)/patient/login");
    expect(source).toContain("/(auth)/doctor/login");
    expect(source).not.toContain("/(auth)/onboarding");
    expect(source).not.toContain("/complete-profile");
    expect(source).not.toContain("getProfileCompletionContext");
  });
});
```

- [ ] **Step 2: Run the failing route tree test**

Run:

```bash
npx vitest run tests/app-routes/auth/roleRoutes.test.ts
```

Expected: FAIL because the old routes still exist and new nested routes do not.

- [ ] **Step 3: Leave implementation for later tasks**

Do not delete route files in this task. The failing test is the guardrail for the route rewrite.

- [ ] **Step 4: Commit failing tests**

Run:

```bash
git add tests/app-routes/auth/roleRoutes.test.ts tests/app-routes/indexRouting.test.ts
git commit -m "test: define role-first auth routes"
```

Expected: commit can contain failing tests only if the team accepts red-green commits. If the repository policy rejects failing commits, defer this commit until Task 9 passes.

---

### Task 5: Convex Schema Rewrite

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/auth.ts`
- Modify: `convex/convex.config.ts`
- Test: `convex/users.test.ts`
- Test: `convex/specialties.test.ts`
- Test: `convex/locations.test.ts`

- [ ] **Step 1: Write schema source assertions**

Add to `convex/users.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("auth schema source", () => {
  test("uses Clerk identity fields and removes Convex Auth/French/profile gates", () => {
    const schemaSource = readFileSync(join(process.cwd(), "convex/schema.ts"), "utf8");
    expect(schemaSource).not.toContain("authTables");
    expect(schemaSource).toContain("tokenIdentifier: v.string()");
    expect(schemaSource).toContain("fullName: v.string()");
    expect(schemaSource).toContain("phoneNormalized: v.string()");
    expect(schemaSource).toContain("phoneLoginKey: v.string()");
    expect(schemaSource).toContain("emailNormalized: v.optional(v.string())");
    expect(schemaSource).not.toContain("fullNameFr");
    expect(schemaSource).not.toContain("nameFr");
    expect(schemaSource).not.toContain("isVerified");
    expect(schemaSource).not.toContain("isProfileComplete");
  });
});
```

- [ ] **Step 2: Run schema source assertion**

Run:

```bash
npx vitest run convex/users.test.ts --runInBand
```

Expected: FAIL while old schema fields are present.

- [ ] **Step 3: Replace schema auth/profile tables**

In `convex/schema.ts`, remove `authTables` import/spread and replace `users`, `patients`, `doctors`, `specialties`, `wilayas`, and `communes` definitions with:

```ts
users: defineTable({
  tokenIdentifier: v.string(),
  fullName: v.string(),
  gender: v.union(v.literal("male"), v.literal("female")),
  role: v.union(v.literal("patient"), v.literal("doctor")),
  phone: v.string(),
  phoneNormalized: v.string(),
  phoneLoginKey: v.string(),
  email: v.optional(v.string()),
  emailNormalized: v.optional(v.string()),
  isActive: v.boolean(),
})
  .index("by_tokenIdentifier", ["tokenIdentifier"])
  .index("by_phoneNormalized", ["phoneNormalized"])
  .index("by_phoneLoginKey", ["phoneLoginKey"])
  .index("by_emailNormalized", ["emailNormalized"])
  .index("by_role", ["role"]),

patients: defineTable({
  userId: v.id("users"),
  chronicDiseases: v.array(v.string()),
  allergies: v.array(v.string()),
}).index("by_userId", ["userId"]),

doctors: defineTable({
  userId: v.id("users"),
  specialtyId: v.id("specialties"),
  subSpecialties: v.array(v.id("specialties")),
  bio: v.string(),
  yearsOfExperience: v.number(),
  languages: v.array(v.string()),
  consultationFee: v.number(),
  followUpFee: v.number(),
  avgRating: v.number(),
  totalReviews: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_specialtyId", ["specialtyId"]),

specialties: defineTable({
  name: v.string(),
  icon: v.string(),
  parentId: v.optional(v.id("specialties")),
})
  .index("by_parentId", ["parentId"])
  .searchIndex("search_name", { searchField: "name" }),

wilayas: defineTable({
  id: v.number(),
  name: v.string(),
}).index("by_wilaya_code", ["id"]),

communes: defineTable({
  wilayaId: v.id("wilayas"),
  name: v.string(),
}).index("by_wilayaId", ["wilayaId"]),
```

Keep `clinics`, `schedules`, `scheduleExceptions`, `bookings`, `reviews`, `notifications`, `pushTokens`, and `patientFavorites` unless a later task explicitly deletes them. Remove `patientProfiles` and `doctorSettings` from the active schema when their usages are removed.

- [ ] **Step 4: Run codegen/typecheck to expose dependent breakage**

Run:

```bash
npx convex codegen
npm run typecheck
```

Expected: codegen succeeds or reports deployment env setup. Typecheck fails with old field references; those are handled in later tasks.

- [ ] **Step 5: Commit schema rewrite after tests pass in later tasks**

Do not commit this task until Tasks 6 through 12 compile against the new schema.

---

### Task 6: Convex Account Functions

**Files:**
- Modify: `convex/users.ts`
- Modify: `convex/lib/auth.ts`
- Modify: `convex/users.test.ts`
- Use: `src/lib/phone.ts` logic mirrored or shared through a Convex-safe helper.

- [ ] **Step 1: Write Convex duplicate and role tests**

Replace old Google/profile-completion tests in `convex/users.test.ts` with:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split("|").at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

async function seedSpecialty(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("specialties", {
      name: "طب القلب",
      icon: "heart-pulse",
    }),
  );
}

describe("users.registerAccount", () => {
  test("creates patient user and patient profile", async () => {
    const t = convexTest(schema, modules);

    await t.withIdentity(identity("clerk|patient-1")).mutation(api.users.registerAccount, {
      role: "patient",
      fullName: "مريض جديد",
      gender: "male",
      phone: "05 55 12 34 56",
      email: "",
    });

    const me = await t.withIdentity(identity("clerk|patient-1")).query(api.users.me, {});
    expect(me).toMatchObject({
      fullName: "مريض جديد",
      role: "patient",
      phone: "05 55 12 34 56",
      phoneNormalized: "+213555123456",
      phoneLoginKey: "dz213555123456",
      isActive: true,
      profile: {
        chronicDiseases: [],
        allergies: [],
      },
    });
  });

  test("creates doctor user and doctor profile", async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);

    await t.withIdentity(identity("clerk|doctor-1")).mutation(api.users.registerAccount, {
      role: "doctor",
      fullName: "طبيب جديد",
      gender: "female",
      phone: "+213666123456",
      email: " DOCTOR@Example.TEST ",
      specialtyId,
    });

    const me = await t.withIdentity(identity("clerk|doctor-1")).query(api.users.me, {});
    expect(me).toMatchObject({
      fullName: "طبيب جديد",
      role: "doctor",
      email: "DOCTOR@Example.TEST",
      emailNormalized: "doctor@example.test",
      profile: {
        specialtyId,
        bio: "",
        yearsOfExperience: 0,
        languages: ["العربية"],
        consultationFee: 0,
        followUpFee: 0,
        avgRating: 0,
        totalReviews: 0,
      },
    });
  });

  test("rejects duplicate normalized phone across roles", async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);

    await t.withIdentity(identity("clerk|patient-2")).mutation(api.users.registerAccount, {
      role: "patient",
      fullName: "مريض",
      gender: "male",
      phone: "0555123456",
      email: "",
    });

    await expect(
      t.withIdentity(identity("clerk|doctor-2")).mutation(api.users.registerAccount, {
        role: "doctor",
        fullName: "طبيب",
        gender: "male",
        phone: "+213555123456",
        email: "",
        specialtyId,
      }),
    ).rejects.toThrow(/phone.*registered/i);
  });

  test("rejects duplicate provided email across roles", async () => {
    const t = convexTest(schema, modules);
    const specialtyId = await seedSpecialty(t);

    await t.withIdentity(identity("clerk|patient-3")).mutation(api.users.registerAccount, {
      role: "patient",
      fullName: "مريض",
      gender: "male",
      phone: "0555123456",
      email: "same@example.test",
    });

    await expect(
      t.withIdentity(identity("clerk|doctor-3")).mutation(api.users.registerAccount, {
        role: "doctor",
        fullName: "طبيب",
        gender: "male",
        phone: "0666123456",
        email: " SAME@example.test ",
        specialtyId,
      }),
    ).rejects.toThrow(/email.*registered/i);
  });
});

describe("users.getLoginResolution", () => {
  test("returns target path for matching role and display phone", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(identity("clerk|patient-login")).mutation(api.users.registerAccount, {
      role: "patient",
      fullName: "مريض",
      gender: "male",
      phone: "05 55 12 34 56",
      email: "",
    });

    await expect(
      t.withIdentity(identity("clerk|patient-login")).query(api.users.getLoginResolution, {
        role: "patient",
        phone: "05 55 12 34 56",
      }),
    ).resolves.toEqual({ ok: true, redirectTo: "/(patient)" });
  });

  test("rejects wrong role", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(identity("clerk|patient-wrong-role")).mutation(api.users.registerAccount, {
      role: "patient",
      fullName: "مريض",
      gender: "male",
      phone: "0555123456",
      email: "",
    });

    await expect(
      t.withIdentity(identity("clerk|patient-wrong-role")).query(api.users.getLoginResolution, {
        role: "doctor",
        phone: "0555123456",
      }),
    ).resolves.toMatchObject({ ok: false, reason: "role_mismatch" });
  });

  test("rejects display phone mismatch after Clerk sign-in", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(identity("clerk|patient-phone-mismatch")).mutation(api.users.registerAccount, {
      role: "patient",
      fullName: "مريض",
      gender: "male",
      phone: "05 55 12 34 56",
      email: "",
    });

    await expect(
      t.withIdentity(identity("clerk|patient-phone-mismatch")).query(api.users.getLoginResolution, {
        role: "patient",
        phone: "0555123456",
      }),
    ).resolves.toMatchObject({ ok: false, reason: "phone_display_mismatch" });
  });
});
```

- [ ] **Step 2: Run failing Convex account tests**

Run:

```bash
npx vitest run convex/users.test.ts --runInBand
```

Expected: FAIL because `registerAccount` and `getLoginResolution` do not exist.

- [ ] **Step 3: Implement Convex auth helpers**

Update `convex/lib/auth.ts` so the core lookup uses `tokenIdentifier` only:

```ts
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function getOptionalAuthedUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

export async function getAuthedUser(ctx: Ctx) {
  const user = await getOptionalAuthedUser(ctx);
  if (!user) {
    throw new ConvexError("Authentication required");
  }
  return user;
}

export async function getAuthedUserId(ctx: Ctx) {
  return (await getAuthedUser(ctx))._id;
}
```

- [ ] **Step 4: Implement `registerAccount`, `me`, and `getLoginResolution`**

In `convex/users.ts`, expose:

```ts
export const registerAccount = mutation({
  args: {
    role: v.union(v.literal("patient"), v.literal("doctor")),
    fullName: v.string(),
    gender: v.union(v.literal("male"), v.literal("female")),
    phone: v.string(),
    email: v.string(),
    specialtyId: v.optional(v.id("specialties")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const phoneIdentity = buildPhoneIdentity(args.phone);
    const emailIdentity = normalizeOptionalEmail(args.email);

    const existingIdentityUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existingIdentityUser) {
      throw new ConvexError("Account already exists");
    }

    const phoneUser = await ctx.db
      .query("users")
      .withIndex("by_phoneNormalized", (q) =>
        q.eq("phoneNormalized", phoneIdentity.phoneNormalized),
      )
      .unique();
    if (phoneUser) throw new ConvexError("This phone is already registered");

    if (emailIdentity.emailNormalized) {
      const emailUser = await ctx.db
        .query("users")
        .withIndex("by_emailNormalized", (q) =>
          q.eq("emailNormalized", emailIdentity.emailNormalized),
        )
        .unique();
      if (emailUser) throw new ConvexError("This email is already registered");
    }

    if (args.role === "doctor") {
      if (!args.specialtyId) throw new ConvexError("Specialty is required");
      const specialty = await ctx.db.get(args.specialtyId);
      if (!specialty) throw new ConvexError("Specialty is required");
    }

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      fullName: args.fullName.trim(),
      gender: args.gender,
      role: args.role,
      phone: phoneIdentity.phone,
      phoneNormalized: phoneIdentity.phoneNormalized,
      phoneLoginKey: phoneIdentity.phoneLoginKey,
      email: emailIdentity.email,
      emailNormalized: emailIdentity.emailNormalized,
      isActive: true,
    });

    if (args.role === "patient") {
      await ctx.db.insert("patients", {
        userId,
        chronicDiseases: [],
        allergies: [],
      });
    } else {
      await ctx.db.insert("doctors", {
        userId,
        specialtyId: args.specialtyId!,
        subSpecialties: [],
        bio: "",
        yearsOfExperience: 0,
        languages: ["العربية"],
        consultationFee: 0,
        followUpFee: 0,
        avgRating: 0,
        totalReviews: 0,
      });
    }

    return { userId };
  },
});
```

Add `me` and `getLoginResolution` using `getOptionalAuthedUser(ctx)`, `patients.by_userId`, and `doctors.by_userId`. Return `"/(patient)"` for patient and `"/(doctor)/dashboard"` for doctor.

- [ ] **Step 5: Run Convex account tests**

Run:

```bash
npx vitest run convex/users.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add convex/schema.ts convex/lib/auth.ts convex/users.ts convex/users.test.ts
git commit -m "feat: add role-based Convex accounts"
```

---

### Task 7: Root Role Choice Screen

**Files:**
- Modify: `app/index.tsx`
- Test: `tests/app-routes/indexRouting.test.ts`
- Use: `src/lib/roleSelection.ts`

- [ ] **Step 1: Rewrite root routing tests**

Replace `tests/app-routes/indexRouting.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const indexSource = () =>
  readFileSync(join(process.cwd(), "app/index.tsx"), "utf8");

describe("root role choice", () => {
  test("renders role choice for signed-out users", () => {
    const source = indexSource();
    expect(source).toContain("اختر نوع الحساب");
    expect(source).toContain("مريض");
    expect(source).toContain("طبيب");
    expect(source).toContain("setStoredAuthRole");
    expect(source).not.toContain("/(auth)/onboarding");
    expect(source).not.toContain("/complete-profile");
  });

  test("routes signed-in users by backend role", () => {
    const source = indexSource();
    expect(source).toContain("api.users.me");
    expect(source).toContain("me.role === 'patient'");
    expect(source).toContain("router.replace('/(patient)')");
    expect(source).toContain("me.role === 'doctor'");
    expect(source).toContain("router.replace('/(doctor)/dashboard')");
  });
});
```

- [ ] **Step 2: Run failing root test**

Run:

```bash
npx vitest run tests/app-routes/indexRouting.test.ts
```

Expected: FAIL while root is redirect-only.

- [ ] **Step 3: Implement root role choice**

Replace `app/index.tsx` with a component that:

```tsx
const handleRolePress = async (role: PublicAuthRole) => {
  await setStoredAuthRole(role);
  router.push(`/(auth)/${role}/login`);
};
```

The screen must:

- Show Arabic title `اختر نوع الحساب`.
- Show two role buttons/cards: `مريض` and `طبيب`.
- Load stored role with `getStoredAuthRole()` and style the selected card.
- Use `useQuery(api.users.me, {})` only when Clerk is signed in.
- Route signed-in patient to `/(patient)`.
- Route signed-in doctor to `/(doctor)/dashboard`.
- Leave missing signed-in Convex profile on role choice and show Arabic session error.

- [ ] **Step 4: Run root route test**

Run:

```bash
npx vitest run tests/app-routes/indexRouting.test.ts tests/app-routes/auth/roleRoutes.test.ts
```

Expected: root tests pass; route tree test still fails until nested auth routes are created and old routes deleted.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/index.tsx tests/app-routes/indexRouting.test.ts
git commit -m "feat: add root role choice"
```

---

### Task 8: Shared Auth Form Validation

**Files:**
- Create: `src/lib/authFormValidation.ts`
- Create: `src/lib/authFormValidation.test.ts`

- [ ] **Step 1: Write failing auth validation tests**

Create `src/lib/authFormValidation.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  validateDoctorRegistration,
  validateLogin,
  validatePatientRegistration,
} from "./authFormValidation";

describe("auth form validation", () => {
  test("patient registration requires name, gender, phone, and password", () => {
    expect(
      validatePatientRegistration({
        fullName: "",
        gender: null,
        phone: "",
        email: "",
        password: "123",
        confirmPassword: "456",
      }),
    ).toMatchObject({
      fullName: expect.any(String),
      gender: expect.any(String),
      phone: expect.any(String),
      password: expect.any(String),
    });
  });

  test("doctor registration requires specialty", () => {
    expect(
      validateDoctorRegistration({
        fullName: "طبيب",
        gender: "male",
        specialtyId: null,
        phone: "0555123456",
        email: "",
        password: "12345678",
        confirmPassword: "12345678",
      }),
    ).toMatchObject({ specialtyId: expect.any(String) });
  });

  test("login requires phone and password", () => {
    expect(validateLogin({ phone: "", password: "" })).toMatchObject({
      phone: expect.any(String),
      password: expect.any(String),
    });
  });
});
```

- [ ] **Step 2: Run failing validation tests**

Run:

```bash
npx vitest run src/lib/authFormValidation.test.ts
```

Expected: FAIL because `authFormValidation.ts` does not exist.

- [ ] **Step 3: Implement validation helper**

Create `src/lib/authFormValidation.ts` with exported `validatePatientRegistration`, `validateDoctorRegistration`, and `validateLogin`. Use `buildPhoneIdentity`, `normalizeOptionalEmail`, and `validatePasswordPair`. Return an object whose keys are invalid field names and whose values are Arabic error messages:

```ts
const messages = {
  fullName: "الاسم مطلوب",
  gender: "اختر الجنس",
  phone: "رقم هاتف جزائري صحيح مطلوب",
  email: "البريد الإلكتروني غير صحيح",
  password: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
  confirmPassword: "كلمتا المرور غير متطابقتين",
  specialtyId: "اختر التخصص",
};
```

- [ ] **Step 4: Run validation tests**

Run:

```bash
npx vitest run src/lib/authFormValidation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/authFormValidation.ts src/lib/authFormValidation.test.ts
git commit -m "feat: add auth form validation"
```

---

### Task 9: Role-Specific Clerk Auth Screens

**Files:**
- Create: `app/(auth)/patient/login.tsx`
- Create: `app/(auth)/patient/register.tsx`
- Create: `app/(auth)/doctor/login.tsx`
- Create: `app/(auth)/doctor/register.tsx`
- Delete: `app/(auth)/login.tsx`
- Delete: `app/(auth)/register.tsx`
- Delete: `app/(auth)/onboarding.tsx`
- Delete: `app/complete-profile.tsx`
- Delete: `app/sso-callback.tsx`
- Test: `tests/app-routes/auth/patientAuth.test.ts`
- Test: `tests/app-routes/auth/doctorAuth.test.ts`
- Test: `tests/app-routes/auth/roleRoutes.test.ts`

- [ ] **Step 1: Write auth screen source tests**

Create `tests/app-routes/auth/patientAuth.test.ts` and `tests/app-routes/auth/doctorAuth.test.ts` with assertions that:

```ts
expect(source).toContain("useSignIn");
expect(source).toContain("useSignUp");
expect(source).toContain("buildPhoneIdentity");
expect(source).toContain("api.users.registerAccount");
expect(source).toContain("api.users.getLoginResolution");
expect(source).not.toContain("useSSO");
expect(source).not.toContain("Google");
expect(source).not.toContain("makeRedirectUri");
expect(source).not.toContain("fullNameFr");
expect(source).not.toContain("i18n");
```

Doctor register source must also contain `api.specialties.list` and `specialtyId`.

- [ ] **Step 2: Run failing auth screen tests**

Run:

```bash
npx vitest run tests/app-routes/auth/patientAuth.test.ts tests/app-routes/auth/doctorAuth.test.ts tests/app-routes/auth/roleRoutes.test.ts
```

Expected: FAIL until new files exist and old routes are deleted.

- [ ] **Step 3: Implement patient login**

Create `app/(auth)/patient/login.tsx` with:

```tsx
const { signIn, setActive, isLoaded } = useSignIn();
const handleSubmit = async () => {
  const errors = validateLogin({ phone, password });
  if (Object.keys(errors).length > 0 || !isLoaded) return;
  const { phoneLoginKey } = buildPhoneIdentity(phone);
  const result = await signIn.create({ identifier: phoneLoginKey, password });
  if (result.status !== "complete") throw new Error("Invalid login state");
  await setActive({ session: result.createdSessionId });
  const resolution = await convex.query(api.users.getLoginResolution, {
    role: "patient",
    phone: phone.trim(),
  });
  if (!resolution.ok) {
    await signOut();
    setError(resolution.reason === "role_mismatch" ? "هذا الحساب ليس حساب مريض" : "استخدم نفس رقم الهاتف المسجل");
    return;
  }
  router.replace("/(patient)");
};
```

- [ ] **Step 4: Implement doctor login**

Create `app/(auth)/doctor/login.tsx` using the same flow with `role: "doctor"` and redirect `/(doctor)/dashboard`.

- [ ] **Step 5: Implement patient register**

Create `app/(auth)/patient/register.tsx`:

```tsx
const { signUp, setActive, isLoaded } = useSignUp();
const handleSubmit = async () => {
  const errors = validatePatientRegistration(form);
  if (Object.keys(errors).length > 0 || !isLoaded) return;
  const phoneIdentity = buildPhoneIdentity(form.phone);
  const created = await signUp.create({
    username: phoneIdentity.phoneLoginKey,
    password: form.password,
  });
  if (created.status !== "complete") throw new Error("Invalid signup state");
  await setActive({ session: created.createdSessionId });
  await convex.mutation(api.users.registerAccount, {
    role: "patient",
    fullName: form.fullName,
    gender: form.gender,
    phone: form.phone,
    email: form.email,
  });
  await setStoredAuthRole("patient");
  router.replace("/(patient)");
};
```

- [ ] **Step 6: Implement doctor register**

Create `app/(auth)/doctor/register.tsx` with `useQuery(api.specialties.list, {})`, required `specialtyId`, and `api.users.registerAccount` args including `role: "doctor"` and `specialtyId`.

- [ ] **Step 7: Delete obsolete routes**

Run:

```bash
rm app/\(auth\)/login.tsx app/\(auth\)/register.tsx app/\(auth\)/onboarding.tsx app/complete-profile.tsx app/sso-callback.tsx
```

- [ ] **Step 8: Run auth route tests**

Run:

```bash
npx vitest run tests/app-routes/auth/patientAuth.test.ts tests/app-routes/auth/doctorAuth.test.ts tests/app-routes/auth/roleRoutes.test.ts tests/app-routes/indexRouting.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add app tests/app-routes/auth tests/app-routes/indexRouting.test.ts
git commit -m "feat: add role-specific auth screens"
```

---

### Task 10: Remove Google, I18n, And Convex Auth Package Usage

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `package.json`
- Delete: `src/lib/i18n.ts`
- Delete: `src/stores/languageStore.ts`
- Delete: `src/stores/languageStore.test.ts`
- Delete: `assets/locales/fr.json`
- Test: `tests/app-routes/rootLayout.clerk.test.ts`

- [ ] **Step 1: Add package/source assertions**

Create or update tests that read `package.json` and root layout:

```ts
expect(packageJson.dependencies).not.toHaveProperty("i18next");
expect(packageJson.dependencies).not.toHaveProperty("react-i18next");
expect(packageJson.dependencies).not.toHaveProperty("expo-auth-session");
expect(packageJson.dependencies).not.toHaveProperty("@convex-dev/auth");
expect(rootLayoutSource).not.toContain("I18nextProvider");
expect(rootLayoutSource).not.toContain("src/lib/i18n");
expect(rootLayoutSource).toContain("ClerkProvider");
expect(rootLayoutSource).toContain("ConvexProviderWithClerk");
```

- [ ] **Step 2: Run failing removal assertions**

Run:

```bash
npx vitest run tests/app-routes/rootLayout.clerk.test.ts
```

Expected: FAIL until packages/imports are removed.

- [ ] **Step 3: Remove root i18n wrapper**

In `app/_layout.tsx`:

- Remove `I18nextProvider` and `i18n` imports.
- Remove `i18nReady` state and initialization effect.
- Hide splash when fonts finish or font loading errors.
- Keep `ClerkProvider`, `ConvexProviderWithClerk`, `ConvexErrorBoundary`, `SafeAreaProvider`, and `PushNotificationsRegistrar`.

- [ ] **Step 4: Remove unused package dependencies**

Run:

```bash
npm uninstall i18next react-i18next expo-auth-session @convex-dev/auth @auth/core
```

Expected: `package.json` and lockfile update. If another file still imports one of these packages, typecheck will identify it.

- [ ] **Step 5: Delete i18n/language files**

Run:

```bash
rm src/lib/i18n.ts src/stores/languageStore.ts src/stores/languageStore.test.ts assets/locales/fr.json
```

- [ ] **Step 6: Remove stale auth tests**

Delete tests that only prove removed behavior:

```bash
rm tests/app-routes/auth/googleCompletion.test.ts tests/app-routes/auth/ssoCallback.test.ts tests/app-routes/auth/onboarding.test.ts
```

- [ ] **Step 7: Run removal tests**

Run:

```bash
npx vitest run tests/app-routes/rootLayout.clerk.test.ts tests/app-routes/auth/roleRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add app/_layout.tsx package.json package-lock.json tests src assets
git commit -m "chore: remove google oauth and i18n auth dependencies"
```

---

### Task 11: Update Reference Data And Specialty Queries

**Files:**
- Modify: `convex/specialties.ts`
- Modify: `convex/locations.ts`
- Modify: `convex/seed.ts`
- Modify: `convex/specialties.test.ts`
- Modify: `convex/locations.test.ts`
- Modify: `src/components/SpecialtyGrid.tsx`

- [ ] **Step 1: Write failing reference-field tests**

Update tests to seed and expect neutral `name` fields:

```ts
await ctx.db.insert("specialties", { name: "طب القلب", icon: "heart-pulse" });
await ctx.db.insert("wilayas", { id: 16, name: "الجزائر" });
await ctx.db.insert("communes", { wilayaId, name: "الجزائر الوسطى" });
expect(result[0]).toMatchObject({ name: "طب القلب" });
```

Assert source no longer contains `nameAr`, `nameFr`, `search_nameFr`, or `search_nameAr`.

- [ ] **Step 2: Run failing reference tests**

Run:

```bash
npx vitest run convex/specialties.test.ts convex/locations.test.ts
```

Expected: FAIL until functions and seed use `name`.

- [ ] **Step 3: Update reference queries**

Change all specialty/location result shapes to return `name`, `icon`, and `_id`. Use `search_name` for specialty search.

- [ ] **Step 4: Update seed reference rows**

In `convex/seed.ts`, rename every reference row from `nameAr`/`nameFr` to `name`. Keep specialties, wilayas, and communes populated.

- [ ] **Step 5: Run reference tests**

Run:

```bash
npx vitest run convex/specialties.test.ts convex/locations.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add convex/specialties.ts convex/locations.ts convex/seed.ts convex/specialties.test.ts convex/locations.test.ts src/components/SpecialtyGrid.tsx
git commit -m "refactor: use arabic reference names"
```

---

### Task 12: Doctor Discovery And Booking Compatibility

**Files:**
- Modify: `convex/doctors.ts`
- Modify: `convex/bookings.ts`
- Modify: `convex/favorites.ts`
- Modify: `src/components/DoctorCard.tsx`
- Modify: `app/(patient)/doctor/[id].tsx`
- Modify: `app/(patient)/search.tsx`
- Test: `convex/doctors.test.ts`
- Test: `convex/bookings.test.ts`

- [ ] **Step 1: Write doctor visibility tests**

In `convex/doctors.test.ts`, add:

```ts
test("lists active doctors with a valid specialty without verification gates", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const specialtyId = await ctx.db.insert("specialties", {
      name: "طب القلب",
      icon: "heart-pulse",
    });
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: "clerk|doctor-public",
      fullName: "طبيب ظاهر",
      gender: "male",
      role: "doctor",
      phone: "0555123456",
      phoneNormalized: "+213555123456",
      phoneLoginKey: "dz213555123456",
      isActive: true,
    });
    await ctx.db.insert("doctors", {
      userId,
      specialtyId,
      subSpecialties: [],
      bio: "",
      yearsOfExperience: 0,
      languages: ["العربية"],
      consultationFee: 0,
      followUpFee: 0,
      avgRating: 0,
      totalReviews: 0,
    });
  });

  const doctors = await t.query(api.doctors.listPublic, {});
  expect(doctors).toEqual([
    expect.objectContaining({
      fullName: "طبيب ظاهر",
      specialty: expect.objectContaining({ name: "طب القلب" }),
    }),
  ]);
});
```

- [ ] **Step 2: Write no-clinic booking test**

In `convex/bookings.test.ts`, add a test that seeds a doctor with no clinic and asserts the availability query returns an empty clinic/slot result, not a hidden doctor error.

- [ ] **Step 3: Run failing doctor/booking tests**

Run:

```bash
npx vitest run convex/doctors.test.ts convex/bookings.test.ts --runInBand
```

Expected: FAIL while discovery still uses `isVerified`, `isProfileComplete`, `bioAr`, `bioFr`, or `nameFr`.

- [ ] **Step 4: Update doctor queries**

Change doctor public visibility to:

```ts
user.isActive === true &&
user.role === "doctor" &&
doctor != null &&
specialty != null
```

Remove all return fields named `isVerified`, `isProfileComplete`, `bioAr`, `bioFr`, `nameAr`, and `nameFr`.

- [ ] **Step 5: Update UI doctor cards and detail**

In `src/components/DoctorCard.tsx` and `app/(patient)/doctor/[id].tsx`:

- Render `doctor.fullName`.
- Render `doctor.specialty.name`.
- Render `doctor.bio` only when non-empty.
- Remove verified badge components and text.

- [ ] **Step 6: Run doctor/booking tests**

Run:

```bash
npx vitest run convex/doctors.test.ts convex/bookings.test.ts tests/app-routes/patient/patientScreens.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add convex/doctors.ts convex/bookings.ts convex/favorites.ts convex/doctors.test.ts convex/bookings.test.ts src/components/DoctorCard.tsx app/\(patient\)
git commit -m "refactor: simplify doctor discovery"
```

---

### Task 13: Update Patient And Doctor App Screens

**Files:**
- Modify: `app/(patient)/_layout.tsx`
- Modify: `app/(patient)/profile.tsx`
- Modify: `app/(patient)/appointments.tsx`
- Modify: `app/(patient)/favorites.tsx`
- Modify: `app/(doctor)/_layout.tsx`
- Modify: `app/(doctor)/dashboard.tsx`
- Modify: `app/(doctor)/profile.tsx`
- Modify: `app/(doctor)/settings.tsx`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add source assertions for removed fields**

Create or update route tests to assert patient/doctor app sources do not contain:

```ts
["fullNameAr", "fullNameFr", "bioAr", "bioFr", "nameFr", "isVerified", "isProfileComplete", "orderRegistrationNumber", "/(auth)/onboarding", "/complete-profile"]
```

and do contain:

```ts
["fullName", "bio", "name", "/"]
```

- [ ] **Step 2: Run failing screen assertions**

Run:

```bash
npx vitest run tests/app-routes/patient/patientScreens.test.ts tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: FAIL while old fields and redirects remain.

- [ ] **Step 3: Update route guards**

In patient and doctor layouts:

- If `api.users.me` returns `null`, route to `/`.
- If `me.role` mismatches the group, route to the matching role app.
- Do not route to onboarding or complete-profile.

- [ ] **Step 4: Update profile fields**

Replace old names:

```ts
fullNameAr -> fullName
bioAr -> bio
nameAr -> name
```

Remove French inputs and doctor registration/order number fields from doctor profile edit screens.

- [ ] **Step 5: Run screen tests**

Run:

```bash
npx vitest run tests/app-routes/patient/patientScreens.test.ts tests/app-routes/doctor/doctorScreens.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add app/\(patient\) app/\(doctor\) src/lib/types.ts tests/app-routes/patient tests/app-routes/doctor
git commit -m "refactor: update app screens for simple auth schema"
```

---

### Task 14: Cleanup Mutation With Dry Run

**Files:**
- Create: `convex/cleanup.ts`
- Create: `convex/cleanup.test.ts`

- [ ] **Step 1: Write cleanup dry-run tests**

Create `convex/cleanup.test.ts`:

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

describe("cleanup non-reference data", () => {
  test("dry run counts non-reference rows and keeps reference rows", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert("specialties", {
        name: "طب القلب",
        icon: "heart-pulse",
      });
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: "clerk|cleanup",
        fullName: "حذف",
        gender: "male",
        role: "doctor",
        phone: "0555123456",
        phoneNormalized: "+213555123456",
        phoneLoginKey: "dz213555123456",
        isActive: true,
      });
      await ctx.db.insert("doctors", {
        userId,
        specialtyId,
        subSpecialties: [],
        bio: "",
        yearsOfExperience: 0,
        languages: ["العربية"],
        consultationFee: 0,
        followUpFee: 0,
        avgRating: 0,
        totalReviews: 0,
      });
    });

    const result = await t.mutation(api.cleanup.cleanupNonReferenceData, {
      dryRun: true,
      batchSize: 50,
    });

    expect(result.tables.users).toBe(1);
    expect(result.tables.doctors).toBe(1);
    expect(result.tables.specialties).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run failing cleanup test**

Run:

```bash
npx vitest run convex/cleanup.test.ts --runInBand
```

Expected: FAIL because cleanup function does not exist.

- [ ] **Step 3: Implement cleanup mutation**

Create `convex/cleanup.ts` with a public mutation:

```ts
export const cleanupNonReferenceData = mutation({
  args: {
    dryRun: v.boolean(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const tables = [
      "bookings",
      "reviews",
      "patientFavorites",
      "notifications",
      "pushTokens",
      "schedules",
      "scheduleExceptions",
      "clinics",
      "patients",
      "doctors",
      "users",
    ] as const;

    const result: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(args.batchSize);
      result[table] = rows.length;
      if (!args.dryRun) {
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
      }
    }
    return { dryRun: args.dryRun, tables: result };
  },
});
```

Do not include `specialties`, `wilayas`, or `communes`.

- [ ] **Step 4: Run cleanup tests**

Run:

```bash
npx vitest run convex/cleanup.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add convex/cleanup.ts convex/cleanup.test.ts
git commit -m "feat: add non-reference cleanup mutation"
```

---

### Task 15: Full Verification

**Files:**
- All touched files.

- [ ] **Step 1: Search for removed concepts**

Run:

```bash
rg "useSSO|makeRedirectUri|sso-callback|complete-profile|onboarding|I18nextProvider|i18next|react-i18next|fullNameFr|bioFr|nameFr|isVerified|isProfileComplete|orderRegistrationNumber|authTables|@convex-dev/auth" app convex src tests package.json
```

Expected: no matches except historical docs/spec/plan if the command includes `docs`.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run Expo dependency check**

Run:

```bash
npx expo install --check
```

Expected: dependencies aligned for Expo SDK 56.

- [ ] **Step 5: Run Convex codegen**

Run:

```bash
npx convex codegen
```

Expected: generated Convex API updates. If `CONVEX_DEPLOYMENT` is missing, run `npx convex dev` in the configured environment before claiming backend verification.

- [ ] **Step 6: Commit final compile/test fixes**

Run:

```bash
git status --short
git add app convex src tests package.json package-lock.json
git commit -m "chore: verify simple auth rebuild"
```

Expected: only intentional implementation files are staged.

---

### Task 16: Deployment And Data Cleanup

**Files:**
- Use: `convex/cleanup.ts`
- Use: Clerk dashboard

- [ ] **Step 1: Deploy or run Convex dev against the intended deployment**

Run one of:

```bash
npx convex dev
```

or:

```bash
npx convex deploy
```

Expected: new schema/functions are available in the target Convex deployment.

- [ ] **Step 2: Dry-run cleanup**

Run:

```bash
npx convex run cleanup:cleanupNonReferenceData '{"dryRun":true,"batchSize":100}'
```

Expected: returns counts for non-reference tables and no counts for `specialties`, `wilayas`, or `communes`.

- [ ] **Step 3: Execute cleanup in batches**

Run:

```bash
npx convex run cleanup:cleanupNonReferenceData '{"dryRun":false,"batchSize":100}'
```

Repeat until every non-reference table count returns `0`.

- [ ] **Step 4: Verify reference tables remain populated**

Run:

```bash
npx convex run specialties:list '{}'
npx convex run locations:listWilayas '{}'
```

Expected: specialties and wilayas return non-empty arrays.

- [ ] **Step 5: Delete Clerk users manually**

Open the correct Clerk dashboard instance, verify it belongs to this Nabdh environment, then delete old test users. Do this only after Convex deployment and cleanup succeed.

---

### Task 17: Expo Go Smoke Test

**Files:**
- Runtime verification only.

- [ ] **Step 1: Start Expo for phone testing**

Run:

```bash
npm run start
```

If Linux watcher limits fail, run:

```bash
CI=true WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=1 npm run start
```

- [ ] **Step 2: Test patient signup on Expo Go**

Expected flow:

1. `/` shows role choice.
2. Tap patient.
3. Register with name, gender, Algerian phone, blank email, password, confirm password.
4. App routes to `/(patient)`.
5. Logout returns to `/` with patient highlighted.

- [ ] **Step 3: Test doctor signup on Expo Go**

Expected flow:

1. `/` shows role choice.
2. Tap doctor.
3. Register with name, gender, specialty, Algerian phone, blank email, password, confirm password.
4. App routes to `/(doctor)/dashboard`.
5. Logout returns to `/` with doctor highlighted.

- [ ] **Step 4: Test duplicate protection**

Expected:

- Same normalized phone cannot register again as patient or doctor.
- Same provided email cannot register again as patient or doctor.
- Blank email can be used by multiple accounts.

- [ ] **Step 5: Test role mismatch login**

Expected:

- Patient account on doctor login signs out and shows role mismatch.
- Doctor account on patient login signs out and shows role mismatch.

---

## Self-Review Checklist

- Spec coverage: route removal, Google removal, role-specific auth, immutable role, phone/email uniqueness, Arabic-only MVP, simplified schema, no verification badge, reference data kept, cleanup gated after deployment.
- Placeholder scan: every task names exact files, commands, and expected outcomes.
- Type consistency: `fullName`, `bio`, `name`, `phoneNormalized`, `phoneLoginKey`, and `tokenIdentifier` are used consistently.
- Convex rules: all public functions include validators, auth derives from `ctx.auth.getUserIdentity()`, indexed lookups use schema indexes, cleanup deletes in bounded batches.
- Expo rules: implementation starts after reading SDK 56 docs and `npx expo install --check` is part of preflight and final verification.
