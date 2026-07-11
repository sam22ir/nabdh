/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

describe('cleanup non-reference data', () => {
  test('dry run counts non-reference rows and keeps reference rows', async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const specialtyId = await ctx.db.insert('specialties', {
        name: 'طب القلب',
        icon: 'heart-pulse',
      });
      const userId = await ctx.db.insert('users', {
        tokenIdentifier: 'clerk|cleanup',
        fullName: 'حذف',
        gender: 'male',
        role: 'doctor',
        phone: '0555123456',
        phoneNormalized: '+213555123456',
        phoneLoginKey: 'dz213555123456',
        isActive: true,
      });
      await ctx.db.insert('doctors', {
        userId,
        specialtyId,
        bio: '',
        yearsOfExperience: 0,
        consultationFee: 0,
        followUpFee: 0,
        avgRating: 0,
        totalReviews: 0,
      });
    });

    const result = await t.mutation(api.cleanup.cleanupNonReferenceData, {
      dryRun: true,
      batchSize: 50,
    });

    expect(result.tables.users).toBe(1);
    expect(result.tables.doctors).toBe(1);
    expect(result.tables.specialties).toBeUndefined();
  });
});
