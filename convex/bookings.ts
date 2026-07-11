import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

type DoctorBookingFilters = {
  query?: string;
  status?: string;
  visitType?: string;
};

const ALGERIA_OFFSET_MS = 60 * 60 * 1000;

const statusValidator = v.union(
  v.literal('confirmed'),
  v.literal('present'),
  v.literal('in_room'),
  v.literal('cancelled'),
  v.literal('completed'),
  v.literal('no_show'),
);

const visitTypeValidator = v.union(
  v.literal('first'),
  v.literal('followup'),
  v.literal('consultation'),
);

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function algeriaCalendarNow(now = new Date()) {
  return new Date(now.getTime() + ALGERIA_OFFSET_MS);
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function todayString() {
  return formatDateOnly(algeriaCalendarNow());
}

function currentAlgeriaTimeMinutes() {
  const now = algeriaCalendarNow();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function isPastAppointmentSlot(appointmentDate: string, appointmentTime: string) {
  const today = todayString();
  if (appointmentDate < today) return true;
  if (appointmentDate > today) return false;
  return parseTimeMinutes(appointmentTime) < currentAlgeriaTimeMinutes();
}

function hasAppointmentStarted(appointmentDate: string, appointmentTime: string) {
  const today = todayString();
  if (appointmentDate < today) return true;
  if (appointmentDate > today) return false;
  return parseTimeMinutes(appointmentTime) <= currentAlgeriaTimeMinutes();
}

function hasAppointmentEnded(
  appointmentDate: string,
  appointmentTime: string,
  appointmentDuration: number,
) {
  const today = todayString();
  if (appointmentDate < today) return true;
  if (appointmentDate > today) return false;
  return parseTimeMinutes(appointmentTime) + appointmentDuration <= currentAlgeriaTimeMinutes();
}

function assertAppointmentSlotIsNotPast(appointmentDate: string, appointmentTime: string) {
  if (!isPastAppointmentSlot(appointmentDate, appointmentTime)) return;

  throw new ConvexError({
    code: 'slot_in_past',
    message: 'Cannot book an appointment before the current time',
  });
}

function addDays(date: string, days: number) {
  const next = parseDateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return formatDateOnly(next);
}

function monthRange(year: number, month: number) {
  const start = formatDateOnly(new Date(Date.UTC(year, month - 1, 1)));
  const end = formatDateOnly(new Date(Date.UTC(year, month, 0)));
  return { start, end };
}

function parseTimeMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function dayOfWeekForDate(date: string) {
  return parseDateOnly(date).getUTCDay();
}

function formatTimeMinutes(totalMinutes: number) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

type DbCtx = any;

async function hasAcceptedClinicMembership(
  ctx: DbCtx,
  clinic: Doc<'clinics'>,
  doctorId: Id<'doctors'>,
) {
  if (clinic.doctorId === doctorId) return true;

  const memberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_clinicId_and_doctorId', (q: any) =>
      q.eq('clinicId', clinic._id).eq('doctorId', doctorId),
    )
    .take(20);

  return memberships.some(
    (membership: Doc<'clinicMemberships'>) => membership.status === 'accepted',
  );
}

async function hasClinicClosure(
  ctx: DbCtx,
  clinicId: Id<'clinics'>,
  date: string,
) {
  const exceptions = await ctx.db
    .query('scheduleExceptions')
    .withIndex('by_clinicId', (q: any) => q.eq('clinicId', clinicId))
    .take(200);

  return exceptions.some(
    (exception: Doc<'scheduleExceptions'>) =>
      exception.doctorId === undefined &&
      exception.exceptionDate <= date &&
      (exception.endDate ?? exception.exceptionDate) >= date &&
      (exception.exceptionType ?? 'full_day') !== 'single_hour' &&
      (exception.exceptionType ?? 'full_day') !== 'time_range',
  );
}

async function getDoctorExceptionsForDate(
  ctx: DbCtx,
  clinicId: Id<'clinics'>,
  doctorId: Id<'doctors'>,
  date: string,
) {
  const exceptions = await ctx.db
    .query('scheduleExceptions')
    .withIndex('by_clinicId', (q: any) => q.eq('clinicId', clinicId))
    .take(200);

  return exceptions.filter(
    (exception: Doc<'scheduleExceptions'>) =>
      exception.doctorId === doctorId &&
      exception.exceptionDate <= date &&
      (exception.endDate ?? exception.exceptionDate) >= date,
  );
}

function slotOverlapsException(
  appointmentTime: string,
  appointmentDuration: number,
  exception: Doc<'scheduleExceptions'>,
) {
  const type = exception.exceptionType ?? 'full_day';
  if (type === 'full_day' || type === 'multi_day') {
    return true;
  }

  if (!exception.customStartTime || !exception.customEndTime) {
    return false;
  }

  const slotStart = parseTimeMinutes(appointmentTime);
  const slotEnd = slotStart + appointmentDuration;
  const exceptionStart = parseTimeMinutes(exception.customStartTime);
  const exceptionEnd = parseTimeMinutes(exception.customEndTime);

  return slotStart < exceptionEnd && slotEnd > exceptionStart;
}

async function getScheduleForSlotLookup(
  ctx: DbCtx,
  clinic: Doc<'clinics'>,
  doctorId: Id<'doctors'> | undefined,
  dayOfWeek: number,
) {
  if (doctorId) {
    const schedule = await ctx.db
      .query('schedules')
      .withIndex('by_clinicId_and_doctorId_and_dayOfWeek', (q: any) =>
        q.eq('clinicId', clinic._id).eq('doctorId', doctorId).eq('dayOfWeek', dayOfWeek),
      )
      .unique();
    if (schedule) return schedule;
  }

  return await ctx.db
    .query('schedules')
    .withIndex('by_clinicId_and_dayOfWeek', (q: any) =>
      q.eq('clinicId', clinic._id).eq('dayOfWeek', dayOfWeek),
    )
    .unique();
}

async function getBookedTimes(
  ctx: DbCtx,
  clinicId: Id<'clinics'>,
  doctorId: Id<'doctors'> | undefined,
  date: string,
) {
  if (doctorId) {
    const bookings = await ctx.db
      .query('bookings')
      .withIndex(
        'by_clinicId_and_doctorId_and_appointmentDate_and_appointmentTime',
        (q: any) =>
          q.eq('clinicId', clinicId).eq('doctorId', doctorId).eq('appointmentDate', date),
      )
      .take(200);
    return new Set(
      bookings
        .filter((booking: Doc<'bookings'>) => booking.status !== 'cancelled')
        .map((booking: Doc<'bookings'>) => booking.appointmentTime),
    );
  }

  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_clinicId_and_appointmentDate_and_appointmentTime', (q: any) =>
      q.eq('clinicId', clinicId).eq('appointmentDate', date),
    )
    .take(200);
  return new Set(
    bookings
      .filter((booking: Doc<'bookings'>) => booking.status !== 'cancelled')
      .map((booking: Doc<'bookings'>) => booking.appointmentTime),
  );
}

async function listAvailableSlotsForClinicDoctor(
  ctx: DbCtx,
  args: {
    clinicId: Id<'clinics'>;
    doctorId?: Id<'doctors'>;
    date: string;
  },
) {
  const clinic = await ctx.db.get(args.clinicId);
  if (!clinic || !clinic.isActive) return [];
  const day = dayOfWeekForDate(args.date);

  if (args.doctorId) {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) return [];
    const accepted = await hasAcceptedClinicMembership(ctx, clinic, args.doctorId);
    if (!accepted) return [];
    if (await hasClinicClosure(ctx, args.clinicId, args.date)) return [];
    const doctorExceptions = await getDoctorExceptionsForDate(
      ctx,
      args.clinicId,
      args.doctorId,
      args.date,
    );
    if (
      doctorExceptions.some((exception: Doc<'scheduleExceptions'>) =>
        ['full_day', 'multi_day'].includes(exception.exceptionType ?? 'full_day'),
      )
    ) {
      return [];
    }
    const blockedTimes = await getBookedTimes(ctx, args.clinicId, args.doctorId, args.date);
    const schedule = await getScheduleForSlotLookup(ctx, clinic, args.doctorId, day);
    if (!schedule || !schedule.isActive) return [];

    const duration = schedule.appointmentDurationMinutes;
    const start = parseTimeMinutes(schedule.startTime);
    const end = parseTimeMinutes(schedule.endTime);
    const slots = [];
    for (let current = start; current + duration <= end; current += duration) {
      const time = formatTimeMinutes(current);
      const isPastSlot = isPastAppointmentSlot(args.date, time);
      const blockedByException = doctorExceptions.some((exception: Doc<'scheduleExceptions'>) =>
        slotOverlapsException(time, duration, exception),
      );
      slots.push({
        time,
        duration,
        available: !blockedTimes.has(time) && !isPastSlot && !blockedByException,
      });
    }

    return slots;
  } else {
    const legacyException = await ctx.db
      .query('scheduleExceptions')
      .withIndex('by_clinicId_and_exceptionDate', (q: any) =>
        q.eq('clinicId', args.clinicId).eq('exceptionDate', args.date),
      )
      .unique();
    if (legacyException) return [];
  }

  const schedule = await getScheduleForSlotLookup(ctx, clinic, args.doctorId, day);
  if (!schedule || !schedule.isActive) return [];

  const blockedTimes = await getBookedTimes(ctx, args.clinicId, args.doctorId, args.date);

  const duration = schedule.appointmentDurationMinutes;
  const start = parseTimeMinutes(schedule.startTime);
  const end = parseTimeMinutes(schedule.endTime);
  const slots = [];
  for (let current = start; current + duration <= end; current += duration) {
    const time = formatTimeMinutes(current);
    const isPastSlot = isPastAppointmentSlot(args.date, time);
    slots.push({
      time,
      duration,
      available: !blockedTimes.has(time) && !isPastSlot,
    });
  }

  return slots;
}

async function isDoctorWorkingAtClinicOnDate(
  ctx: DbCtx,
  clinic: Doc<'clinics'>,
  doctorId: Id<'doctors'>,
  date: string,
) {
  const accepted = await hasAcceptedClinicMembership(ctx, clinic, doctorId);
  if (!accepted) return false;
  if (await hasClinicClosure(ctx, clinic._id, date)) return false;

  const doctorExceptions = await getDoctorExceptionsForDate(ctx, clinic._id, doctorId, date);
  const hasFullDayException = doctorExceptions.some((exception: Doc<'scheduleExceptions'>) =>
    ['full_day', 'multi_day'].includes(exception.exceptionType ?? 'full_day'),
  );
  if (hasFullDayException) return false;

  const schedule = await getScheduleForSlotLookup(
    ctx,
    clinic,
    doctorId,
    dayOfWeekForDate(date),
  );
  return Boolean(schedule?.isActive);
}

async function assertClinicOwnedSlotAvailable(
  ctx: DbCtx,
  args: {
    clinicId: Id<'clinics'>;
    doctorId: Id<'doctors'>;
    appointmentDate: string;
    appointmentTime: string;
  },
) {
  const clinic = await ctx.db.get(args.clinicId);
  if (!clinic?.ownerUserId) return;

  const slots = await listAvailableSlotsForClinicDoctor(ctx, {
    clinicId: args.clinicId,
    doctorId: args.doctorId,
    date: args.appointmentDate,
  });
  const slot = slots.find((item) => item.time === args.appointmentTime);
  if (!slot || !slot.available) {
    throw new ConvexError({
      code: 'slot_taken',
      message: 'Appointment slot is not available',
    });
  }
}

async function getPatient(ctx: any) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'patient') throw new ConvexError('Patient account required');
  const patient = await ctx.db
    .query('patients')
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique();
  if (!patient) throw new ConvexError('Patient profile not found');
  return patient;
}

async function getDoctor(ctx: any) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'doctor') throw new ConvexError('Doctor account required');
  const doctor = await ctx.db
    .query('doctors')
    .withIndex('by_userId', (q: any) => q.eq('userId', user._id))
    .unique();
  if (!doctor) throw new ConvexError('Doctor profile not found');
  return doctor;
}

async function getClinic(ctx: any) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'clinic') throw new ConvexError('Clinic account required');
  const clinic = await ctx.db
    .query('clinics')
    .withIndex('by_ownerUserId', (q: any) => q.eq('ownerUserId', user._id))
    .unique();
  if (!clinic) throw new ConvexError('Clinic profile not found');
  return clinic;
}

async function getClinicSettings(ctx: any, clinic: Doc<'clinics'>) {
  return await ctx.runQuery(internal.clinicSettings.getForUser, {
    userId: clinic.ownerUserId ?? clinic.ownerUserId,
    clinicId: clinic._id,
  });
}

async function bookingDetails(ctx: any, booking: any) {
  const doctor = await ctx.db.get(booking.doctorId);
  const doctorUser = doctor ? await ctx.db.get(doctor.userId) : null;
  const specialty = doctor ? await ctx.db.get(doctor.specialtyId) : null;
  const patient = await ctx.db.get(booking.patientId);
  const patientUser = patient ? await ctx.db.get(patient.userId) : null;
  const bookedClinic = await ctx.db.get(booking.clinicId);
  let clinic = bookedClinic;
  let clinicName = bookedClinic?.name?.trim() ?? '';

  if (!clinicName && doctor) {
    const legacyClinics = await ctx.db
      .query('clinics')
      .withIndex('by_doctorId', (q: any) => q.eq('doctorId', doctor._id))
      .take(20);

    const primaryLegacyClinic = legacyClinics.find(
      (legacyClinic: Doc<'clinics'>) =>
        legacyClinic.isActive && !!legacyClinic.name?.trim(),
    );

    if (primaryLegacyClinic) {
      clinic = primaryLegacyClinic;
      clinicName = primaryLegacyClinic.name.trim();
    } else {
      const acceptedMembership = await ctx.db
        .query('clinicMemberships')
        .withIndex('by_doctorId_and_status', (q: any) =>
          q.eq('doctorId', doctor._id).eq('status', 'accepted'),
        )
        .first();

      if (acceptedMembership) {
        const membershipClinic = await ctx.db.get(acceptedMembership.clinicId);
        if (membershipClinic?.name?.trim()) {
          clinic = membershipClinic;
          clinicName = membershipClinic.name.trim();
        }
      }
    }
  }

  if (!clinicName) {
    clinicName = 'الطبيب ليس في عيادة';
  }

  return {
    ...booking,
    doctor,
    doctorName: doctorUser?.fullName ?? '',
    doctorSpecialtyNameAr: specialty?.name ?? '',
    patientName: patientUser?.fullName ?? '',
    patientPhone: patientUser?.phone,
    clinicName,
    clinic,
  };
}

async function createDoctorNotificationFromBooking(
  ctx: any,
  bookingId: any,
  type: 'new_booking' | 'booking_cancelled',
) {
  const booking = await ctx.db.get(bookingId);
  if (!booking) return;

  const doctor = await ctx.db.get(booking.doctorId);
  if (!doctor) return;

  const patient = await ctx.db.get(booking.patientId);
  const patientUser = patient ? await ctx.db.get(patient.userId) : null;
  const clinic = await ctx.db.get(booking.clinicId);
  const patientName = patientUser?.fullName ?? 'مريض';
  const clinicName = clinic?.name ?? 'العيادة';

  const title = type === 'new_booking' ? 'حجز جديد' : 'إلغاء موعد';
  const body =
    type === 'new_booking'
      ? `${patientName} حجز موعداً جديداً في ${clinicName}`
      : `${patientName} ألغى موعده في ${clinicName}`;

  await ctx.runMutation(internal.notifications.createForUser, {
    userId: doctor.userId,
    type,
    title,
    body,
    data: {
      bookingId: booking._id,
      clinicId: booking.clinicId,
      appointmentDate: booking.appointmentDate,
      appointmentTime: booking.appointmentTime,
    },
  });
}

async function createPatientNoShowNotification(ctx: any, bookingId: Id<'bookings'>) {
  const booking = await ctx.db.get(bookingId);
  if (!booking) return;
  const patient = await ctx.db.get(booking.patientId);
  if (!patient) return;
  const patientUser = await ctx.db.get(patient.userId);
  if (!patientUser) return;
  const doctor = await ctx.db.get(booking.doctorId);
  const doctorUser = doctor ? await ctx.db.get(doctor.userId) : null;
  const clinic = await ctx.db.get(booking.clinicId);

  await ctx.runMutation(internal.notifications.createForUser, {
    userId: patientUser._id,
    type: 'booking_no_show',
    title: 'تم اعتبار الموعد غياباً',
    body: `تم تسجيل موعدك مع ${doctorUser?.fullName ?? 'الطبيب'} في ${clinic?.name ?? 'العيادة'} كغياب. يمكنك الحجز لاحقاً أو اختيار طبيب أو عيادة أخرى.`,
    data: {
      bookingId: booking._id,
      clinicId: booking.clinicId,
      doctorId: booking.doctorId,
      appointmentDate: booking.appointmentDate,
      appointmentTime: booking.appointmentTime,
    },
  });
}

async function processAttendanceTransitionForBooking(
  ctx: any,
  booking: Doc<'bookings'>,
  clinicSettings: { autoCompleteAppointments: boolean },
) {
  if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'no_show') {
    return null;
  }

  const now = Date.now();

  if (
    booking.status === 'in_room' &&
    clinicSettings.autoCompleteAppointments &&
    hasAppointmentEnded(booking.appointmentDate, booking.appointmentTime, booking.appointmentDuration)
  ) {
    await ctx.db.patch(booking._id, {
      status: 'completed',
      completedAt: now,
    });
    return 'completed';
  }

  if (
    booking.status === 'present' &&
    hasAppointmentStarted(booking.appointmentDate, booking.appointmentTime)
  ) {
    if (
      clinicSettings.autoCompleteAppointments &&
      hasAppointmentEnded(booking.appointmentDate, booking.appointmentTime, booking.appointmentDuration)
    ) {
      await ctx.db.patch(booking._id, {
        status: 'completed',
        inRoomAt: booking.inRoomAt ?? now,
        completedAt: now,
      });
      return 'completed';
    }

    await ctx.db.patch(booking._id, {
      status: 'in_room',
      inRoomAt: booking.inRoomAt ?? now,
    });
    return 'in_room';
  }

  if (
    booking.status === 'confirmed' &&
    hasAppointmentStarted(booking.appointmentDate, booking.appointmentTime)
  ) {
    await ctx.db.patch(booking._id, {
      status: 'no_show',
      noShowAt: now,
    });
    await createPatientNoShowNotification(ctx, booking._id);
    return 'no_show';
  }

  return null;
}

async function processAttendanceForClinic(ctx: any, clinic: Doc<'clinics'>) {
  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_clinicId_and_appointmentDate_and_appointmentTime', (q: any) =>
      q.eq('clinicId', clinic._id),
    )
    .take(200);
  const settings = await getClinicSettings(ctx, clinic);
  const summary = {
    in_room: 0,
    completed: 0,
    no_show: 0,
  };

  for (const booking of bookings) {
    const result = await processAttendanceTransitionForBooking(ctx, booking, settings);
    if (result) summary[result] += 1;
  }

  return summary;
}

export const getAvailableSlots = query({
  args: {
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
    date: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await listAvailableSlotsForClinicDoctor(ctx, args);
  },
});

export const countMyClinicDoctorsAvailableToday = query({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const clinic = await getClinic(ctx);
    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_clinicId_and_status', (q: any) =>
        q.eq('clinicId', clinic._id).eq('status', 'accepted'),
      )
      .take(100);

    let count = 0;
    const date = todayString();

    for (const membership of memberships) {
      if (await isDoctorWorkingAtClinicOnDate(ctx, clinic, membership.doctorId, date)) {
        count += 1;
      }
    }

    return { count };
  },
});

export const countMyClinicBookedAppointments = query({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const clinic = await getClinic(ctx);
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_clinicId_and_appointmentDate_and_appointmentTime', (q: any) =>
        q.eq('clinicId', clinic._id).gte('appointmentDate', todayString()),
      )
      .take(500);

    return {
      count: bookings.filter((booking: Doc<'bookings'>) => booking.status !== 'cancelled').length,
    };
  },
});

export const create = mutation({
  args: {
    doctorId: v.id('doctors'),
    clinicId: v.id('clinics'),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
    appointmentDuration: v.optional(v.number()),
    visitType: v.union(
      v.literal('first'),
      v.literal('followup'),
      v.literal('consultation'),
    ),
    reason: v.optional(v.string()),
    patientNote: v.optional(v.string()),
    profileId: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const patient = await getPatient(ctx);
    assertAppointmentSlotIsNotPast(args.appointmentDate, args.appointmentTime);
    await assertClinicOwnedSlotAvailable(ctx, {
      clinicId: args.clinicId,
      doctorId: args.doctorId,
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
    });

    const bookingId = await ctx.db.insert('bookings', {
      patientId: patient._id,
      doctorId: args.doctorId,
      clinicId: args.clinicId,
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
      appointmentDuration: args.appointmentDuration ?? 30,
      visitType: args.visitType,
      reason: args.reason,
      patientNote: args.patientNote,
      status: 'confirmed',
      confirmedAt: Date.now(),
    });

    await createDoctorNotificationFromBooking(ctx, bookingId, 'new_booking');

    return bookingId;
  },
});

export const reschedule = mutation({
  args: {
    bookingId: v.id('bookings'),
    clinicId: v.optional(v.id('clinics')),
    appointmentDate: v.optional(v.string()),
    appointmentTime: v.optional(v.string()),
    newDate: v.optional(v.string()),
    newTime: v.optional(v.string()),
    appointmentDuration: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await getPatient(ctx);
    const appointmentDate = args.appointmentDate ?? args.newDate;
    const appointmentTime = args.appointmentTime ?? args.newTime;
    if (appointmentDate && appointmentTime) {
      assertAppointmentSlotIsNotPast(appointmentDate, appointmentTime);
    }

    await ctx.db.patch(args.bookingId, {
      clinicId: args.clinicId,
      appointmentDate,
      appointmentTime,
      appointmentDuration: args.appointmentDuration ?? 30,
    });
    return { ok: true };
  },
});

export const cancel = mutation({
  args: {
    bookingId: v.id('bookings'),
    reason: v.optional(v.string()),
    cancellationReason: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    await ctx.db.patch(args.bookingId, {
      status: 'cancelled',
      cancelledBy: user.role,
      cancellationReason: args.reason ?? args.cancellationReason,
      cancelledAt: Date.now(),
    });

    await createDoctorNotificationFromBooking(ctx, args.bookingId, 'booking_cancelled');

    return { ok: true };
  },
});

export const markCompleted = mutation({
  args: { bookingId: v.id('bookings') },
  returns: v.any(),
  handler: async (ctx, args) => {
    await getClinic(ctx);
    await ctx.db.patch(args.bookingId, {
      status: 'completed',
      completedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const markNoShow = mutation({
  args: { bookingId: v.id('bookings') },
  returns: v.any(),
  handler: async (ctx, args) => {
    await getClinic(ctx);
    await ctx.db.patch(args.bookingId, {
      status: 'no_show',
      noShowAt: Date.now(),
    });
    await createPatientNoShowNotification(ctx, args.bookingId);
    return { ok: true };
  },
});

export const markPresent = mutation({
  args: { bookingId: v.id('bookings') },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const clinic = await getClinic(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.clinicId !== clinic._id) {
      throw new ConvexError('Booking not found');
    }
    if (booking.status !== 'confirmed') {
      return { ok: true };
    }
    await ctx.db.patch(args.bookingId, {
      status: 'present',
      presentAt: Date.now(),
    });
    return { ok: true };
  },
});

export const syncMyClinicAppointmentStates = mutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const clinic = await getClinic(ctx);
    return await processAttendanceForClinic(ctx, clinic);
  },
});

export const updateDoctorNote = mutation({
  args: {
    bookingId: v.id('bookings'),
    doctorNote: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const doctor = await getDoctor(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.doctorId !== doctor._id) {
      throw new ConvexError('Booking not found');
    }
    await ctx.db.patch(args.bookingId, { doctorNote: args.doctorNote });
    return { ok: true };
  },
});

async function listPatientBookings(ctx: any, statuses: string[]) {
  const patient = await getPatient(ctx);
  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_patientId', (q: any) => q.eq('patientId', patient._id))
    .take(100);
  const filtered = bookings.filter((booking: any) => statuses.includes(booking.status));
  return await Promise.all(filtered.map((booking: any) => bookingDetails(ctx, booking)));
}

export const listMyUpcoming = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => listPatientBookings(ctx, ['confirmed', 'present', 'in_room']),
});

export const listMyPast = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => listPatientBookings(ctx, ['completed', 'no_show']),
});

export const listMyCancelled = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => listPatientBookings(ctx, ['cancelled']),
});

function matchesDoctorBookingFilters(booking: any, filters: DoctorBookingFilters) {
  if (filters.status && booking.status !== filters.status) return false;
  if (filters.visitType && booking.visitType !== filters.visitType) return false;

  const search = filters.query?.trim().toLocaleLowerCase();
  if (!search) return true;

  return [booking.patientName, booking.patientPhone, booking.reason]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(search));
}

function groupBookingsByDate(bookings: any[]) {
  const groups = new Map<string, any[]>();
  for (const booking of bookings) {
    const existing = groups.get(booking.appointmentDate) ?? [];
    existing.push(booking);
    groups.set(booking.appointmentDate, existing);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, appointments]) => {
      const sortedAppointments = [...appointments].sort((a, b) =>
        a.appointmentTime.localeCompare(b.appointmentTime),
      );
      return {
        date,
        total: sortedAppointments.length,
        appointments: sortedAppointments,
      };
    });
}

function sortBookingsByAppointmentTime(bookings: any[]) {
  return [...bookings].sort((a, b) =>
    a.appointmentTime.localeCompare(b.appointmentTime),
  );
}

function sortBookingsByAppointmentDateTime(bookings: any[]) {
  return [...bookings].sort((a, b) => {
    const dateOrder = a.appointmentDate.localeCompare(b.appointmentDate);
    if (dateOrder !== 0) return dateOrder;
    return a.appointmentTime.localeCompare(b.appointmentTime);
  });
}

function countTodayStats(bookings: any[]) {
  return bookings.reduce(
    (stats, booking) => {
      stats.total += 1;
      if (
        booking.status === 'confirmed' ||
        booking.status === 'present' ||
        booking.status === 'in_room'
      ) {
        stats.confirmed += 1;
      }
      if (booking.status === 'completed') stats.completed += 1;
      if (booking.status === 'cancelled') stats.cancelled += 1;
      if (booking.status === 'no_show') stats.noShow += 1;
      return stats;
    },
    {
      total: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    },
  );
}

function nextConfirmedBooking(bookings: any[]) {
  return sortBookingsByAppointmentDateTime(bookings).find(
    (booking) =>
      booking.status === 'confirmed' ||
      booking.status === 'present' ||
      booking.status === 'in_room',
  ) ?? null;
}

async function listDoctorBookings(
  ctx: any,
  date: string | null,
  filters: DoctorBookingFilters = {},
) {
  return await listDoctorBookingsInRange(ctx, date, date, filters);
}

async function listDoctorBookingsInRange(
  ctx: any,
  startDate: string | null,
  endDate: string | null,
  filters: DoctorBookingFilters = {},
) {
  const doctor = await getDoctor(ctx);
  const query = ctx.db
    .query('bookings')
    .withIndex('by_doctorId_and_appointmentDate', (q: any) => {
      const byDoctor = q.eq('doctorId', doctor._id);
      if (startDate && endDate && startDate === endDate) {
        return byDoctor.eq('appointmentDate', startDate);
      }
      if (startDate && endDate) {
        return byDoctor.gte('appointmentDate', startDate).lte('appointmentDate', endDate);
      }
      return byDoctor;
    });
  const bookings = await query.take(100);
  const detailed = await Promise.all(
    bookings.map((booking: any) => bookingDetails(ctx, booking)),
  );
  return detailed.filter((booking) => matchesDoctorBookingFilters(booking, filters));
}

export const listDoctorToday = query({
  args: {
    date: v.optional(v.string()),
    query: v.optional(v.string()),
    status: v.optional(statusValidator),
    visitType: v.optional(visitTypeValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    listDoctorBookings(ctx, args.date ?? todayString(), args),
});

export const listDoctorWeek = query({
  args: {
    startDate: v.optional(v.string()),
    query: v.optional(v.string()),
    status: v.optional(statusValidator),
    visitType: v.optional(visitTypeValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const startDate = args.startDate ?? todayString();
    const endDate = addDays(startDate, 6);
    const bookings = await listDoctorBookingsInRange(ctx, startDate, endDate, args);
    return {
      startDate,
      endDate,
      days: groupBookingsByDate(bookings),
    };
  },
});

export const listDoctorMonth = query({
  args: {
    year: v.optional(v.number()),
    month: v.optional(v.number()),
    query: v.optional(v.string()),
    status: v.optional(statusValidator),
    visitType: v.optional(visitTypeValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = new Date();
    const year = args.year ?? now.getFullYear();
    const month = args.month ?? now.getMonth() + 1;
    const { start, end } = monthRange(year, month);
    const bookings = await listDoctorBookingsInRange(ctx, start, end, args);
    return {
      year,
      month,
      days: groupBookingsByDate(bookings),
    };
  },
});

export const getHomeData = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const upcoming = await listPatientBookings(ctx, ['confirmed']);
    return {
      upcoming,
      nextAppointment: upcoming[0] ?? null,
      stats: { upcoming: upcoming.length },
    };
  },
});

export const getHomeDataDoctor = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const todayDate = todayString();
    const today = sortBookingsByAppointmentTime(
      await listDoctorBookings(ctx, todayDate),
    );
    const upcoming = await listDoctorBookingsInRange(ctx, todayDate, addDays(todayDate, 365), {
      status: undefined,
    });
    const todayStats = countTodayStats(today);
    const nextPatient = nextConfirmedBooking(upcoming);
    return {
      todayAppointments: today,
      todayStats,
      nextPatient,
      // Backwards-compatible aliases for any older callers still using the
      // first dashboard payload shape.
      today,
      nextAppointment: nextPatient,
      stats: todayStats,
    };
  },
});

export const listMyClinicAppointments = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const clinic = await getClinic(ctx);
    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_clinicId_and_appointmentDate_and_appointmentTime', (q: any) =>
        q.eq('clinicId', clinic._id),
      )
      .take(100);

    const detailed = await Promise.all(
      bookings.map((booking: any) => bookingDetails(ctx, booking)),
    );

    return sortBookingsByAppointmentTime(detailed);
  },
});

export const listDoctorHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    const doctor = await getDoctor(ctx);
    const result = await ctx.db
      .query('bookings')
      .withIndex('by_doctorId_and_appointmentDate', (q: any) =>
        q.eq('doctorId', doctor._id).lte('appointmentDate', todayString()),
      )
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(result.page.map((booking: any) => bookingDetails(ctx, booking))),
    };
  },
});

export const listClinicHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    const clinic = await getClinic(ctx);
    const result = await ctx.db
      .query('bookings')
      .withIndex('by_clinicId_and_appointmentDate_and_appointmentTime', (q: any) =>
        q.eq('clinicId', clinic._id).lt('appointmentDate', todayString()),
      )
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(result.page.map((booking: any) => bookingDetails(ctx, booking))),
    };
  },
});

export const processAutomaticAttendance = internalMutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const clinics = await ctx.db.query('clinics').take(200);
    const summary = {
      clinics: clinics.length,
      in_room: 0,
      completed: 0,
      no_show: 0,
    };

    for (const clinic of clinics) {
      if (!clinic.ownerUserId) continue;
      const clinicSummary = await processAttendanceForClinic(ctx, clinic);
      summary.in_room += clinicSummary.in_room;
      summary.completed += clinicSummary.completed;
      summary.no_show += clinicSummary.no_show;
    }

    return summary;
  },
});
