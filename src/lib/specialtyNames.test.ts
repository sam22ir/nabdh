import { describe, expect, test } from 'vitest';
import { specialtyDisplayName } from './specialtyNames';

describe('specialtyDisplayName', () => {
  test('prefers canonical name and falls back to current live Arabic names', () => {
    expect(
      specialtyDisplayName({
        name: 'طب القلب',
        nameAr: 'قديم',
        nameFr: 'Cardiologie',
      }),
    ).toBe('طب القلب');

    expect(
      specialtyDisplayName({
        nameAr: 'طب العيون',
        nameFr: 'Ophtalmologie',
      }),
    ).toBe('طب العيون');
  });
});
