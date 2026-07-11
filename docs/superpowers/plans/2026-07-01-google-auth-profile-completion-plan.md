# Google Auth Profile Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Google sign-in/sign-up authenticate first, route incomplete Google users to a dedicated Arabic `/complete-profile` flow, block duplicate password-account emails, and reliably send completed users to the correct Nabdh area.

**Architecture:** Clerk owns Google OAuth and session activation. `app/sso-callback.tsx` remains a thin callback that returns to `/`, while `app/index.tsx` is the central router that sends authenticated users with no Nabdh profile to `/complete-profile`. Convex remains the source of truth for Nabdh profiles and enforces duplicate-email protection before profile creation.

**Tech Stack:** Expo SDK 56, Expo Router, React Native, Clerk Expo (`useSSO`, `useUser`, `useAuth`), Convex (`useQuery`, `useMutation`, `ctx.auth.getUserIdentity()`), Vitest, convex-test.

---

## File Structure

- Create `app/complete-profile.tsx`: Arabic-only post-Google profile completion screen. It chooses role first, pre-fills Google name/email, locks email, collects required role fields, allows logout, and calls Convex completion mutation.
- Modify `app/index.tsx`: central routing must detect an authenticated Clerk identity with no Convex user/profile and route to `/complete-profile`.
- Modify `app/sso-callback.tsx`: keep callback thin and route to `/`; no profile logic here.
- Modify `app/(auth)/login.tsx`: Google button should only authenticate and return to `/`; no role/profile completion logic.
- Modify `app/(auth)/register.tsx`: remove the Google-first profile-completion branch from the register form; password sign-up remains as-is.
- Modify `app/(auth)/_layout.tsx`: authenticated users with no profile should not be trapped in auth screens; route them through `/complete-profile` from `index`.
- Modify `convex/users.ts`: add a query for profile-completion context and enforce duplicate email conflicts in registration.
- Modify `convex/lib/auth.ts` if needed: keep tokenIdentifier as canonical identity and do not link by email automatically.
- Add/modify tests:
  - `tests/app-routes/auth/googleCompletion.test.ts`
  - `tests/app-routes/auth/login.test.ts`
  - `tests/app-routes/auth/register.test.ts`
  - `tests/app-routes/indexRouting.test.ts`
  - `convex/users.test.ts`

---

### Task 1: Add Convex Profile Completion Context and Duplicate Email Guard

**Files:**
- Modify: `convex/users.ts`
- Test: `convex/users.test.ts`

- [ ] **Step 1: Write the failing Convex tests**

Append these tests inside `describe("users.register", () => { ... })` in `convex/users.test.ts`:

```ts
test("reports current Clerk identity and duplicate email state for profile completion", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      email: "taken@example.test",
      tokenIdentifier: "password:legacy-user",
      role: "patient",
      fullNameAr: "مستخدم موجود",
      isActive: true,
    });
  });

  const context = await t
    .withIdentity({
      subject: "google-subject-1",
      tokenIdentifier: "https://select-kiwi-66.clerk.accounts.dev|google-user-1",
      email: "taken@example.test",
      name: "Google User",
    })
    .query(api.users.getProfileCompletionContext, {});

  expect(context).toMatchObject({
    isAuthenticated: true,
    existingUser: null,
    email: "taken@example.test",
    name: "Google User",
    emailBelongsToAnotherUser: true,
  });
});

test("does not report duplicate email when the email belongs to the current identity", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      email: "same@example.test",
      tokenIdentifier: "https://select-kiwi-66.clerk.accounts.dev|google-user-2",
      role: "patient",
      fullNameAr: "نفس المستخدم",
      isActive: true,
    });
  });

  const context = await t
    .withIdentity({
      subject: "google-subject-2",
      tokenIdentifier: "https://select-kiwi-66.clerk.accounts.dev|google-user-2",
      email: "same@example.test",
      name: "Same User",
    })
    .query(api.users.getProfileCompletionContext, {});

  expect(context).toMatchObject({
    isAuthenticated: true,
    email: "same@example.test",
    emailBelongsToAnotherUser: false,
  });
});

test("rejects registration when email belongs to another identity", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const wilayaId = await ctx.db.insert("wilayas", {
      id: 16,
      nameAr: "الجزائر",
      nameFr: "Alger",
    });
    const communeId = await ctx.db.insert("communes", {
      wilayaId,
      nameAr: "الجزائر الوسطى",
      nameFr: "Alger Centre",
    });
    await ctx.db.insert("users", {
      email: "taken@example.test",
      tokenIdentifier: "password:legacy-user",
      role: "patient",
      fullNameAr: "مستخدم موجود",
      isActive: true,
    });
    return { communeId, wilayaId };
  });

  await expect(
    t
      .withIdentity({
        subject: "google-subject-3",
        tokenIdentifier: "https://select-kiwi-66.clerk.accounts.dev|google-user-3",
        email: "taken@example.test",
        name: "Blocked Google User",
      })
      .mutation(api.users.register, {
        fullNameAr: "مستخدم Google",
        phone: "0555123456",
        email: "taken@example.test",
        role: "patient",
        wilayaId: ids.wilayaId,
        communeId: ids.communeId,
        dateOfBirth: "1990-01-01",
        gender: "male",
      }),
  ).rejects.toThrow(/email already belongs to another account/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- convex/users.test.ts
```

Expected: FAIL because `api.users.getProfileCompletionContext` does not exist and `users.register` does not reject duplicate cross-identity email yet.

- [ ] **Step 3: Implement `getProfileCompletionContext` and duplicate guard**

In `convex/users.ts`, add this helper near `isPasswordAccountRegistered`:

```ts
async function getUserByEmail(ctx: any, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("email", (q: any) => q.eq("email", email))
    .first();
}
```

Add this query after `isPasswordAccountRegistered`:

```ts
export const getProfileCompletionContext = query({
  args: {},
  returns: v.object({
    isAuthenticated: v.boolean(),
    existingUser: v.union(v.null(), v.object(userFields)),
    email: v.union(v.null(), v.string()),
    name: v.union(v.null(), v.string()),
    emailBelongsToAnotherUser: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        isAuthenticated: false,
        existingUser: null,
        email: null,
        name: null,
        emailBelongsToAnotherUser: false,
      };
    }

    const existingUser = await getOptionalAuthedUser(ctx);
    const email = identity.email ? normalizeEmailForAuth(identity.email) : null;
    const emailUser = email ? await getUserByEmail(ctx, email) : null;

    return {
      isAuthenticated: true,
      existingUser: existingUser
        ? {
            _id: existingUser._id,
            _creationTime: existingUser._creationTime,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            image: existingUser.image,
            fullNameAr: existingUser.fullNameAr,
            fullNameFr: existingUser.fullNameFr,
            gender: existingUser.gender,
            role: existingUser.role,
            wilayaId: existingUser.wilayaId,
            avatarUrl: existingUser.avatarUrl,
            isActive: existingUser.isActive,
          }
        : null,
      email,
      name: identity.name ?? null,
      emailBelongsToAnotherUser:
        emailUser != null &&
        emailUser.tokenIdentifier !== identity.tokenIdentifier,
    };
  },
});
```

Inside `users.register`, after `const phone = ...` and `const email = ...`, add:

```ts
const emailUser = await getUserByEmail(ctx, email);
if (
  emailUser != null &&
  emailUser.tokenIdentifier !== identity.tokenIdentifier
) {
  throw new ConvexError("Email already belongs to another account.");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- convex/users.test.ts
```

Expected: PASS.

- [ ] **Step 5: Regenerate Convex API types**

Run:

```bash
npx convex codegen
```

Expected: `convex/_generated/api.d.ts` includes `users.getProfileCompletionContext`.

---

### Task 2: Centralize Routing for Incomplete Google Profiles

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/(auth)/_layout.tsx`
- Test: `tests/app-routes/indexRouting.test.ts`
- Test: `tests/app-routes/auth/googleCompletion.test.ts`

- [ ] **Step 1: Write failing source tests for index routing**

Create `tests/app-routes/indexRouting.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const indexSource = () =>
  readFileSync(join(process.cwd(), "app/index.tsx"), "utf8");

describe("root auth routing", () => {
  test("routes authenticated users without a Nabdh profile to complete-profile", () => {
    const source = indexSource();

    expect(source).toContain("api.users.getProfileCompletionContext");
    expect(source).toContain("/complete-profile");
    expect(source.indexOf("/complete-profile")).toBeLessThan(
      source.indexOf("/(auth)/onboarding"),
    );
  });

  test("does not send missing-profile users to patient or doctor areas", () => {
    const source = indexSource();

    expect(source).toContain("me.role === 'patient' && me.profile");
    expect(source).toContain("me.role === 'doctor' && me.profile");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/app-routes/indexRouting.test.ts
```

Expected: FAIL because current `index.tsx` does not call `getProfileCompletionContext` and routes patient role without requiring profile.

- [ ] **Step 3: Update `app/index.tsx` routing**

Replace the current routing logic in `app/index.tsx` with:

```tsx
const me = useQuery(api.users.me, {});
const completionContext = useQuery(api.users.getProfileCompletionContext, {});

const redirectBasedOnAuth = useCallback(() => {
  if (me === undefined || completionContext === undefined) return;

  if (completionContext.isAuthenticated && !me) {
    router.replace('/complete-profile');
    return;
  }

  if (!me) {
    router.replace('/(auth)/onboarding');
    return;
  }

  if (me.role === 'patient' && me.profile) {
    router.replace('/(patient)');
  } else if (me.role === 'doctor' && me.profile) {
    router.replace('/(doctor)/dashboard');
  } else {
    router.replace('/complete-profile');
  }
}, [completionContext, me, router]);
```

- [ ] **Step 4: Update auth layout so incomplete authenticated users escape auth stack**

In `app/(auth)/_layout.tsx`, change the redirect effect to:

```tsx
useEffect(() => {
  if (patientRegistrationComplete) {
    router.replace("/(patient)");
  } else if (me?.role === "doctor" && me.profile) {
    router.replace("/(doctor)/dashboard");
  } else if (me && pathname !== "/onboarding") {
    router.replace("/complete-profile");
  }
}, [me, patientRegistrationComplete, pathname, router]);
```

Change the null render guard to:

```tsx
if (patientRegistrationComplete || (me?.role === "doctor" && me.profile)) {
  return null;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/app-routes/indexRouting.test.ts tests/app-routes/auth/onboarding.test.ts
```

Expected: PASS.

---

### Task 3: Build `/complete-profile` Screen

**Files:**
- Create: `app/complete-profile.tsx`
- Test: `tests/app-routes/auth/googleCompletion.test.ts`

- [ ] **Step 1: Write failing screen source test**

Create `tests/app-routes/auth/googleCompletion.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const completeProfilePath = () => join(process.cwd(), "app/complete-profile.tsx");
const completeProfileSource = () => readFileSync(completeProfilePath(), "utf8");

describe("Google profile completion screen", () => {
  test("exists and starts with role selection", () => {
    expect(existsSync(completeProfilePath())).toBe(true);
    const source = completeProfileSource();

    expect(source).toContain("api.users.getProfileCompletionContext");
    expect(source).toContain("useUser");
    expect(source).toContain("useAuth");
    expect(source).toContain("selectedRole");
    expect(source).toContain("أنا مريض");
    expect(source).toContain("أنا طبيب");
  });

  test("prefills and locks Google email", () => {
    const source = completeProfileSource();

    expect(source).toContain("googleEmail");
    expect(source).toContain("editable={false}");
    expect(source).toContain("البريد الإلكتروني");
  });

  test("collects the same required role fields as password signup", () => {
    const source = completeProfileSource();

    expect(source).toContain("رقم الهاتف");
    expect(source).toContain("الولاية");
    expect(source).toContain("البلدية");
    expect(source).toContain("تاريخ الميلاد");
    expect(source).toContain("الجنس");
    expect(source).toContain("التخصص");
    expect(source).toContain("رقم التسجيل في النقابة");
    expect(source).toContain("api.users.register");
  });

  test("blocks duplicate password emails and allows logout", () => {
    const source = completeProfileSource();

    expect(source).toContain("emailBelongsToAnotherUser");
    expect(source).toContain("هذا البريد مسجل من قبل");
    expect(source).toContain("signOut");
    expect(source).toContain("تسجيل الخروج");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/app-routes/auth/googleCompletion.test.ts
```

Expected: FAIL because `app/complete-profile.tsx` does not exist.

- [ ] **Step 3: Implement `app/complete-profile.tsx`**

Create a screen that follows current local form patterns. Use `useQuery(api.users.getProfileCompletionContext, {})`, `useUser()` for Clerk display data, `useAuth()` for `signOut`, and `useMutation(api.users.register)`.

Required implementation shape:

```tsx
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { theme } from '../src/lib/theme';
import { normalizePhoneForAuth } from '../src/lib/authIdentifiers';
import type { UserRole } from '../src/lib/types';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const context = useQuery(api.users.getProfileCompletionContext, {});
  const registerUser = useMutation(api.users.register);
  const wilayas = useQuery(api.locations.listWilayas, {});
  const specialties = useQuery(api.specialties.list, {});

  const googleEmail = context?.email ?? user?.primaryEmailAddress?.emailAddress ?? '';
  const googleName = context?.name ?? user?.fullName ?? '';

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullNameAr, setFullNameAr] = useState(googleName);
  const [phone, setPhone] = useState('');
  const [wilayaId, setWilayaId] = useState<string>('');
  const [communeId, setCommuneId] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [specialtyId, setSpecialtyId] = useState<string>('');
  const [orderRegistrationNumber, setOrderRegistrationNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const communes = useQuery(
    api.locations.listCommunesByWilaya,
    wilayaId ? { wilayaId: wilayaId as Id<'wilayas'> } : 'skip',
  );

  const duplicateEmailMessage =
    'هذا البريد مسجل من قبل. سجّل الدخول بكلمة المرور أو أعد تعيينها، أو استخدم حساب Google آخر.';

  const canSubmit = useMemo(() => {
    if (!selectedRole || !fullNameAr.trim() || !phone.trim() || !wilayaId || !googleEmail) return false;
    if (selectedRole === 'patient') return Boolean(communeId && dateOfBirth && gender);
    return Boolean(specialtyId && orderRegistrationNumber.trim().length >= 3);
  }, [communeId, dateOfBirth, fullNameAr, gender, googleEmail, orderRegistrationNumber, phone, selectedRole, specialtyId, wilayaId]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/onboarding');
  }, [router, signOut]);

  const handleSubmit = useCallback(async () => {
    if (!selectedRole) {
      setError('اختر نوع الحساب أولا.');
      return;
    }
    if (context?.emailBelongsToAnotherUser) {
      setError(duplicateEmailMessage);
      return;
    }
    if (!canSubmit) {
      setError('أكمل كل الحقول المطلوبة قبل المتابعة.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const normalizedPhone = normalizePhoneForAuth(phone);
      await registerUser({
        fullNameAr: fullNameAr.trim(),
        phone: normalizedPhone,
        email: googleEmail,
        role: selectedRole,
        wilayaId: wilayaId as Id<'wilayas'>,
        communeId: selectedRole === 'patient' ? (communeId as Id<'communes'>) : undefined,
        dateOfBirth: selectedRole === 'patient' ? dateOfBirth : undefined,
        gender: selectedRole === 'patient' ? gender : undefined,
        specialtyId: selectedRole === 'doctor' ? (specialtyId as Id<'specialties'>) : undefined,
        orderRegistrationNumber: selectedRole === 'doctor' ? orderRegistrationNumber.trim() : undefined,
      });
      router.replace('/');
    } catch (err) {
      setError('تعذر إكمال الملف. تحقق من البيانات ثم حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, communeId, context?.emailBelongsToAnotherUser, dateOfBirth, duplicateEmailMessage, fullNameAr, gender, googleEmail, orderRegistrationNumber, phone, registerUser, router, selectedRole, specialtyId, wilayaId]);

  if (context === undefined || wilayas === undefined || specialties === undefined) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.official} /></View>;
  }

  if (!context.isAuthenticated) {
    router.replace('/(auth)/onboarding');
    return null;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>أكمل ملفك في نبض</Text>
        <Text style={styles.subtitle}>اختر نوع الحساب وأكمل البيانات المطلوبة للحجز أو إدارة العيادة.</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {context.emailBelongsToAnotherUser ? <Text style={styles.errorText}>{duplicateEmailMessage}</Text> : null}

        <View style={styles.roleRow}>
          <TouchableOpacity style={[styles.roleButton, selectedRole === 'patient' && styles.roleButtonActive]} onPress={() => setSelectedRole('patient')}>
            <Text style={[styles.roleText, selectedRole === 'patient' && styles.roleTextActive]}>أنا مريض</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roleButton, selectedRole === 'doctor' && styles.roleButtonActive]} onPress={() => setSelectedRole('doctor')}>
            <Text style={[styles.roleText, selectedRole === 'doctor' && styles.roleTextActive]}>أنا طبيب</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>البريد الإلكتروني</Text>
        <TextInput style={[styles.input, styles.inputDisabled]} value={googleEmail} editable={false} textAlign="right" />

        <Text style={styles.label}>الاسم الكامل</Text>
        <TextInput style={styles.input} value={fullNameAr} onChangeText={setFullNameAr} placeholder="الاسم الكامل" textAlign="right" />

        <Text style={styles.label}>رقم الهاتف</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="0555 12 34 56" keyboardType="phone-pad" textAlign="right" />

        <Text style={styles.label}>الولاية</Text>
        {wilayas.map((wilaya) => (
          <TouchableOpacity key={wilaya._id} style={[styles.option, wilayaId === wilaya._id && styles.optionActive]} onPress={() => { setWilayaId(wilaya._id); setCommuneId(''); }}>
            <Text style={styles.optionText}>{wilaya.nameAr}</Text>
          </TouchableOpacity>
        ))}

        {selectedRole === 'patient' ? (
          <>
            <Text style={styles.label}>البلدية</Text>
            {(communes ?? []).map((commune) => (
              <TouchableOpacity key={commune._id} style={[styles.option, communeId === commune._id && styles.optionActive]} onPress={() => setCommuneId(commune._id)}>
                <Text style={styles.optionText}>{commune.nameAr}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>تاريخ الميلاد</Text>
            <TextInput style={styles.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" textAlign="right" />
            <Text style={styles.label}>الجنس</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity style={[styles.roleButton, gender === 'male' && styles.roleButtonActive]} onPress={() => setGender('male')}><Text style={styles.roleText}>ذكر</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, gender === 'female' && styles.roleButtonActive]} onPress={() => setGender('female')}><Text style={styles.roleText}>أنثى</Text></TouchableOpacity>
            </View>
          </>
        ) : null}

        {selectedRole === 'doctor' ? (
          <>
            <Text style={styles.label}>التخصص</Text>
            {specialties.map((specialty) => (
              <TouchableOpacity key={specialty._id} style={[styles.option, specialtyId === specialty._id && styles.optionActive]} onPress={() => setSpecialtyId(specialty._id)}>
                <Text style={styles.optionText}>{specialty.nameAr}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>رقم التسجيل في النقابة</Text>
            <TextInput style={styles.input} value={orderRegistrationNumber} onChangeText={setOrderRegistrationNumber} placeholder="مثال: 2024-12345" textAlign="right" />
          </>
        ) : null}

        <TouchableOpacity style={[styles.primaryButton, (!canSubmit || submitting || context.emailBelongsToAnotherUser) && styles.buttonDisabled]} disabled={!canSubmit || submitting || context.emailBelongsToAnotherUser} onPress={handleSubmit}>
          {submitting ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.primaryButtonText}>إكمال التسجيل</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
          <Text style={styles.secondaryButtonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.xl, paddingBottom: theme.spacing['5xl'], gap: theme.spacing.md },
  title: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 24, color: theme.colors.textPrimary, textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, color: theme.colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  label: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 14, color: theme.colors.textPrimary, textAlign: 'right', writingDirection: 'rtl', marginTop: theme.spacing.sm },
  input: { backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, fontFamily: theme.typography.fontFamily.arabic, fontSize: 15, color: theme.colors.textPrimary, writingDirection: 'rtl' },
  inputDisabled: { backgroundColor: theme.colors.surfaceMuted, color: theme.colors.textSecondary },
  roleRow: { flexDirection: 'row', gap: theme.spacing.md },
  roleButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.md },
  roleButtonActive: { backgroundColor: theme.colors.official, borderColor: theme.colors.official },
  roleText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 14, color: theme.colors.textPrimary, writingDirection: 'rtl' },
  roleTextActive: { color: theme.colors.white },
  option: { backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  optionActive: { borderColor: theme.colors.official, backgroundColor: theme.colors.secondary },
  optionText: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, color: theme.colors.textPrimary, textAlign: 'right', writingDirection: 'rtl' },
  primaryButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.official, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, marginTop: theme.spacing.lg },
  primaryButtonText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 16, color: theme.colors.white },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.lg },
  secondaryButtonText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 15, color: theme.colors.official, writingDirection: 'rtl' },
  errorText: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 13, color: theme.colors.danger, textAlign: 'right', writingDirection: 'rtl' },
  buttonDisabled: { opacity: 0.55 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/app-routes/auth/googleCompletion.test.ts
```

Expected: PASS.

---

### Task 4: Simplify Google Buttons to Auth-Only Flow

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/register.tsx`
- Test: `tests/app-routes/auth/login.test.ts`
- Test: `tests/app-routes/auth/register.test.ts`

- [ ] **Step 1: Update tests for auth-only Google behavior**

In `tests/app-routes/auth/register.test.ts`, replace the Google test expectations with:

```ts
expect(source).toContain("handleStartGoogleSignUp");
expect(source).toContain("startSSOFlow");
expect(source).toContain("strategy: 'oauth_google'");
expect(source).toContain("redirectUrl: googleRedirectUrl");
expect(source).toContain("router.replace('/')");
expect(source).not.toContain("setGoogleSessionId");
expect(source).not.toContain("handleCompleteGoogleRegistration");
```

In `tests/app-routes/auth/login.test.ts`, keep the current SSO expectations and add:

```ts
expect(source).toContain("router.replace('/')");
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/app-routes/auth/login.test.ts tests/app-routes/auth/register.test.ts
```

Expected: FAIL because register still uses `googleSessionId` and profile completion logic.

- [ ] **Step 3: Patch `app/(auth)/register.tsx`**

Remove:

```ts
const [googleSessionId, setGoogleSessionId] = useState<string | null>(null);
```

Remove `handleCompleteGoogleRegistration` and `handleCompleteStep`.

Change `handleStartGoogleSignUp` so it no longer validates form fields or queries duplicate email. It should only start SSO and activate the returned session:

```ts
const handleStartGoogleSignUp = useCallback(async () => {
  setSubmitting(true);
  setGoogleLoading(true);
  setServerError(null);

  try {
    const {
      createdSessionId,
      setActive: activateOAuthSession,
    } = await startSSOFlow({
      strategy: 'oauth_google',
      redirectUrl: googleRedirectUrl,
    });
    const activateSession = activateOAuthSession ?? setActive;

    if (!createdSessionId || !activateSession) {
      throw new Error('Google sign-up did not complete.');
    }

    await activateSession({ session: createdSessionId });
    router.replace('/');
  } catch (err: any) {
    setServerError(getRegistrationErrorMessage(err));
  } finally {
    setSubmitting(false);
    setGoogleLoading(false);
  }
}, [googleRedirectUrl, router, setActive, startSSOFlow]);
```

Change the final password registration button in step 2 back to:

```tsx
onPress={handleSubmit(onSubmit)}
```

Change button text back to:

```tsx
<Text style={styles.primaryButtonText}>تسجيل</Text>
```

- [ ] **Step 4: Keep password register working**

Do not remove `onSubmit`, verification modal, `buildRegistrationPayload`, or password email-code flow. Those remain the password sign-up route.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/app-routes/auth/login.test.ts tests/app-routes/auth/register.test.ts tests/app-routes/auth/googleCompletion.test.ts
```

Expected: PASS.

---

### Task 5: Final Verification and Expo Go Smoke

**Files:**
- No code files unless verification exposes a defect.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- convex/users.test.ts tests/app-routes/indexRouting.test.ts tests/app-routes/auth/googleCompletion.test.ts tests/app-routes/auth/login.test.ts tests/app-routes/auth/register.test.ts src/lib/pushNotifications.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run Expo Doctor**

Run:

```bash
npx expo-doctor
```

Expected: no blocking compatibility errors. Warnings must be reviewed and either fixed or explicitly documented.

- [ ] **Step 4: Restart Expo Go server with clear cache**

Stop any existing Metro session, then run:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_c2VsZWN0LWtpd2ktNjYuY2xlcmsuYWNjb3VudHMuZGV2JA' npx expo start --host lan --clear
```

Expected: Metro starts and serves `exp://192.168.1.5:8081` or the current LAN IP printed by Expo.

- [ ] **Step 5: Manual phone test in Expo Go**

On the phone:

1. Open `exp://192.168.1.5:8081` in Expo Go.
2. Tap Google sign-in from login.
3. Complete Google OAuth.
4. Confirm no “unmatched route” appears.
5. Confirm new Google user lands on `/complete-profile`.
6. Confirm email is prefilled and locked.
7. Confirm role selector appears first.
8. Select patient, fill required fields, submit, and confirm patient home loads.
9. Repeat with a fresh Google user for doctor, fill required fields, submit, and confirm doctor dashboard loads.
10. Try a Google account whose email already exists as a password account and confirm the duplicate message appears.

- [ ] **Step 6: Check Metro logs**

Poll Metro logs and confirm there are no recurring errors from:

```text
expo-notifications
Unmatched route
sso-callback
CONVEX M(users:register)
```

Expected: no recurring red error logs after successful app load and profile completion.

---

## Self-Review

- Spec coverage: all grill-me decisions are represented: Google first, `/complete-profile`, role selector first, same required fields, duplicate email block, locked Google email, logout allowed, `sso-callback` thin, index centralized routing, Arabic-only copy.
- Placeholder scan: no placeholder markers or unspecified “add tests” steps remain. Each task contains file paths, test commands, and code shape.
- Type consistency: route name is consistently `/complete-profile`; callback route is `sso-callback`; Convex query is `api.users.getProfileCompletionContext`; duplicate flag is `emailBelongsToAnotherUser`.
