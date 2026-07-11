import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = () =>
  readFileSync(join(process.cwd(), 'src/components/ClerkCaptcha.tsx'), 'utf8');

describe('ClerkCaptcha', () => {
  test('mounts the web captcha DOM element required by Clerk custom signup', () => {
    const text = source();

    expect(text).toContain("Platform.OS !== 'web'");
    expect(text).toContain('nativeID="clerk-captcha"');
  });
});
