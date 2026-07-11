import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const indexSource = () =>
  readFileSync(join(process.cwd(), 'app/index.tsx'), 'utf8');

describe('root role choice', () => {
  test('renders role choice for signed-out users', () => {
    const source = indexSource();
    expect(source).toContain('اختر نوع الحساب');
    expect(source).toContain('مريض');
    expect(source).toContain('طبيب');
    expect(source).toContain('عيادة');
    expect(source).toContain('setStoredAuthRole');
    expect(source).toContain('تسجيل الدخول');
    expect(source).toContain('إنشاء حساب');
    expect(source).toContain("loginRoute: '/(auth)/patient/login'");
    expect(source).toContain("registerRoute: '/(auth)/patient/register'");
    expect(source).toContain("loginRoute: '/(auth)/doctor/login'");
    expect(source).toContain("registerRoute: '/(auth)/doctor/register'");
    expect(source).toContain("loginRoute: '/(auth)/clinic/login'");
    expect(source).toContain("registerRoute: '/(auth)/clinic/register'");
    expect(source).not.toContain('/(auth)/onboarding');
    expect(source).not.toContain('/complete-profile');
  });

  test('routes signed-in users by backend role', () => {
    const source = indexSource();
    expect(source).toContain('api.users.me');
    expect(source).toContain("me.role === 'patient'");
    expect(source).toContain("router.replace('/(patient)')");
    expect(source).toContain("me.role === 'doctor'");
    expect(source).toContain("router.replace('/(doctor)/dashboard')");
    expect(source).toContain("me.role === 'clinic'");
    expect(source).toContain("router.replace('/(clinic)/dashboard')");
  });
});
