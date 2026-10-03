/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

describe('seedReferenceData', () => {
  test('seeds all 69 Algerian wilayas in official numeric order', async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.seed.seedReferenceData, {});
    const wilayas = await t.query(api.locations.listWilayas, {});

    expect(wilayas).toHaveLength(69);
    expect(wilayas[0]).toMatchObject({ id: 1, name: 'أدرار' });
    expect(wilayas[68]).toMatchObject({ id: 69, name: 'مسعد' });
  });

  test('seeds the extended specialty catalog without duplicates', async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.seed.seedReferenceData, {});
    await t.mutation(api.seed.seedReferenceData, {});
    const specialties = await t.query(api.specialties.list, {});
    const names = specialties.map((specialty) => specialty.name);

    expect(names).toContain('التشريح');
    expect(names).toContain('جراحة الوجه والفكين');
    expect(names).toContain('جراحة الصدر');
    expect(names).toContain('الوقاية');
    expect(names).toContain('علم المناعة');
    expect(names).toContain('الأحياء الدقيقة');
    expect(names).toContain('علم الطفيليات');
    expect(names).toContain('الكيمياء الحيوية');
    expect(names).toContain('الإنعاش');
    expect(names).toContain('الأورام والإشعاع');
    expect(names).toContain('حديثي الولادة');
    expect(names).toContain('الألم');
    expect(new Set(names).size).toBe(names.length);
  });
});
