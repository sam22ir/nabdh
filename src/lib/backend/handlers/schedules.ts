import { mutation, requireUser, unwrap } from '../core';

// Sunday-Thursday, 09:00-16:00, 30-minute appointments.
const DEFAULT_DAYS = [0, 1, 2, 3, 4];

export const schedules = {
  /** One-tap default working hours for a specialist at a center. */
  applyDefaultSchedule: mutation(async (ctx, args: { clinicId: string; doctorId: string }) => {
    requireUser(ctx);
    unwrap(
      await ctx.db.from('schedules').upsert(
        DEFAULT_DAYS.map((day) => ({
          clinic_id: args.clinicId,
          doctor_id: args.doctorId,
          day_of_week: day,
          start_time: '09:00',
          end_time: '16:00',
          appointment_duration_minutes: 30,
          is_active: true,
        })),
        { onConflict: 'clinic_id,doctor_id,day_of_week' },
      ),
    );
    return { ok: true };
  }),
};
