import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  AUTH_ROLE_STORAGE_KEY,
  getStoredAuthRole,
  setStoredAuthRole,
} from './roleSelection';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

describe('role selection persistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  test('returns null when no role is stored', async () => {
    expect(await getStoredAuthRole()).toBeNull();
  });

  test('stores patient role', async () => {
    await setStoredAuthRole('patient');
    expect(storage.get(AUTH_ROLE_STORAGE_KEY)).toBe('patient');
    expect(await getStoredAuthRole()).toBe('patient');
  });

  test('stores doctor role', async () => {
    await setStoredAuthRole('doctor');
    expect(storage.get(AUTH_ROLE_STORAGE_KEY)).toBe('doctor');
    expect(await getStoredAuthRole()).toBe('doctor');
  });

  test('stores clinic role', async () => {
    await setStoredAuthRole('clinic');
    expect(storage.get(AUTH_ROLE_STORAGE_KEY)).toBe('clinic');
    expect(await getStoredAuthRole()).toBe('clinic');
  });
});
