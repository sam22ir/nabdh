import { describe, expect, test } from 'vitest';
import {
  buildClerkPasswordIdentifier,
  buildClerkPasswordIdentifierFromLoginKey,
  buildPhoneIdentity,
  buildUniquePhoneLoginKey,
  normalizeOptionalEmail,
  validatePasswordPair,
} from './phone';

describe('buildPhoneIdentity', () => {
  test.each([
    ['0555123456', '+213555123456', 'dz213555123456', '0555123456'],
    ['  0555123456  ', '+213555123456', 'dz213555123456', '0555123456'],
    ['05 55 12 34 56', '+213555123456', 'dz213555123456', '05 55 12 34 56'],
    ['+213555123456', '+213555123456', 'dz213555123456', '+213555123456'],
    [
      '+213 555 123 456',
      '+213555123456',
      'dz213555123456',
      '+213 555 123 456',
    ],
    ['0666123456', '+213666123456', 'dz213666123456', '0666123456'],
    ['0777123456', '+213777123456', 'dz213777123456', '0777123456'],
  ])('normalizes %s', (raw, phoneNormalized, phoneLoginKey, phone) => {
    expect(buildPhoneIdentity(raw)).toEqual({
      phone,
      phoneNormalized,
      phoneLoginKey,
    });
  });

  test.each(['', '021123456', '0444123456', '+33123456789', '05551234'])(
    'rejects invalid Algerian mobile %s',
    (raw) => {
      expect(() => buildPhoneIdentity(raw)).toThrow(/phone/i);
    },
  );
});

describe('buildClerkPasswordIdentifier', () => {
  test('uses an internal username identifier derived from the phone number', () => {
    expect(buildClerkPasswordIdentifier('05 55 12 34 56')).toBe(
      'dz213555123456',
    );
  });

  test('builds an internal username identifier from a stored login key', () => {
    expect(buildClerkPasswordIdentifierFromLoginKey('dz213555123456x1')).toBe(
      'dz213555123456x1',
    );
  });

  test('can generate a unique login key when the deterministic Clerk identifier is orphaned', () => {
    expect(buildUniquePhoneLoginKey('05 55 12 34 56', 12345)).toBe(
      'dz213555123456x12345',
    );
  });
});

describe('normalizeOptionalEmail', () => {
  test('keeps blank email empty', () => {
    expect(normalizeOptionalEmail('   ')).toEqual({
      email: undefined,
      emailNormalized: undefined,
    });
  });

  test('normalizes provided email for duplicate checks', () => {
    expect(normalizeOptionalEmail('  USER@Example.TEST  ')).toEqual({
      email: 'USER@Example.TEST',
      emailNormalized: 'user@example.test',
    });
  });
});

describe('validatePasswordPair', () => {
  test('accepts matching strong passwords', () => {
    expect(validatePasswordPair('Nabdh2026', 'Nabdh2026')).toBeNull();
  });

  test('rejects short passwords', () => {
    expect(validatePasswordPair('1234567', '1234567')).toMatch(/8/);
  });

  test('rejects weak numeric passwords before Clerk does', () => {
    expect(validatePasswordPair('12345678', '12345678')).toMatch(/strong/i);
  });

  test('rejects mismatched passwords', () => {
    expect(validatePasswordPair('Nabdh2026', 'Nabdh2027')).toMatch(/match/i);
  });
});
