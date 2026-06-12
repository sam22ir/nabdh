import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireRole } from "./lib/auth";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

const scheduleFields = {
  _id: v.id("schedules"),
  _creationTime: v.number(),
  clinicId: v.id("clinics"),
  dayOfWeek: v.number(),
  startTime: v.string(),
  endTime: v.string(),
  appointmentDurationMinutes: v.number(),
  maxPatientsPerDay: v.number(),
  isActive: v.boolean(),
} as const;

const exceptionFields = {
  _id: v.id("scheduleExceptions"),
  _creationTime: v.number(),
  clinicId: v.id("clinics"),
  exceptionDate: v.string(),
  isClosed: v.boolean(),
  customStartTime: v.optional(v.string()),
  customEndTime: v.optional(v.string()),
  reason: v.string(),
} as const;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Throw unless the caller is the doctor who owns this clinic. */
async function requireClinicOwnership(
  ctx: MutationCtx,
  clinicId: Id<"clinics">,
): Promise<{ doctor: Doc<"doctors">; clinic: Doc<"clinics"> }> {
  const user = await requireRole(ctx, ["doctor"]);

  const doctor = await ctx.db
    .query("doctors")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (!doctor) throw new Error("Doctor profile not found");

  const clinic = await ctx.db.get(clinicId);
  if (!clinic) throw new Error("Clinic not found");
  if (clinic.doctorId !== doctor._id) throw new Error("You do not own this clinic");

  return { doctor, clinic };
}

function assertDayOfWeek(dayOfWeek: number) {
  if (
    !Number.isFinite(dayOfWeek) ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    throw new Error("dayOfWeek must be an integer between 0 and 6");
  }
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function timeToMinutes(time: string, label: string) {
  const match = time.match(timePattern);
  if (!match) {
    throw new Error(`${label} must use HH:mm 24-hour time`);
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function assertTimeWindow(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime, "startTime");
  const endMinutes = timeToMinutes(endTime, "endTime");

  if (startMinutes >= endMinutes) {
    throw new Error("startTime must be before endTime");
  }

  return { startMinutes, endMinutes };
}

function assertScheduleWindow(
  startTime: string,
  endTime: string,
  appointmentDurationMinutes: number,
) {
  const { startMinutes, endMinutes } = assertTimeWindow(startTime, endTime);
  if (appointmentDurationMinutes > endMinutes - startMinutes) {
    throw new Error("appointment duration must fit within the time window");
  }
}

function assertExceptionWindow(
  customStartTime: string | undefined,
  customEndTime: string | undefined,
) {
  if (customStartTime === undefined && customEndTime === undefined) return;
  if (customStartTime === undefined || customEndTime === undefined) {
    throw new Error("customStartTime and customEndTime must be provided together");
  }
  assertTimeWindow(customStartTime, customEndTime);
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Returns all schedule rows for a clinic (one per day of week).
 * Public — any visitor can see the weekly template.
 */
export const getByClinic = query({
  args: { clinicId: v.id("clinics") },
  returns: v.array(v.object(scheduleFields)),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("schedules")
      .withIndex("by_clinicId", (q) => q.eq("clinicId", args.clinicId))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      clinicId: r.clinicId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      appointmentDurationMinutes: r.appointmentDurationMinutes,
      maxPatientsPerDay: r.maxPatientsPerDay,
      isActive: r.isActive,
    }));
  },
});

/**
 * Returns all schedule rows across every active clinic for a doctor. Public so
 * the patient-facing doctor detail page can show each clinic's own hours.
 */
export const getByDoctor = query({
  args: { doctorId: v.id("doctors") },
  returns: v.array(v.object(scheduleFields)),
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) return [];

    const clinics = await ctx.db
      .query("clinics")
      .withIndex("by_doctorId", (q) => q.eq("doctorId", args.doctorId))
      .collect();

    const results: Array<Doc<"schedules">> = [];
    for (const clinic of clinics) {
      if (!clinic.isActive) continue;
      const schedules = await ctx.db
        .query("schedules")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .collect();
      results.push(...schedules);
    }

    return results.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      clinicId: r.clinicId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      appointmentDurationMinutes: r.appointmentDurationMinutes,
      maxPatientsPerDay: r.maxPatientsPerDay,
      isActive: r.isActive,
    }));
  },
});

/**
 * Returns the effective schedule for a specific date at a clinic, considering
 * any schedule exceptions (holidays, custom hours).
 *
 * 1. Checks for a schedule exception on the given date.
 *    - If the exception marks the clinic as closed, returns null.
 *    - If the exception has custom hours, those override the base schedule.
 * 2. Falls back to the recurring weekly schedule for the day-of-week.
 * 3. Returns null when the clinic has no active schedule for that day.
 *
 * Public.
 */
export const getByClinicAndDate = query({
  args: {
    clinicId: v.id("clinics"),
    date: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      clinicId: v.id("clinics"),
      date: v.string(),
      dayOfWeek: v.number(),
      startTime: v.string(),
      endTime: v.string(),
      appointmentDurationMinutes: v.number(),
      maxPatientsPerDay: v.number(),
      isException: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    // Derive day of week (0=Sunday through 6=Saturday, matching schema)
    const dayOfWeek = new Date(args.date + "T12:00:00").getDay();

    // 1. Check for a schedule exception on this date
    const exception = await ctx.db
      .query("scheduleExceptions")
      .withIndex("by_clinicId_and_date", (q) =>
        q.eq("clinicId", args.clinicId).eq("exceptionDate", args.date),
      )
      .unique();

    if (exception) {
      if (exception.isClosed) return null;

      // Look up the regular schedule for appointment-config details.
      const baseSchedule = await ctx.db
        .query("schedules")
        .withIndex("by_clinicId_and_dayOfWeek", (q) =>
          q.eq("clinicId", args.clinicId).eq("dayOfWeek", dayOfWeek),
        )
        .first();

      return {
        clinicId: args.clinicId,
        date: args.date,
        dayOfWeek,
        startTime: exception.customStartTime ?? baseSchedule?.startTime ?? "",
        endTime: exception.customEndTime ?? baseSchedule?.endTime ?? "",
        appointmentDurationMinutes:
          baseSchedule?.appointmentDurationMinutes ?? 30,
        maxPatientsPerDay: baseSchedule?.maxPatientsPerDay ?? 20,
        isException: true,
      };
    }

    // 2. No exception — use the recurring weekly schedule
    const schedule = await ctx.db
      .query("schedules")
      .withIndex("by_clinicId_and_dayOfWeek", (q) =>
        q.eq("clinicId", args.clinicId).eq("dayOfWeek", dayOfWeek),
      )
      .first();

    if (!schedule || !schedule.isActive) return null;

    return {
      clinicId: args.clinicId,
      date: args.date,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      appointmentDurationMinutes: schedule.appointmentDurationMinutes,
      maxPatientsPerDay: schedule.maxPatientsPerDay,
      isException: false,
    };
  },
});

/**
 * Returns all schedule entries across the authenticated doctor's clinics,
 * enriched with the clinic name.
 *
 * Requires authentication with role "doctor".
 */
export const getMySchedules = query({
  args: {},
  returns: v.array(
    v.object({
      ...scheduleFields,
      clinicName: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["doctor"]);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!doctor) return [];

    const clinics = await ctx.db
      .query("clinics")
      .withIndex("by_doctorId", (q) => q.eq("doctorId", doctor._id))
      .collect();

    const clinicNameMap = new Map(clinics.map((c) => [c._id, c.name]));

    const results: Array<{
      _id: Id<"schedules">;
      _creationTime: number;
      clinicId: Id<"clinics">;
      clinicName: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      appointmentDurationMinutes: number;
      maxPatientsPerDay: number;
      isActive: boolean;
    }> = [];

    for (const clinic of clinics) {
      const schedules = await ctx.db
        .query("schedules")
        .withIndex("by_clinicId", (q) => q.eq("clinicId", clinic._id))
        .collect();

      for (const s of schedules) {
        results.push({
          _id: s._id,
          _creationTime: s._creationTime,
          clinicId: s.clinicId,
          clinicName: clinicNameMap.get(s.clinicId) ?? "",
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          appointmentDurationMinutes: s.appointmentDurationMinutes,
          maxPatientsPerDay: s.maxPatientsPerDay,
          isActive: s.isActive,
        });
      }
    }

    return results;
  },
});

/**
 * Returns all one-off schedule exceptions for the authenticated doctor's
 * clinics, enriched with the clinic name for display.
 *
 * Requires authentication with role "doctor".
 */
export const getMyExceptions = query({
  args: {},
  returns: v.array(
    v.object({
      ...exceptionFields,
      clinicName: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["doctor"]);

    const doctor = await ctx.db
      .query("doctors")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!doctor) return [];

    const clinics = await ctx.db
      .query("clinics")
      .withIndex("by_doctorId", (q) => q.eq("doctorId", doctor._id))
      .collect();

    const results: Array<{
      _id: Id<"scheduleExceptions">;
      _creationTime: number;
      clinicId: Id<"clinics">;
      clinicName: string;
      exceptionDate: string;
      isClosed: boolean;
      customStartTime?: string;
      customEndTime?: string;
      reason: string;
    }> = [];

    for (const clinic of clinics) {
      const exceptions = await ctx.db
        .query("scheduleExceptions")
        .withIndex("by_clinicId_and_date", (q) =>
          q.eq("clinicId", clinic._id),
        )
        .collect();

      for (const exception of exceptions) {
        results.push({
          _id: exception._id,
          _creationTime: exception._creationTime,
          clinicId: exception.clinicId,
          clinicName: clinic.name,
          exceptionDate: exception.exceptionDate,
          isClosed: exception.isClosed,
          customStartTime: exception.customStartTime,
          customEndTime: exception.customEndTime,
          reason: exception.reason,
        });
      }
    }

    return results.sort((a, b) =>
      a.exceptionDate.localeCompare(b.exceptionDate),
    );
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

/**
 * Creates or updates a recurring schedule entry for a clinic on a specific
 * day of the week.
 *
 * If an entry already exists for the given clinic + dayOfWeek, it is patched
 * with the provided values. Otherwise a new entry is created.
 *
 * The caller must own the clinic (be the linked doctor).
 */
export const upsertDay = mutation({
  args: {
    clinicId: v.id("clinics"),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    appointmentDurationMinutes: v.number(),
    maxPatientsPerDay: v.number(),
    isActive: v.boolean(),
  },
  returns: v.id("schedules"),
  handler: async (ctx, args) => {
    await requireClinicOwnership(ctx, args.clinicId);

    assertDayOfWeek(args.dayOfWeek);
    assertPositiveInteger(
      args.appointmentDurationMinutes,
      "appointment duration",
    );
    assertPositiveInteger(args.maxPatientsPerDay, "max patients per day");
    assertScheduleWindow(
      args.startTime,
      args.endTime,
      args.appointmentDurationMinutes,
    );

    // Check for existing schedule on this day
    const existing = await ctx.db
      .query("schedules")
      .withIndex("by_clinicId_and_dayOfWeek", (q) =>
        q.eq("clinicId", args.clinicId).eq("dayOfWeek", args.dayOfWeek),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        startTime: args.startTime,
        endTime: args.endTime,
        appointmentDurationMinutes: args.appointmentDurationMinutes,
        maxPatientsPerDay: args.maxPatientsPerDay,
        isActive: args.isActive,
      });
      return existing._id;
    }

    return await ctx.db.insert("schedules", {
      clinicId: args.clinicId,
      dayOfWeek: args.dayOfWeek,
      startTime: args.startTime,
      endTime: args.endTime,
      appointmentDurationMinutes: args.appointmentDurationMinutes,
      maxPatientsPerDay: args.maxPatientsPerDay,
      isActive: args.isActive,
    });
  },
});

/**
 * Adds a one-off schedule exception for a clinic (holiday, custom hours,
 * closure). If an exception already exists for this clinic + date, it is
 * updated rather than duplicated.
 *
 * The caller must own the clinic.
 */
export const addException = mutation({
  args: {
    clinicId: v.id("clinics"),
    exceptionDate: v.string(),
    isClosed: v.boolean(),
    customStartTime: v.optional(v.string()),
    customEndTime: v.optional(v.string()),
    reason: v.string(),
  },
  returns: v.id("scheduleExceptions"),
  handler: async (ctx, args) => {
    await requireClinicOwnership(ctx, args.clinicId);
    assertExceptionWindow(args.customStartTime, args.customEndTime);

    // Upsert: avoid duplicate exception rows for the same clinic + date
    const existing = await ctx.db
      .query("scheduleExceptions")
      .withIndex("by_clinicId_and_date", (q) =>
        q.eq("clinicId", args.clinicId).eq("exceptionDate", args.exceptionDate),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isClosed: args.isClosed,
        customStartTime: args.customStartTime,
        customEndTime: args.customEndTime,
        reason: args.reason,
      });
      return existing._id;
    }

    return await ctx.db.insert("scheduleExceptions", {
      clinicId: args.clinicId,
      exceptionDate: args.exceptionDate,
      isClosed: args.isClosed,
      customStartTime: args.customStartTime,
      customEndTime: args.customEndTime,
      reason: args.reason,
    });
  },
});

/**
 * Deletes a schedule exception by its document ID.
 *
 * The caller must own the clinic that the exception belongs to.
 */
export const removeException = mutation({
  args: { exceptionId: v.id("scheduleExceptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const exception = await ctx.db.get(args.exceptionId);
    if (!exception) throw new Error("Exception not found");

    // Ownership check via clinic
    await requireClinicOwnership(ctx, exception.clinicId);

    await ctx.db.delete(args.exceptionId);
    return null;
  },
});
