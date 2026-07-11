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

  test('seeds the extended medical specialty catalog without duplicates', async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.seed.seedReferenceData, {});
    await t.mutation(api.seed.seedReferenceData, {});
    const specialties = await t.query(api.specialties.list, {});
    const names = specialties.map((specialty) => specialty.name);

    expect(names).toContain('التشريح المرضي');
    expect(names).toContain('جراحة الوجه والفكين');
    expect(names).toContain('جراحة الصدر');
    expect(names).toContain('علم الأوبئة والطب الوقائي');
    expect(names).toContain('علم المناعة');
    expect(names).toContain('الأحياء الدقيقة الطبية');
    expect(names).toContain('علم الطفيليات');
    expect(names).toContain('الكيمياء الحيوية الطبية');
    expect(names).toContain('الإنعاش الطبي');
    expect(names).toContain('علاج الأورام بالإشعاع');
    expect(names).toContain('طب حديثي الولادة');
    expect(names).toContain('طب الألم');
    expect(new Set(names).size).toBe(names.length);
  });
});
