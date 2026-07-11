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

async function seedClinicUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: 'clerk|clinic-settings',
      fullName: 'عيادة الإعدادات',
      role: 'clinic',
      phone: '+213555333444',
      phoneNormalized: '+213555333444',
      phoneLoginKey: 'dz213555333444',
      isActive: true,
    });
    const wilayaId = await ctx.db.insert('wilayas', {
      id: 16,
      name: 'الجزائر',
    });
    await ctx.db.insert('clinics', {
      ownerUserId: userId,
      name: 'عيادة الإعدادات',
      wilayaId,
      phone: '+213555333444',
      isActive: true,
    });
  });
}

describe('clinic settings persistence', () => {
  test('getMy returns defaults and updateMy persists attendance and notification preferences', async () => {
    const t = convexTest(schema, modules);
    await seedClinicUser(t);

    const defaults = await t
      .withIdentity(identity('clerk|clinic-settings'))
      .query(api.clinicSettings.getMy, {});

    expect(defaults).toMatchObject({
      autoCompleteAppointments: true,
      newBookingAlerts: true,
      cancellationAlerts: true,
      dailySummary: false,
    });

    await t
      .withIdentity(identity('clerk|clinic-settings'))
      .mutation(api.clinicSettings.updateMy, {
        autoCompleteAppointments: false,
        newBookingAlerts: false,
        cancellationAlerts: false,
        dailySummary: true,
      });

    const updated = await t
      .withIdentity(identity('clerk|clinic-settings'))
      .query(api.clinicSettings.getMy, {});

    expect(updated).toMatchObject({
      autoCompleteAppointments: false,
      newBookingAlerts: false,
      cancellationAlerts: false,
      dailySummary: true,
    });
  });
});
