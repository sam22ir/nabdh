import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (file: 'login.tsx' | 'register.tsx') =>
  readFileSync(join(process.cwd(), 'app/(auth)/patient', file), 'utf8');

describe('patient auth routes', () => {
  test('login uses phone password Clerk flow without Google', () => {
    const text = source('login.tsx');
    expect(text).toContain('useSignIn');
    expect(text).toContain('api.users.findAccountByIdentifier');
    expect(text).toContain('buildClerkPasswordIdentifierFromLoginKey');
    expect(text).toContain('api.users.getLoginResolution');
    expect(text).not.toContain('useSSO');
    expect(text).not.toContain('Google');
    expect(text).not.toContain('makeRedirectUri');
    expect(text).not.toContain('i18n');
  });

  test('register creates patient account without removed fields', () => {
    const text = source('register.tsx');
    expect(text).toContain('useSignUp');
    expect(text).toContain('useSignIn');
    expect(text).toContain('ClerkCaptcha');
    expect(text).toContain('buildClerkPasswordIdentifier');
    expect(text).toContain('username: clerkIdentifier');
    expect(text).toContain('describeClerkSignUpState');
    expect(text).toContain('isClerkIdentifierExistsError');
    expect(text).toContain('signIn.create');
    expect(text).toContain('buildUniquePhoneLoginKey');
    expect(text).toContain('phoneLoginKey');
    expect(text).toContain('savePendingRegistration');
    expect(text).toContain('captureAuthException');
    expect(text).toContain("router.replace('/(auth)/finalize-registration')");
    expect(text).not.toContain('api.users.registerAccount');
    expect(text).toContain("role: 'patient'");
    expect(text).toContain('ScrollView');
    expect(text).not.toContain('غير مسجلين');
    expect(text).not.toContain('fullNameFr');
    expect(text).not.toContain('wilaya');
    expect(text).not.toContain('Google');
  });
});
