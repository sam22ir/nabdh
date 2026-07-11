import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

const MAX_EXCEPTION_RANGE_DAYS = 60;

function parseDateOnly(date: string) {
  const parts = date.split('-').map(Number);
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isInteger(part)) ||
    parts[0] < 1900 ||
    parts[1] < 1 ||
    parts[1] > 12 ||
    parts[2] < 1 ||
    parts[2] > 31
  ) {
    throw new ConvexError('Invalid date format');
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateRange(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (end < start) {
    throw new ConvexError('Vacation end date must be on or after the start date');
  }

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDateOnly(current));
    if (dates.length > MAX_EXCEPTION_RANGE_DAYS) {
      throw new ConvexError('Vacation range is too long');
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function parseTimeMinutes(time: string) {
  const parts = time.split(':').map(Number);
  if (
    parts.length !== 2 ||
    parts.some((part) => !Number.isInteger(part)) ||
    parts[0] < 0 ||
    parts[0] > 23 ||
    parts[1] < 0 ||
    parts[1] > 59
  ) {
    throw new ConvexError('Invalid time format');
  }
  return parts[0] * 60 + parts[1];
}

function formatTimeMinutes(totalMinutes: number) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildSingleHourEndTime(startTime: string) {
  return formatTimeMinutes(parseTimeMinutes(startTime) + 60);
}

function assertTimeRange(startTime: string, endTime: string) {
  if (parseTimeMinutes(startTime) >= parseTimeMinutes(endTime)) {
    throw new ConvexError('Exception start time must be before end time');
  }
}

async function getAuthedDoctor(ctx: any) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'doctor') throw new ConvexError('Doctor account required');
  const doctor = await ctx.db
    .query('doctors')
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique();
  if (!doctor) throw new ConvexError('Doctor profile not found');
  return doctor;
}

async function getAcceptedMembership(ctx: any, clinicId: any, doctorId: any) {
  const memberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_clinicId_and_doctorId', (q: any) =>
      q.eq('clinicId', clinicId).eq('doctorId', doctorId),
    )
    .take(20);
  return memberships.find((membership: any) => membership.status === 'accepted') ?? null;
}

async function getAuthedClinic(ctx: any, user: any) {
  if (user.role !== 'clinic') throw new ConvexError('Clinic account required');
  const clinic = await ctx.db
    .query('clinics')
    .withIndex('by_ownerUserId', (q: any) => q.eq('ownerUserId', user._id))
    .unique();
  if (!clinic) throw new ConvexError('Clinic profile not found');
  return clinic;
}

async function assertCanManageClinicSchedule(
  ctx: any,
  clinicId: any,
  doctorId: any | undefined,
) {
  const user = await getAuthedUser(ctx);
  const clinic = await ctx.db.get(clinicId);
  if (!clinic) throw new ConvexError('Clinic not found');

  if (user.role === 'doctor') {
    const doctor = await ctx.db
      .query('doctors')
      .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
      .unique();
    if (!doctor) throw new ConvexError('Doctor profile not found');

    if (!doctorId && clinic.doctorId === doctor._id) {
      return { clinic, doctorId: undefined };
    }

    if (doctorId !== doctor._id) {
      throw new ConvexError('Clinic not found');
    }
    const membership = await getAcceptedMembership(ctx, clinicId, doctor._id);
    if (!membership) throw new ConvexError('Accepted clinic membership required');
    return { clinic, doctorId: doctor._id };
  }

  if (user.role === 'clinic') {
    const ownedClinic = await getAuthedClinic(ctx, user);
    if (ownedClinic._id !== clinicId) throw new ConvexError('Clinic not found');
    if (!doctorId) {
      return { clinic, doctorId: undefined };
    }
    const membership = await getAcceptedMembership(ctx, clinicId, doctorId);
    if (!membership) throw new ConvexError('Accepted clinic membership required');
    return { clinic, doctorId };
  }

  throw new ConvexError('Doctor or clinic account required');
}

async function listSchedulesByDoctor(ctx: any, doctorId: any) {
  const legacyClinics = await ctx.db
    .query('clinics')
    .withIndex('by_doctorId', (q: any) => q.eq('doctorId', doctorId))
    .take(20);

  const memberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_doctorId_and_status', (q: any) =>
      q.eq('doctorId', doctorId).eq('status', 'accepted'),
    )
    .take(20);

  const clinics = [...legacyClinics];
  const seenClinicIds = new Set(clinics.map((clinic) => clinic._id));
  for (const membership of memberships) {
    if (seenClinicIds.has(membership.clinicId)) continue;
    const clinic = await ctx.db.get(membership.clinicId);
    if (!clinic) continue;
    clinics.push(clinic);
    seenClinicIds.add(clinic._id);
  }

  const schedules = [];
  for (const clinic of clinics) {
    const clinicSchedules = await ctx.db
      .query('schedules')
      .withIndex('by_clinicId', (q: any) => q.eq('clinicId', clinic._id))
      .take(20);
    schedules.push(
      ...clinicSchedules
        .filter((schedule: any) => schedule.doctorId === undefined || schedule.doctorId === doctorId)
        .map((schedule: any) => ({ ...schedule, clinic })),
    );
  }
  return schedules;
}

export const getByDoctor = query({
  args: { doctorId: v.id('doctors') },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await listSchedulesByDoctor(ctx, args.doctorId);
  },
});

export const getByClinic = query({
  args: { clinicId: v.id('clinics') },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('schedules')
      .withIndex('by_clinicId', (q) => q.eq('clinicId', args.clinicId))
      .take(20);
  },
});

export const getMyClinicExceptions = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    const clinic = await getAuthedClinic(ctx, user);
    return await ctx.db
      .query('scheduleExceptions')
      .withIndex('by_clinicId_and_exceptionDate', (q) => q.eq('clinicId', clinic._id))
      .take(200);
  },
});

export const upsertDay = mutation({
  args: {
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    appointmentDurationMinutes: v.number(),
    isActive: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertCanManageClinicSchedule(ctx, args.clinicId, args.doctorId);

    const existing = args.doctorId
      ? await ctx.db
          .query('schedules')
          .withIndex('by_clinicId_and_doctorId_and_dayOfWeek', (q) =>
            q
              .eq('clinicId', args.clinicId)
              .eq('doctorId', args.doctorId)
              .eq('dayOfWeek', args.dayOfWeek),
          )
          .unique()
      : await ctx.db
          .query('schedules')
          .withIndex('by_clinicId_and_dayOfWeek', (q) =>
            q.eq('clinicId', args.clinicId).eq('dayOfWeek', args.dayOfWeek),
          )
          .unique();

    const values = {
      clinicId: args.clinicId,
      ...(args.doctorId ? { doctorId: args.doctorId } : {}),
      dayOfWeek: args.dayOfWeek,
      startTime: args.startTime,
      endTime: args.endTime,
      appointmentDurationMinutes: args.appointmentDurationMinutes,
      isActive: args.isActive,
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert('schedules', values);
  },
});

export const addException = mutation({
  args: {
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
    exceptionDate: v.string(),
    reason: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertCanManageClinicSchedule(ctx, args.clinicId, args.doctorId);
    return await ctx.db.insert('scheduleExceptions', {
      clinicId: args.clinicId,
      ...(args.doctorId ? { doctorId: args.doctorId } : {}),
      exceptionDate: args.exceptionDate,
      reason: args.reason,
    });
  },
});

export const addClinicException = mutation({
  args: {
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
    exceptionType: v.union(
      v.literal('single_hour'),
      v.literal('time_range'),
      v.literal('full_day'),
      v.literal('multi_day'),
    ),
    exceptionDate: v.string(),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await assertCanManageClinicSchedule(ctx, args.clinicId, args.doctorId);

    if (args.exceptionType === 'multi_day') {
      if (!args.endDate) {
        throw new ConvexError('End date is required for multi-day exceptions');
      }
      const dates = buildDateRange(args.exceptionDate, args.endDate);
      const exceptionIds = [];
      for (const exceptionDate of dates) {
        const existing = args.doctorId
          ? await ctx.db
              .query('scheduleExceptions')
              .withIndex('by_clinicId_and_doctorId_and_exceptionDate', (q) =>
                q
                  .eq('clinicId', args.clinicId)
                  .eq('doctorId', args.doctorId)
                  .eq('exceptionDate', exceptionDate),
              )
              .unique()
          : await ctx.db
              .query('scheduleExceptions')
              .withIndex('by_clinicId_and_exceptionDate', (q) =>
                q.eq('clinicId', args.clinicId).eq('exceptionDate', exceptionDate),
              )
              .unique();
        const values = {
          clinicId: args.clinicId,
          ...(args.doctorId ? { doctorId: args.doctorId } : {}),
          exceptionDate,
          endDate: args.endDate,
          reason: args.reason,
          exceptionType: 'multi_day' as const,
        };
        if (existing) {
          await ctx.db.patch(existing._id, values);
          exceptionIds.push(existing._id);
        } else {
          exceptionIds.push(await ctx.db.insert('scheduleExceptions', values));
        }
      }
      return { exceptionIds, count: exceptionIds.length };
    }

    let customStartTime: string | undefined;
    let customEndTime: string | undefined;

    if (args.exceptionType === 'single_hour') {
      if (!args.startTime) {
        throw new ConvexError('Start time is required for single-hour exceptions');
      }
      customStartTime = args.startTime;
      customEndTime = buildSingleHourEndTime(args.startTime);
      assertTimeRange(customStartTime, customEndTime);
    }

    if (args.exceptionType === 'time_range') {
      if (!args.startTime || !args.endTime) {
        throw new ConvexError('Start and end times are required for time-range exceptions');
      }
      assertTimeRange(args.startTime, args.endTime);
      customStartTime = args.startTime;
      customEndTime = args.endTime;
    }

    const existing = args.doctorId
      ? await ctx.db
          .query('scheduleExceptions')
          .withIndex('by_clinicId_and_doctorId_and_exceptionDate', (q) =>
            q
              .eq('clinicId', args.clinicId)
              .eq('doctorId', args.doctorId)
              .eq('exceptionDate', args.exceptionDate),
          )
          .take(50)
      : await ctx.db
          .query('scheduleExceptions')
          .withIndex('by_clinicId_and_exceptionDate', (q) =>
            q.eq('clinicId', args.clinicId).eq('exceptionDate', args.exceptionDate),
          )
          .take(50);

    const matching = existing.find((exception: any) => {
      const type = exception.exceptionType ?? 'full_day';
      return (
        type === args.exceptionType &&
        (exception.customStartTime ?? '') === (customStartTime ?? '') &&
        (exception.customEndTime ?? '') === (customEndTime ?? '')
      );
    });

    const values = {
      clinicId: args.clinicId,
      ...(args.doctorId ? { doctorId: args.doctorId } : {}),
      exceptionDate: args.exceptionDate,
      reason: args.reason,
      exceptionType: args.exceptionType,
      customStartTime,
      customEndTime,
    };

    if (matching) {
      await ctx.db.patch(matching._id, values);
      return { exceptionId: matching._id };
    }

    return { exceptionId: await ctx.db.insert('scheduleExceptions', values) };
  },
});

export const removeException = mutation({
  args: { exceptionId: v.id('scheduleExceptions') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const exception = await ctx.db.get(args.exceptionId);
    if (!exception) throw new ConvexError('Exception not found');
    await assertCanManageClinicSchedule(ctx, exception.clinicId, exception.doctorId);
    await ctx.db.delete(args.exceptionId);
    return { ok: true };
  },
});
