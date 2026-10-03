/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);

const identity = (tokenIdentifier: string) => ({
  subject: tokenIdentifier.split('|').at(-1) ?? tokenIdentifier,
  tokenIdentifier,
});

async function seedDoctorUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|doctor-settings',
      fullName: 'مختص الإشعارات',
      gender: 'male',
      role: 'doctor',
      phone: '+213555333333',
      phoneNormalized: '+213555333333',
      phoneLoginKey: 'dz213555333333',
      isActive: true,
    });
  });
}

describe('doctor settings persistence', () => {
  test('getMy returns defaults and updateMy persists notification preferences', async () => {
    const t = convexTest(schema, modules);
    await seedDoctorUser(t);

    const defaults = await t
      .withIdentity(identity('clerk|doctor-settings'))
      .query(api.doctorSettings.getMy, {});

    expect(defaults).toMatchObject({
      newBookingAlerts: true,
      cancellationAlerts: true,
      dailySummary: false,
    });

    await t
      .withIdentity(identity('clerk|doctor-settings'))
      .mutation(api.doctorSettings.updateMy, {
        newBookingAlerts: false,
        cancellationAlerts: false,
        dailySummary: true,
      });

    const updated = await t
      .withIdentity(identity('clerk|doctor-settings'))
      .query(api.doctorSettings.getMy, {});

    expect(updated).toMatchObject({
      newBookingAlerts: false,
      cancellationAlerts: false,
      dailySummary: true,
    });
  });
});
