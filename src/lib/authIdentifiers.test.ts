import { describe, expect, test } from 'vitest';
import {
  normalizeEmailForAuth,
  normalizeOptionalEmail,
  normalizePhoneForAuth,
} from './authIdentifiers';

describe('auth identifier normalization', () => {
  test('normalizes phone numbers for password auth account ids', () => {
    expect(normalizePhoneForAuth('0555 12-34-56')).toBe('+213555123456');
    expect(normalizePhoneForAuth('0665 12 34 56')).toBe('+213665123456');
    expect(normalizePhoneForAuth('0775 12 34 56')).toBe('+213775123456');
    expect(normalizePhoneForAuth('+213 (555) 12 34 56')).toBe(
      '+213555123456',
    );
  });

  test('rejects non-Algerian phone numbers', () => {
    expect(() => normalizePhoneForAuth('123')).toThrow(/Algerian/i);
    expect(() => normalizePhoneForAuth('0445123456')).toThrow(/Algerian/i);
    expect(() => normalizePhoneForAuth('+33555123456')).toThrow(/Algerian/i);
  });

  test('keeps optional email blank when omitted and lowercases provided email', () => {
    expect(normalizeOptionalEmail('')).toEqual({
      email: undefined,
      emailNormalized: undefined,
    });
    expect(normalizeOptionalEmail('  PATIENT@Example.TEST  ')).toEqual({
      email: 'PATIENT@Example.TEST',
      emailNormalized: 'patient@example.test',
    });
  });

  test('normalizes and validates required email auth identifiers', () => {
    expect(normalizeEmailForAuth('  PATIENT@Example.TEST  ')).toBe('patient@example.test');
    expect(() => normalizeEmailForAuth('')).toThrow(/email/i);
    expect(() => normalizeEmailForAuth('not-an-email')).toThrow(/email/i);
  });
});
