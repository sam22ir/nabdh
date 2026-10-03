import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Google-only onboarding', () => {
  test('auth screens contain only the legal documents', () => {
    const layout = source('app/(auth)/_layout.tsx');
    expect(layout).toContain('terms-of-use');
    expect(layout).toContain('privacy-policy');
    expect(layout).not.toContain('login');
    expect(layout).not.toContain('register');
  });

  test('no screen or library imports Clerk', () => {
    for (const file of ['app/_layout.tsx', 'app/index.tsx', 'app/onboarding.tsx', 'src/lib/auth.tsx']) {
      expect(source(file)).not.toMatch(/@clerk/);
    }
  });

  test('sign-in uses the Google ID token with Supabase', () => {
    const auth = source('src/lib/auth.tsx');
    expect(auth).toContain('signInWithIdToken');
    expect(auth).toContain("provider: 'google'");
    expect(auth).toContain('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  });

  test('clients are created without any form', () => {
    const onboarding = source('app/onboarding.tsx');
    expect(onboarding).toContain("role !== 'patient'");
    expect(onboarding).toContain('onboardPatient(legal)');
  });

  test('specialists get the "work alone" pop-up with a required center location', () => {
    const onboarding = source('app/onboarding.tsx');
    expect(onboarding).toContain('هل تعمل بمفردك؟');
    expect(onboarding).toContain('createSoloPractice');
    expect(onboarding).toContain('حدد موقع المركز.');
    expect(onboarding).toContain('applyDefaultSchedule');
  });

  test('centers require a location and treat phone as optional', () => {
    const onboarding = source('app/onboarding.tsx');
    expect(onboarding).toContain('LocationField');
    expect(onboarding).toContain('رقم الهاتف (اختياري)');
  });

  test('location is picked with GPS or an OpenStreetMap map, not Google Maps', () => {
    const field = source('src/components/LocationField.tsx');
    const html = source('src/lib/mapPickerHtml.ts');
    expect(field).toContain('requestForegroundPermissionsAsync');
    expect(html).toContain('tile.openstreetmap.org');
    expect(html).not.toContain('maps.googleapis.com');
  });

  test('settings can switch a solo specialist between the two roles', () => {
    expect(source('app/(doctor)/settings.tsx')).toContain('التبديل إلى حساب المركز');
    expect(source('app/(clinic)/settings.tsx')).toContain('التبديل إلى حساب المختص');
  });

  test('account deletion no longer needs a phone or password', () => {
    for (const file of ['patient', 'doctor', 'clinic']) {
      const screen = source(`app/(${file})/account-settings.tsx`);
      expect(screen).toContain('اكتب «حذف» للتأكيد');
      expect(screen).not.toMatch(/كلمة المرور|findAccountByIdentifier|signIn/);
    }
  });
});
