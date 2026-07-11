import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const appPath = (...parts: string[]) => join(process.cwd(), 'app', ...parts);

describe('role-first auth route tree', () => {
  test('has patient, doctor, and clinic auth routes', () => {
    expect(existsSync(appPath('(auth)', 'patient', 'login.tsx'))).toBe(true);
    expect(existsSync(appPath('(auth)', 'patient', 'register.tsx'))).toBe(true);
    expect(existsSync(appPath('(auth)', 'doctor', 'login.tsx'))).toBe(true);
    expect(existsSync(appPath('(auth)', 'doctor', 'register.tsx'))).toBe(true);
    expect(existsSync(appPath('(auth)', 'clinic', 'login.tsx'))).toBe(true);
    expect(existsSync(appPath('(auth)', 'clinic', 'register.tsx'))).toBe(true);
  });

  test('removes old auth detour routes', () => {
    expect(existsSync(appPath('(auth)', 'onboarding.tsx'))).toBe(false);
    expect(existsSync(appPath('(auth)', 'login.tsx'))).toBe(false);
    expect(existsSync(appPath('(auth)', 'register.tsx'))).toBe(false);
    expect(existsSync(appPath('complete-profile.tsx'))).toBe(false);
    expect(existsSync(appPath('sso-callback.tsx'))).toBe(false);
  });

  test('root is role choice and not onboarding redirect', () => {
    const source = readFileSync(appPath('index.tsx'), 'utf8');
    expect(source).toContain('setStoredAuthRole');
    expect(source).toContain('/(auth)/patient/register');
    expect(source).toContain('/(auth)/doctor/register');
    expect(source).toContain('/(auth)/clinic/register');
    expect(source).not.toContain("route: '/(auth)/patient/login'");
    expect(source).not.toContain("route: '/(auth)/doctor/login'");
    expect(source).not.toContain("route: '/(auth)/clinic/login'");
    expect(source).not.toContain('/(auth)/onboarding');
    expect(source).not.toContain('/complete-profile');
    expect(source).not.toContain('getProfileCompletionContext');
  });
});
