import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthedUserId, requireRole } from "./lib/auth";
import { isPublicDoctorProfile } from "./lib/doctorVisibility";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Finds the patient record associated with a userId.
 */
async function getPatientByUserId(
  ctx: any,
  userId: string,
): Promise<Doc<"patients"> | null> {
  return await ctx.db
    .query("patients")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
}

/**
 * Finds the doctor record associated with a userId.
 */
async function getDoctorByUserId(
  ctx: any,
  userId: string,
): Promise<Doc<"doctors"> | null> {
  return await ctx.db
    .query("doctors")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
}

/**
 * Converts "HH:MM" to total minutes from midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight to "HH:MM" (zero-padded).
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Returns today's date (Algeria, UTC+1) as YYYY-MM-DD.
 */
function todayString(): string {
  const now = Date.now();
  const algeriaDate = new Date(now + 60 * 60 * 1000);
  const y = algeriaDate.getUTCFullYear();
  const month = String(algeriaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(algeriaDate.getUTCDate()).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

/**
 * Returns the Sunday (start of Algerian week) of the current week as YYYY-MM-DD.
 */
function weekStartString(): string {
  const now = Date.now();
  const algeriaDate = new Date(now + 60 * 60 * 1000);
  // getUTCDay() returns 0=Sun, so the week start offset is 0 days
  const dayOfWeek = algeriaDate.getUTCDay();
  const msPerDay = 86400000;
  const sunday = new Date(algeriaDate.getTime() - dayOfWeek * msPerDay);
  const y = sunday.getUTCFullYear();
  const m = String(sunday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sunday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the Saturday (end of Algerian week) of the current week as YYYY-MM-DD.
 */
function weekEndString(): string {
  const now = Date.now();
  const algeriaDate = new Date(now + 60 * 60 * 1000);
  const dayOfWeek = algeriaDate.getUTCDay();
  const msPerDay = 86400000;
  const saturday = new Date(algeriaDate.getTime() + (6 - dayOfWeek) * msPerDay);
  const y = saturday.getUTCFullYear();
  const m = String(saturday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(saturday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the last day of a given month as YYYY-MM-DD.
 * Month is 1-indexed (1 = January).
 */
function monthEndString(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Generates an array of time slot strings (HH:MM) from startTime to endTime
 * at intervals of durationMinutes.
 */
function generateSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
): string[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots: string[] = [];
  for (let t = start; t + durationMinutes <= end; t += durationMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

function isIsoDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isTimeString(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ConvexError(`Invalid schedule ${field}.`);
  }
}

async function validateBookableSlot(
  ctx: any,
  args: {
    clinicId: Id<"clinics">;
    appointmentDate: string;
    appointmentTime: string;
    excludeBookingId?: Id<"bookings">;
  },
): Promise<number> {
  if (!isIsoDateString(args.appointmentDate)) {
    throw new ConvexError("Appointment date must be a valid YYYY-MM-DD date.");
  }
  if (args.appointmentDate < todayString()) {
    throw new ConvexError("Appointment date must be today or in the future.");
  }
  if (!isTimeString(args.appointmentTime)) {
    throw new ConvexError("Appointment time must be a valid HH:MM time.");
  }

  const dateObj = new Date(`${args.appointmentDate}T00:00:00Z`);
  const dayOfWeek = dateObj.getUTCDay();

  const daySchedules = (
    await ctx.db
      .query("schedules")
      .withIndex("by_clinicId_and_dayOfWeek", (q: any) =>
        q.eq("clinicId", args.clinicId).eq("dayOfWeek", dayOfWeek),
      )
      .collect()
  ).filter((schedule: Doc<"schedules">) => schedule.isActive);

  if (daySchedules.length === 0) {
    throw new ConvexError("No active schedule is available for this date.");
  }

  const exception = await ctx.db
    .query("scheduleExceptions")
    .withIndex("by_clinicId_and_date", (q: any) =>
      q.eq("clinicId", args.clinicId).eq("exceptionDate", args.appointmentDate),
    )
    .first();

  if (exception?.isClosed) {
    throw new ConvexError("Clinic is closed on this date.");
  }

  let appointmentDuration: number | null = null;
  let dailyLimit = 0;

  for (const schedule of daySchedules) {
    assertPositiveInteger(
      schedule.appointmentDurationMinutes,
      "appointment duration",
    );
    assertPositiveInteger(schedule.maxPatientsPerDay, "daily patient limit");
    dailyLimit = Math.max(dailyLimit, schedule.maxPatientsPerDay);

    const startTime = exception?.customStartTime ?? schedule.startTime;
    const endTime = exception?.customEndTime ?? schedule.endTime;
    if (!isTimeString(startTime) || !isTimeString(endTime)) {
      throw new ConvexError("Invalid schedule time range.");
    }

    const slots = generateSlots(
      startTime,
      endTime,
      schedule.appointmentDurationMinutes,
    );
    if (slots.includes(args.appointmentTime)) {
      appointmentDuration = schedule.appointmentDurationMinutes;
    }
  }

  if (appointmentDuration === null) {
    throw new ConvexError("Appointment time is outside the active schedule.");
  }

  const sameDayBookings = await ctx.db
    .query("bookings")
    .withIndex("by_clinicId_and_date_and_time", (q: any) =>
      q.eq("clinicId", args.clinicId).eq("appointmentDate", args.appointmentDate),
    )
    .collect();

  const activeBookings = sameDayBookings.filter(
    (booking: Doc<"bookings">) =>
      booking.status !== "cancelled" && booking._id !== args.excludeBookingId,
  );

  if (activeBookings.some((booking: Doc<"bookings">) => booking.appointmentTime === args.appointmentTime)) {
    throw new ConvexError({
      code: "slot_taken",
      message: "This time slot is already booked.",
    });
  }

  if (activeBookings.length >= dailyLimit) {
    throw new ConvexError("Daily patient limit reached for this clinic.");
  }

  return appointmentDuration;
}

// ---------------------------------------------------------------------------
// Validator shapes (shared across functions to keep returns DRY)
// ---------------------------------------------------------------------------

const bookingCore = {
  _id: v.id("bookings"),
  _creationTime: v.number(),
  patientId: v.id("patients"),
  doctorId: v.id("doctors"),
  clinicId: v.id("clinics"),
  profileId: v.optional(v.id("patientProfiles")),
  appointmentDate: v.string(),
  appointmentTime: v.string(),
  appointmentDuration: v.number(),
  visitType: v.union(
    v.literal("first"),
    v.literal("followup"),
    v.literal("consultation"),
  ),
  reason: v.optional(v.string()),
  patientNote: v.optional(v.string()),
  doctorNote: v.optional(v.string()),
  status: v.union(
    v.literal("confirmed"),
    v.literal("cancelled"),
    v.literal("completed"),
    v.literal("no_show"),
  ),
  cancelledBy: v.optional(
    v.union(v.literal("patient"), v.literal("doctor"), v.literal("system")),
  ),
  cancellationReason: v.optional(v.string()),
  confirmedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
} as const;

/**
 * Booking with flat doctor + clinic fields, used for patient-facing lists.
 */
const bookingPatientListFields = {
  ...bookingCore,
  doctorName: v.string(),
  doctorSpecialtyNameFr: v.string(),
  doctorSpecialtyNameAr: v.string(),
  consultationFee: v.number(),
  clinicName: v.string(),
  clinicAddress: v.string(),
  clinicPhone: v.string(),
} as const;

/**
 * Booking with flat patient fields, used for doctor-facing lists.
 */
const bookingDoctorListFields = {
  ...bookingCore,
  patientName: v.string(),
  patientPhone: v.optional(v.string()),
  profileName: v.optional(v.string()),
} as const;

const appointmentStatusValidator = v.union(
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("completed"),
  v.literal("no_show"),
);

const visitTypeValidator = v.union(
  v.literal("first"),
  v.literal("followup"),
  v.literal("consultation"),
);

const doctorAppointmentFilterArgs = {
  query: v.optional(v.string()),
  status: v.optional(appointmentStatusValidator),
  visitType: v.optional(visitTypeValidator),
} as const;

const specialtyFields = {
  _id: v.id("specialties"),
  _creationTime: v.number(),
  nameAr: v.string(),
  nameFr: v.string(),
  icon: v.string(),
  parentId: v.optional(v.id("specialties")),
} as const;

type DoctorAppointmentFilters = {
  query?: string;
  status?: Doc<"bookings">["status"];
  visitType?: Doc<"bookings">["visitType"];
};

function matchesDoctorAppointmentFilters(
  booking: Doc<"bookings">,
  enriched: {
    patientName: string;
    patientPhone?: string;
    profileName?: string;
  },
  filters: DoctorAppointmentFilters,
) {
  if (filters.status && booking.status !== filters.status) return false;
  if (filters.visitType && booking.visitType !== filters.visitType) return false;

  const query = filters.query?.trim();
  if (!query) return true;

  const haystack = [
    enriched.patientName,
    enriched.patientPhone,
    enriched.profileName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

async function enrichAndFilterDoctorBookings(
  ctx: any,
  bookings: Doc<"bookings">[],
  filters: DoctorAppointmentFilters,
) {
  const results = [];
  for (const booking of bookings) {
    const enriched = await enrichBookingWithPatient(ctx, booking);
    if (matchesDoctorAppointmentFilters(booking, enriched, filters)) {
      results.push(enriched);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Computes available time slots for a given clinic and date.
 *
 * Algorithm:
 *  1. Resolve dayOfWeek from the date (0=Sunday, Algerian week).
 *  2. Load the schedule(s) for that clinic + dayOfWeek.
 *  3. Load schedule exceptions for that clinic + date.
 *  4. If an exception marks the day as closed, return empty.
 *  5. Generate slots from (custom) start_time to (custom) end_time at
 *     appointment_duration_minutes intervals.
 *  6. Subtract already-booked (non-cancelled) slots for that clinic+date.
 *
 * Public — no auth required.
 */
export const getAvailableSlots = query({
  args: { clinicId: v.id("clinics"), date: v.string() },
  returns: v.array(
    v.object({ time: v.string(), available: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    // 1. Resolve day of week (0=Sunday)
    const dateObj = new Date(args.date + "T00:00:00Z");
    const dayOfWeek = dateObj.getUTCDay();

    // 2. Get active schedules for this clinic + dayOfWeek
    const schedulesForDay = await ctx.db
      .query("schedules")
      .withIndex("by_clinicId_and_dayOfWeek", (q) =>
        q.eq("clinicId", args.clinicId).eq("dayOfWeek", dayOfWeek),
      )
      .collect();

    const daySchedules = schedulesForDay.filter((s) => s.isActive);
    if (daySchedules.length === 0) {
      return [];
    }

    // 3. Check for schedule exception on this date
    const exception = await ctx.db
      .query("scheduleExceptions")
      .withIndex("by_clinicId_and_date", (q: any) =>
        q.eq("clinicId", args.clinicId).eq("exceptionDate", args.date),
      )
      .first();

    if (exception?.isClosed) {
      return [];
    }

    // 4. Determine effective start/end/duration from schedule(s) and exceptions
    //    For simplicity, combine all matching schedules. If an exception provides
    //    custom hours, apply those instead.
    let intervalMinutes = daySchedules[0].appointmentDurationMinutes;

    let effectiveSchedules: { startTime: string; endTime: string }[];
    if (exception?.customStartTime && exception?.customEndTime) {
      effectiveSchedules = [
        { startTime: exception.customStartTime, endTime: exception.customEndTime },
      ];
      // Use the first schedule's duration if exception doesn't override it
    } else {
      effectiveSchedules = daySchedules.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    }

    // 5. Generate all candidate slots across effective schedules
    const candidateSlots = new Set<string>();
    for (const sch of effectiveSchedules) {
      const slots = generateSlots(sch.startTime, sch.endTime, intervalMinutes);
      for (const slot of slots) {
        candidateSlots.add(slot);
      }
    }

    // 6. Get already-booked (non-cancelled) slots for this clinic+date
    const bookedAppointments = await ctx.db
      .query("bookings")
      .withIndex("by_clinicId_and_date_and_time", (q: any) =>
        q.eq("clinicId", args.clinicId).eq("appointmentDate", args.date),
      )
      .collect();

    const bookedTimes = new Set<string>();
    for (const b of bookedAppointments) {
      if (b.status !== "cancelled") {
        bookedTimes.add(b.appointmentTime);
      }
    }

    // 7. Build result, sorted by time
    const sortedSlots = Array.from(candidateSlots).sort((a, b) =>
      a.localeCompare(b),
    );
    return sortedSlots.map((time) => ({
      time,
      available: !bookedTimes.has(time),
    }));
  },
});

/**
 * Returns the current patient's confirmed appointments (today + future),
 * sorted by date then time ascending. Each entry includes the doctor name
 * and clinic name.
 *
 * Auth required. Caller must have role "patient".
 */
export const listMyUpcoming = query({
  args: {},
  returns: v.array(v.object(bookingPatientListFields)),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);
    const patient = await getPatientByUserId(ctx, user._id);
    if (!patient) return [];

    const today = todayString();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_patientId", (q: any) => q.eq("patientId", patient._id))
      .collect();

    const upcoming = bookings
      .filter(
        (b) =>
          b.status === "confirmed" &&
          b.appointmentDate >= today,
      )
      .sort((a, b) => {
        const dateCmp = a.appointmentDate.localeCompare(b.appointmentDate);
        if (dateCmp !== 0) return dateCmp;
        return a.appointmentTime.localeCompare(b.appointmentTime);
      });

    const results = [];
    for (const b of upcoming) {
      results.push(await enrichBookingWithDoctorAndClinic(ctx, b));
    }
    return results;
  },
});

/**
 * Returns past / completed appointments for the current patient, sorted
 * by date descending.
 *
 * Auth required. Caller must have role "patient".
 */
export const listMyPast = query({
  args: {},
  returns: v.array(v.object(bookingPatientListFields)),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);
    const patient = await getPatientByUserId(ctx, user._id);
    if (!patient) return [];

    const today = todayString();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_patientId", (q: any) => q.eq("patientId", patient._id))
      .collect();

    const past = bookings
      .filter(
        (b) =>
          b.status === "completed" ||
          b.status === "no_show" ||
          (b.appointmentDate < today && b.status !== "cancelled"),
      )
      .sort((a, b) => {
        const dateCmp = b.appointmentDate.localeCompare(a.appointmentDate);
        if (dateCmp !== 0) return dateCmp;
        return b.appointmentTime.localeCompare(a.appointmentTime);
      });

    const results = [];
    for (const b of past) {
      results.push(await enrichBookingWithDoctorAndClinic(ctx, b));
    }
    return results;
  },
});

/**
 * Returns cancelled appointments for the current patient, sorted by
 * cancelledAt descending.
 *
 * Auth required. Caller must have role "patient".
 */
export const listMyCancelled = query({
  args: {},
  returns: v.array(v.object(bookingPatientListFields)),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);
    const patient = await getPatientByUserId(ctx, user._id);
    if (!patient) return [];

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_patientId", (q: any) => q.eq("patientId", patient._id))
      .collect();

    const cancelled = bookings
      .filter((b) => b.status === "cancelled")
      .sort((a, b) => {
        const ca = a.cancelledAt ?? 0;
        const cb = b.cancelledAt ?? 0;
        return cb - ca;
      });

    const results = [];
    for (const b of cancelled) {
      results.push(await enrichBookingWithDoctorAndClinic(ctx, b));
    }
    return results;
  },
});

/**
 * Returns today's appointments for the current doctor, sorted by time
 * ascending.
 *
 * Auth required. Caller must have role "doctor".
 */
export const listDoctorToday = query({
  args: {
    date: v.optional(v.string()),
    ...doctorAppointmentFilterArgs,
  },
  returns: v.array(v.object(bookingDoctorListFields)),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);
    if (!doctor) return [];

    const today = args.date ?? todayString();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_doctorId_and_date", (q: any) =>
        q.eq("doctorId", doctor._id).eq("appointmentDate", today),
      )
      .collect();

    const sorted = bookings.sort((a, b) =>
      a.appointmentTime.localeCompare(b.appointmentTime),
    );

    return await enrichAndFilterDoctorBookings(ctx, sorted, args);
  },
});

/**
 * Returns this week's appointments grouped by day for the current doctor.
 *
 * Auth required. Caller must have role "doctor".
 */
export const listDoctorWeek = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    ...doctorAppointmentFilterArgs,
  },
  returns: v.object({
    startDate: v.string(),
    endDate: v.string(),
    days: v.array(
      v.object({
        date: v.string(),
        appointments: v.array(v.object(bookingDoctorListFields)),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);

    const start = args.startDate ?? weekStartString();
    const end = args.endDate ?? weekEndString();
    if (!doctor) return { startDate: start, endDate: end, days: [] };

    // Collect all bookings for the doctor within the week range
    const weekBookings = await ctx.db
      .query("bookings")
      .withIndex("by_doctorId_and_date", (q: any) =>
        q
          .eq("doctorId", doctor._id)
          .gte("appointmentDate", start)
          .lte("appointmentDate", end),
      )
      .collect();

    // Group by date
    const grouped: Record<string, typeof weekBookings> = {};
    for (const b of weekBookings) {
      if (!grouped[b.appointmentDate]) {
        grouped[b.appointmentDate] = [];
      }
      grouped[b.appointmentDate].push(b);
    }

    // Sort dates, then sort appointments within each date by time
    const sortedDates = Object.keys(grouped).sort();
    const days = [];
    for (const date of sortedDates) {
      const sortedAppts = grouped[date].sort((a, b) =>
        a.appointmentTime.localeCompare(b.appointmentTime),
      );
      const enriched = await enrichAndFilterDoctorBookings(
        ctx,
        sortedAppts,
        args,
      );
      if (enriched.length > 0) {
        days.push({ date, appointments: enriched });
      }
    }

    return { startDate: start, endDate: end, days };
  },
});

/**
 * Returns days with appointment counts for a given month for the current
 * doctor.
 *
 * Auth required. Caller must have role "doctor".
 */
export const listDoctorMonth = query({
  args: {
    year: v.number(),
    month: v.number(),
    ...doctorAppointmentFilterArgs,
  },
  returns: v.object({
    days: v.array(
      v.object({
        date: v.string(),
        total: v.number(),
        confirmed: v.number(),
        completed: v.number(),
        cancelled: v.number(),
        appointments: v.array(v.object(bookingDoctorListFields)),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);
    if (!doctor) return { days: [] };

    const monthStart = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const monthEnd = monthEndString(args.year, args.month);

    const monthBookings = await ctx.db
      .query("bookings")
      .withIndex("by_doctorId_and_date", (q: any) =>
        q
          .eq("doctorId", doctor._id)
          .gte("appointmentDate", monthStart)
          .lte("appointmentDate", monthEnd),
      )
      .collect();

    // Group by date with counts per status
    const grouped: Record<
      string,
      {
        total: number;
        confirmed: number;
        completed: number;
        cancelled: number;
        appointments: typeof monthBookings;
      }
    > = {};

    for (const b of monthBookings) {
      if (!grouped[b.appointmentDate]) {
        grouped[b.appointmentDate] = {
          total: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          appointments: [],
        };
      }
      grouped[b.appointmentDate].total++;
      if (b.status === "confirmed") grouped[b.appointmentDate].confirmed++;
      if (b.status === "completed") grouped[b.appointmentDate].completed++;
      if (b.status === "cancelled") grouped[b.appointmentDate].cancelled++;
      grouped[b.appointmentDate].appointments.push(b);
    }

    const sortedDates = Object.keys(grouped).sort();
    const days = [];
    for (const date of sortedDates) {
      const sortedAppts = grouped[date].appointments.sort((a, b) =>
        a.appointmentTime.localeCompare(b.appointmentTime),
      );
      const enriched = await enrichAndFilterDoctorBookings(
        ctx,
        sortedAppts,
        args,
      );
      if (enriched.length === 0) {
        continue;
      }
      days.push({
        date,
        total: enriched.length,
        confirmed: enriched.filter((b) => b.status === "confirmed").length,
        completed: enriched.filter((b) => b.status === "completed").length,
        cancelled: enriched.filter((b) => b.status === "cancelled").length,
        appointments: enriched,
      });
    }

    return { days };
  },
});

/**
 * Returns a single appointment with patient, doctor, and clinic data joined.
 *
 * Auth required. The caller must be the patient or doctor involved in the
 * booking.
 */
export const getById = query({
  args: { bookingId: v.id("bookings") },
  returns: v.union(
    v.null(),
    v.object({
      ...bookingCore,
      patient: v.object({
        _id: v.id("patients"),
        dateOfBirth: v.string(),
        gender: v.union(v.literal("male"), v.literal("female")),
        bloodType: v.optional(
          v.union(
            v.literal("A+"),
            v.literal("A-"),
            v.literal("B+"),
            v.literal("B-"),
            v.literal("AB+"),
            v.literal("AB-"),
            v.literal("O+"),
            v.literal("O-"),
          ),
        ),
        chronicDiseases: v.array(v.string()),
        allergies: v.array(v.string()),
        emergencyContactName: v.optional(v.string()),
        emergencyContactPhone: v.optional(v.string()),
        user: v.object({
          name: v.optional(v.string()),
          fullNameAr: v.optional(v.string()),
          fullNameFr: v.optional(v.string()),
          phone: v.optional(v.string()),
          email: v.optional(v.string()),
        }),
      }),
      doctor: v.object({
        _id: v.id("doctors"),
        specialtyId: v.id("specialties"),
        consultationFee: v.number(),
        followUpFee: v.number(),
        avgRating: v.number(),
        totalReviews: v.number(),
        yearsOfExperience: v.number(),
        languages: v.array(v.string()),
        isVerified: v.boolean(),
        user: v.object({
          name: v.optional(v.string()),
          fullNameAr: v.optional(v.string()),
          fullNameFr: v.optional(v.string()),
        }),
        specialty: v.object({
          nameAr: v.string(),
          nameFr: v.string(),
        }),
      }),
      clinic: v.object({
        _id: v.id("clinics"),
        name: v.string(),
        address: v.string(),
        phone: v.string(),
        wilayaId: v.id("wilayas"),
      }),
      profile: v.union(
        v.null(),
        v.object({
          _id: v.id("patientProfiles"),
          fullNameAr: v.string(),
          dateOfBirth: v.string(),
          gender: v.union(v.literal("male"), v.literal("female")),
          bloodType: v.optional(
            v.union(
              v.literal("A+"),
              v.literal("A-"),
              v.literal("B+"),
              v.literal("B-"),
              v.literal("AB+"),
              v.literal("AB-"),
              v.literal("O+"),
              v.literal("O-"),
            ),
          ),
          chronicDiseases: v.array(v.string()),
          allergies: v.array(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    // Auth: caller must be the patient or doctor involved
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const patient = await getPatientByUserId(ctx, userId);
    const doctor = await getDoctorByUserId(ctx, userId);

    const isPatient = patient?._id === booking.patientId;
    const isDoctor = doctor?._id === booking.doctorId;
    const isSuperAdmin = user.role === "super_admin";

    if (!isPatient && !isDoctor && !isSuperAdmin) {
      throw new ConvexError("Access denied. You are not involved in this booking.");
    }

    // Enrich with joined data
    return await enrichBookingFully(ctx, booking);
  },
});

/**
 * Combined patient home screen query. Returns user greeting info, next
 * upcoming appointment, nearby doctors (same wilaya, verified), and common
 * specialties. Single query to avoid client-side waterfalls.
 *
 * Auth required. Caller must have role "patient".
 */
export const getHomeData = query({
  args: {},
  returns: v.object({
    greetingName: v.optional(v.string()),
    nextAppointment: v.union(v.null(), v.object(bookingPatientListFields)),
    nearbyDoctors: v.array(
      v.object({
        doctorId: v.id("doctors"),
        doctorName: v.string(),
        specialtyNameFr: v.string(),
        specialtyNameAr: v.string(),
        consultationFee: v.number(),
        avgRating: v.number(),
        totalReviews: v.number(),
        clinicId: v.id("clinics"),
        clinicName: v.string(),
        clinicAddress: v.string(),
        clinicPhone: v.string(),
      }),
    ),
    commonSpecialties: v.array(v.object(specialtyFields)),
  }),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["patient"]);
    const patient = await getPatientByUserId(ctx, user._id);

    const greetingName = user.fullNameAr ?? user.name ?? null;

    // ----- Next upcoming appointment -----
    let nextAppointment: any = null;
    if (patient) {
      const today = todayString();
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_patientId", (q: any) => q.eq("patientId", patient._id))
        .collect();

      const upcoming = bookings
        .filter(
          (b) =>
            b.status === "confirmed" && b.appointmentDate >= today,
        )
        .sort((a, b) => {
          const dateCmp = a.appointmentDate.localeCompare(b.appointmentDate);
          if (dateCmp !== 0) return dateCmp;
          return a.appointmentTime.localeCompare(b.appointmentTime);
        });

      if (upcoming.length > 0) {
        nextAppointment = await enrichBookingWithDoctorAndClinic(
          ctx,
          upcoming[0],
        );
      }
    }

    // ----- Nearby doctors (same wilaya, completed public profile) -----
    const nearbyDoctors: any[] = [];
    if (user.wilayaId) {
      const nearbyClinics = await ctx.db
        .query("clinics")
        .withIndex("by_wilaya", (q: any) => q.eq("wilayaId", user.wilayaId!))
        .take(20);

      const seenDoctorIds = new Set<string>();
      for (const clinic of nearbyClinics) {
        if (nearbyDoctors.length >= 5) break;
        if (seenDoctorIds.has(clinic.doctorId)) continue;
        seenDoctorIds.add(clinic.doctorId);

        const doctor = await ctx.db.get(clinic.doctorId);
        if (!doctor || !isPublicDoctorProfile(doctor)) continue;

        const docUser = await ctx.db.get(doctor.userId);
        const specialty = await ctx.db.get(doctor.specialtyId);

        nearbyDoctors.push({
          doctorId: doctor._id,
          doctorName: docUser?.name ?? docUser?.fullNameAr ?? "",
          specialtyNameFr: specialty?.nameFr ?? "",
          specialtyNameAr: specialty?.nameAr ?? "",
          consultationFee: doctor.consultationFee,
          avgRating: doctor.avgRating,
          totalReviews: doctor.totalReviews,
          clinicId: clinic._id,
          clinicName: clinic.name,
          clinicAddress: clinic.address,
          clinicPhone: clinic.phone,
        });
      }
    }

    // ----- Common specialties (top-level specialties, limited to 8) -----
    const allSpecialties = await ctx.db.query("specialties").collect();
    // Prefer top-level (parentId === undefined) specialties
    const topLevel = allSpecialties
      .filter((s) => s.parentId === undefined)
      .slice(0, 8);
    const commonSpecialties = topLevel.length > 0
      ? topLevel.map((s) => ({
          _id: s._id,
          _creationTime: s._creationTime,
          nameAr: s.nameAr,
          nameFr: s.nameFr,
          icon: s.icon,
          parentId: s.parentId,
        }))
      : allSpecialties.slice(0, 8).map((s) => ({
          _id: s._id,
          _creationTime: s._creationTime,
          nameAr: s.nameAr,
          nameFr: s.nameFr,
          icon: s.icon,
          parentId: s.parentId,
        }));

    return {
      greetingName: greetingName ?? undefined,
      nextAppointment,
      nearbyDoctors,
      commonSpecialties,
    };
  },
});

/**
 * Combined doctor home screen query. Returns today's stats (total,
 * confirmed, completed, cancelled counts), the next patient, and today's
 * appointment list.
 *
 * Auth required. Caller must have role "doctor".
 */
export const getHomeDataDoctor = query({
  args: {},
  returns: v.object({
    todayStats: v.object({
      total: v.number(),
      confirmed: v.number(),
      completed: v.number(),
      cancelled: v.number(),
      noShow: v.number(),
    }),
    nextPatient: v.union(v.null(), v.object(bookingDoctorListFields)),
    todayAppointments: v.array(v.object(bookingDoctorListFields)),
  }),
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);
    if (!doctor) {
      return {
        todayStats: { total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 },
        nextPatient: null,
        todayAppointments: [],
      };
    }

    const today = todayString();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_doctorId_and_date", (q: any) =>
        q.eq("doctorId", doctor._id).eq("appointmentDate", today),
      )
      .collect();

    // Stats
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;
    const noShow = bookings.filter((b) => b.status === "no_show").length;

    // Sort by time
    const sorted = bookings.sort((a, b) =>
      a.appointmentTime.localeCompare(b.appointmentTime),
    );

    // Enrich with patient data
    const enriched = [];
    for (const b of sorted) {
      enriched.push(await enrichBookingWithPatient(ctx, b));
    }

    // Next patient = earliest confirmed appointment
    const nextPatient =
      enriched.find((b) => b.status === "confirmed") ?? null;

    return {
      todayStats: { total, confirmed, completed, cancelled, noShow },
      nextPatient,
      todayAppointments: enriched,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Creates a new booking. Before inserting, checks for an existing
 * non-cancelled booking at the same clinic + date + time (using the
 * by_clinicId_and_date_and_time index). If a conflict is found, throws a
 * ConvexError with code "slot_taken".
 *
 * On success, inserts a notification for the doctor.
 *
 * Auth required. Caller must have role "patient".
 */
export const create = mutation({
  args: {
    clinicId: v.id("clinics"),
    doctorId: v.id("doctors"),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
    visitType: v.union(
      v.literal("first"),
      v.literal("followup"),
      v.literal("consultation"),
    ),
    reason: v.optional(v.string()),
    patientNote: v.optional(v.string()),
    profileId: v.optional(v.id("patientProfiles")),
  },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["patient"]);
    const patient = await getPatientByUserId(ctx, user._id);
    if (!patient) {
      throw new ConvexError("Patient profile not found. Please complete registration.");
    }

    const [doctor, clinic, profile] = await Promise.all([
      ctx.db.get(args.doctorId),
      ctx.db.get(args.clinicId),
      args.profileId ? ctx.db.get(args.profileId) : Promise.resolve(null),
    ]);

    if (!doctor) {
      throw new ConvexError("Doctor not found.");
    }
    if (!isPublicDoctorProfile(doctor)) {
      throw new ConvexError("Cannot book with an incomplete doctor profile.");
    }
    if (!clinic) {
      throw new ConvexError("Clinic not found.");
    }
    if (!clinic.isActive) {
      throw new ConvexError("Clinic is not active.");
    }
    if (clinic.doctorId !== args.doctorId) {
      throw new ConvexError("Clinic does not belong to the requested doctor.");
    }
    if (args.profileId) {
      if (!profile) {
        throw new ConvexError("Patient profile not found.");
      }
      if (profile.parentUserId !== user._id) {
        throw new ConvexError("Patient profile does not belong to the authenticated user.");
      }
    }

    const appointmentDuration = await validateBookableSlot(ctx, {
      clinicId: args.clinicId,
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
    });

    // --- Insert booking ---
    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      patientId: patient._id,
      doctorId: args.doctorId,
      clinicId: args.clinicId,
      profileId: args.profileId,
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
      appointmentDuration,
      visitType: args.visitType,
      reason: args.reason,
      patientNote: args.patientNote,
      status: "confirmed",
      confirmedAt: now,
    });

    // --- Notify doctor ---
    await ctx.runMutation(internal.notifications.create, {
      userId: doctor.userId,
      type: "new_booking",
      title: "Nouvelle réservation",
      body: `Un patient a réservé pour le ${args.appointmentDate} à ${args.appointmentTime}`,
      data: {
        bookingId,
        doctorId: args.doctorId,
        clinicId: args.clinicId,
        appointmentDate: args.appointmentDate,
        appointmentTime: args.appointmentTime,
      },
    });

    return bookingId;
  },
});

/**
 * Cancels a booking. The caller must be the patient or the doctor on this
 * booking. Doctor cancellations set cancelledBy="doctor"; patient
 * cancellations set "patient". Creates a notification for the other party.
 *
 * Auth required.
 */
export const cancel = mutation({
  args: {
    bookingId: v.id("bookings"),
    cancellationReason: v.optional(v.string()),
  },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const userId = await getAuthedUserId(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    if (booking.status === "cancelled") {
      throw new ConvexError("Booking is already cancelled.");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError("User not found.");
    }

    const patient = await getPatientByUserId(ctx, userId);
    const doctor = await getDoctorByUserId(ctx, userId);

    const isPatient = patient?._id === booking.patientId;
    const isDoctor = doctor?._id === booking.doctorId;

    if (!isPatient && !isDoctor) {
      throw new ConvexError(
        "Access denied. Only the patient or doctor can cancel this booking.",
      );
    }

    const cancelledBy = isDoctor ? "doctor" : "patient";

    const now = Date.now();
    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      cancelledBy,
      cancellationReason: args.cancellationReason,
      cancelledAt: now,
    });

    // Notify the other party
    if (isPatient && doctor) {
      // Notify doctor
      await ctx.runMutation(internal.notifications.create, {
        userId: doctor.userId,
        type: "booking_cancelled",
        title: "Réservation annulée",
        body: `Un patient a annulé sa réservation du ${booking.appointmentDate} à ${booking.appointmentTime}.`,
        data: {
          bookingId: args.bookingId,
          doctorId: booking.doctorId,
          clinicId: booking.clinicId,
          cancelledBy: "patient",
        },
      });
    } else if (isDoctor && patient) {
      // Notify patient
      const patientUser = await ctx.db.get(patient.userId);
      if (patientUser) {
        await ctx.runMutation(internal.notifications.create, {
          userId: patientUser._id,
          type: "booking_cancelled",
          title: "Réservation annulée",
          body: `Le docteur a annulé votre réservation du ${booking.appointmentDate} à ${booking.appointmentTime}.`,
          data: {
            bookingId: args.bookingId,
            clinicId: booking.clinicId,
            cancelledBy: "doctor",
          },
        });
      }
    }

    return args.bookingId;
  },
});

/**
 * Marks a booking as completed. Only the doctor assigned to this booking
 * can mark it as completed.
 *
 * Auth required. Caller must have role "doctor".
 */
export const markCompleted = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);
    if (!doctor) {
      throw new ConvexError("Doctor profile not found.");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    if (booking.doctorId !== doctor._id) {
      throw new ConvexError(
        "Access denied. You can only mark your own bookings as completed.",
      );
    }

    if (booking.status !== "confirmed") {
      throw new ConvexError(
        `Cannot mark a booking with status "${booking.status}" as completed. Only confirmed bookings can be completed.`,
      );
    }

    await ctx.db.patch(args.bookingId, {
      status: "completed",
      completedAt: Date.now(),
    });

    // Notify the patient asking for a review
    const patient = await ctx.db.get(booking.patientId);
    if (patient) {
      await ctx.runMutation(internal.notifications.create, {
        userId: patient.userId,
        type: "booking_completed",
        title: "Consultation terminee",
        body: "Votre consultation est terminee. Merci de laisser un avis.",
        data: {
          bookingId: args.bookingId,
          doctorId: booking.doctorId,
          clinicId: booking.clinicId,
        },
      });
    }

    return args.bookingId;
  },
});

/**
 * Marks a booking as no-show. Only the doctor assigned to this booking
 * can mark it as no-show.
 *
 * Auth required. Caller must have role "doctor".
 */
export const markNoShow = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);
    if (!doctor) {
      throw new ConvexError("Doctor profile not found.");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    if (booking.doctorId !== doctor._id) {
      throw new ConvexError(
        "Access denied. You can only mark your own bookings as no-show.",
      );
    }

    if (booking.status !== "confirmed") {
      throw new ConvexError(
        `Cannot mark a booking with status "${booking.status}" as no-show.`,
      );
    }

    await ctx.db.patch(args.bookingId, {
      status: "no_show",
    });

    return args.bookingId;
  },
});

/**
 * Updates the doctor's private note on a booking. Only the assigned doctor
 * can write this field.
 */
export const updateDoctorNote = mutation({
  args: {
    bookingId: v.id("bookings"),
    doctorNote: v.string(),
  },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["doctor"]);
    const doctor = await getDoctorByUserId(ctx, user._id);
    if (!doctor) {
      throw new ConvexError("Doctor profile not found.");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    if (booking.doctorId !== doctor._id) {
      throw new ConvexError(
        "Access denied. You can only update notes for your own bookings.",
      );
    }

    const doctorNote = args.doctorNote.trim();
    await ctx.db.patch(args.bookingId, {
      doctorNote: doctorNote.length > 0 ? doctorNote : undefined,
    });

    return args.bookingId;
  },
});

/**
 * Patient reschedules to a new slot. Cancels the old booking and creates a
 * new one in a single mutation. The new slot is checked for availability
 * first.
 *
 * Auth required. Caller must have role "patient".
 */
export const reschedule = mutation({
  args: {
    bookingId: v.id("bookings"),
    newDate: v.string(),
    newTime: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["patient"]);
    const patient = await getPatientByUserId(ctx, user._id);
    if (!patient) {
      throw new ConvexError("Patient profile not found.");
    }

    // --- Get the old booking ---
    const oldBooking = await ctx.db.get(args.bookingId);
    if (!oldBooking) {
      throw new ConvexError("Booking not found.");
    }

    if (oldBooking.patientId !== patient._id) {
      throw new ConvexError("Access denied. You can only reschedule your own bookings.");
    }

    if (oldBooking.status !== "confirmed") {
      throw new ConvexError("Only confirmed bookings can be rescheduled.");
    }

    const appointmentDuration = await validateBookableSlot(ctx, {
      clinicId: oldBooking.clinicId,
      appointmentDate: args.newDate,
      appointmentTime: args.newTime,
      excludeBookingId: args.bookingId,
    });

    const now = Date.now();

    // --- Cancel old booking ---
    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      cancelledBy: "patient",
      cancellationReason: args.reason ?? "Rescheduled by patient",
      cancelledAt: now,
    });

    // --- Create new booking ---
    const newBookingId = await ctx.db.insert("bookings", {
      patientId: patient._id,
      doctorId: oldBooking.doctorId,
      clinicId: oldBooking.clinicId,
      profileId: oldBooking.profileId,
      appointmentDate: args.newDate,
      appointmentTime: args.newTime,
      appointmentDuration,
      visitType: oldBooking.visitType,
      reason: oldBooking.reason,
      patientNote: oldBooking.patientNote,
      status: "confirmed",
      confirmedAt: now,
    });

    // --- Notify doctor about reschedule ---
    const doctor = await ctx.db.get(oldBooking.doctorId);
    if (doctor) {
      await ctx.runMutation(internal.notifications.create, {
        userId: doctor.userId,
        type: "booking_rescheduled",
        title: "Réservation modifiée",
        body: `Un patient a déplacé sa réservation du ${oldBooking.appointmentDate} ${oldBooking.appointmentTime} au ${args.newDate} ${args.newTime}.`,
        data: {
          oldBookingId: args.bookingId,
          newBookingId,
          doctorId: oldBooking.doctorId,
          clinicId: oldBooking.clinicId,
          newDate: args.newDate,
          newTime: args.newTime,
        },
      });
    }

    return newBookingId;
  },
});

// ---------------------------------------------------------------------------
// Internal enrichment helpers
// ---------------------------------------------------------------------------

/**
 * Given a booking document, resolves and joins the doctor's display name
 * (from users), the clinic name + address + phone, and the doctor's
 * specialty name. Returns a plain object matching `bookingPatientListFields`.
 */
async function enrichBookingWithDoctorAndClinic(ctx: any, booking: Doc<"bookings">) {
  const doctor = await ctx.db.get(booking.doctorId);
  const clinic = await ctx.db.get(booking.clinicId);

  let doctorName = "";
  let specialtyNameFr = "";
  let specialtyNameAr = "";

  if (doctor) {
    const docUser = await ctx.db.get(doctor.userId);
    doctorName = docUser?.name ?? docUser?.fullNameAr ?? "";
    const specialty = await ctx.db.get(doctor.specialtyId);
    specialtyNameFr = specialty?.nameFr ?? "";
    specialtyNameAr = specialty?.nameAr ?? "";
  }

  return {
    ...booking,
    doctorName,
    doctorSpecialtyNameFr: specialtyNameFr,
    doctorSpecialtyNameAr: specialtyNameAr,
    consultationFee: doctor?.consultationFee ?? 0,
    clinicName: clinic?.name ?? "",
    clinicAddress: clinic?.address ?? "",
    clinicPhone: clinic?.phone ?? "",
  };
}

/**
 * Given a booking document, resolves and joins the patient's display name
 * (from users) and phone. Also resolves the sub-profile name if a
 * profileId is set. Returns a plain object matching `bookingDoctorListFields`.
 */
async function enrichBookingWithPatient(ctx: any, booking: Doc<"bookings">) {
  const patient = await ctx.db.get(booking.patientId);
  let patientName = "";
  let patientPhone: string | undefined;
  let profileName: string | undefined;

  if (patient) {
    const patientUser = await ctx.db.get(patient.userId);
    patientName = patientUser?.name ?? patientUser?.fullNameAr ?? "";
    patientPhone = patientUser?.phone ?? undefined;
  }

  if (booking.profileId) {
    const profile = await ctx.db.get(booking.profileId);
    if (profile) {
      profileName = profile.fullNameAr;
    }
  }

  return {
    ...booking,
    patientName,
    patientPhone,
    profileName,
  };
}

/**
 * Returns a fully enriched booking object with nested patient, doctor, and
 * clinic data. Used by `getById`.
 */
async function enrichBookingFully(ctx: any, booking: Doc<"bookings">) {
  const patient = await ctx.db.get(booking.patientId);
  const doctor = await ctx.db.get(booking.doctorId);
  const clinic = await ctx.db.get(booking.clinicId);

  // Patient sub-data
  let patientUser = null;
  if (patient) {
    patientUser = await ctx.db.get(patient.userId);
  }

  // Doctor sub-data
  let doctorUser = null;
  let specialty = null;
  if (doctor) {
    doctorUser = await ctx.db.get(doctor.userId);
    specialty = await ctx.db.get(doctor.specialtyId);
  }

  // Profile
  let profile = null;
  if (booking.profileId) {
    profile = await ctx.db.get(booking.profileId);
  }

  return {
    ...booking,
    patient: {
      _id: patient!._id,
      dateOfBirth: patient!.dateOfBirth,
      gender: patient!.gender,
      bloodType: patient!.bloodType,
      chronicDiseases: patient!.chronicDiseases,
      allergies: patient!.allergies,
      emergencyContactName: patient!.emergencyContactName,
      emergencyContactPhone: patient!.emergencyContactPhone,
      user: {
        name: patientUser?.name,
        fullNameAr: patientUser?.fullNameAr,
        fullNameFr: patientUser?.fullNameFr,
        phone: patientUser?.phone,
        email: patientUser?.email,
      },
    },
    doctor: {
      _id: doctor!._id,
      specialtyId: doctor!.specialtyId,
      consultationFee: doctor!.consultationFee,
      followUpFee: doctor!.followUpFee,
      avgRating: doctor!.avgRating,
      totalReviews: doctor!.totalReviews,
      yearsOfExperience: doctor!.yearsOfExperience,
      languages: doctor!.languages,
      isVerified: doctor!.isVerified,
      user: {
        name: doctorUser?.name,
        fullNameAr: doctorUser?.fullNameAr,
        fullNameFr: doctorUser?.fullNameFr,
      },
      specialty: {
        nameAr: specialty?.nameAr ?? "",
        nameFr: specialty?.nameFr ?? "",
      },
    },
    clinic: {
      _id: clinic!._id,
      name: clinic!.name,
      address: clinic!.address,
      phone: clinic!.phone,
      wilayaId: clinic!.wilayaId,
    },
    profile: profile
      ? {
          _id: profile._id,
          fullNameAr: profile.fullNameAr,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender,
          bloodType: profile.bloodType,
          chronicDiseases: profile.chronicDiseases,
          allergies: profile.allergies,
        }
      : null,
  };
}
