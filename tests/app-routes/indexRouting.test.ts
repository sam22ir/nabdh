import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const indexSource = () =>
  readFileSync(join(process.cwd(), 'app/index.tsx'), 'utf8');

describe('welcome screen (role first, Google only)', () => {
  test('renders role cards and a single Google button', () => {
    const source = indexSource();
    expect(source).toContain('اختر نوع الحساب');
    expect(source).toContain('عميل');
    expect(source).toContain('مختص');
    expect(source).toContain('مركز');
    expect(source).toContain('setStoredAuthRole');
    expect(source).toContain('signInWithGoogle');
    expect(source).toContain('المتابعة باستخدام Google');
    expect(source).toContain('<LegalNotice />');
    expect(source).not.toMatch(/password|كلمة المرور|register|login/i);
  });

  test('routes signed-in users by backend role and sends new accounts to onboarding', () => {
    const source = indexSource();
    expect(source).toContain('api.users.me');
    expect(source).toContain("'/(patient)'");
    expect(source).toContain("'/(doctor)/dashboard'");
    expect(source).toContain("'/(clinic)/dashboard'");
    expect(source).toContain("router.replace('/onboarding')");
  });

  test('an existing account role wins over the tapped card', () => {
    const source = indexSource();
    expect(source).toContain('selectedRole !== role');
    expect(source).toContain('هذا الحساب مسجل كـ');
  });
});
