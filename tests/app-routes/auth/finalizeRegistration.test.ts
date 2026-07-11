import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = () =>
  readFileSync(
    join(process.cwd(), 'app/(auth)/finalize-registration.tsx'),
    'utf8',
  );

describe('finalize registration route', () => {
  test('waits for Convex auth before creating the app account', () => {
    const text = source();

    expect(text).toContain('useConvexAuth');
    expect(text).toContain('isAuthenticated');
    expect(text).toContain('loadPendingRegistration');
    expect(text).toContain('api.users.registerAccount');
    expect(text).toContain('clearPendingRegistration');
    expect(text).toContain('captureAuthException');
    expect(text).toContain("router.replace('/(patient)')");
    expect(text).toContain("router.replace('/(doctor)/dashboard')");
  });
});
