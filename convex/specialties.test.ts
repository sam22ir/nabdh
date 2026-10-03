import { describe, expect, test } from 'vitest';
import { specialtyDisplayName } from './lib/specialties';

describe('specialties.list', () => {
  test('uses a canonical name from legacy Arabic/French specialty rows', () => {
    expect(
      specialtyDisplayName({
        nameAr: 'طب القلب',
        nameFr: 'Cardiologie',
      }),
    ).toBe('القلب');
  });
});
