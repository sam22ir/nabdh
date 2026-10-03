import { BackendError, mutation, query, requireUser, unwrap } from '../core';
import { toDoc } from '../convert';
import { addDays, monthRange, myClinicId, requireDoctor, todayString } from './shared';

// A booking with everything the screens show about it.
const BOOKING_SELECT = `
  id, patient_id, doctor_id, clinic_id, appointment_date, appointment_time,
  appointment_duration, visit_type, reason, patient_note, doctor_note, status,
  cancelled_by, cancellation_reason, confirmed_at, present_at, in_room_at,
  cancelled_at, no_show_at, completed_at, created_at,
  doctor:doctors!bookings_doctor_id_fkey(
    id, specialty_id, wilaya_id, bio, years_of_experience, consultation_fee,
    follow_up_fee, avg_rating, total_reviews,
    profile:profiles!doctors_id_fkey(full_name),
    specialty:specialties!doctors_specialty_id_fkey(name)
  ),
  patient:profiles!bookings_patient_id_fkey(
    full_name,
    contact:profile_private!profile_private_user_id_fkey(phone)
  ),
  clinic:clinics!bookings_clinic_id_fkey(*)
`;

const NO_CLINIC_NAME = 'المختص ليس في مركز';

type BookingRow = Record<string, any>;
type PageOpts = { numItems: number; cursor: string | null };
const DEFAULT_PAGE: PageOpts = { numItems: 20, cursor: null };

export function toBookingDetails(row: BookingRow): any {
  const { doctor, patient, clinic, ...booking } = row;
  const { profile, specialty, ...doctorFields } = doctor ?? {};
  const contact = Array.isArray(patient?.contact) ? patient.contact[0] : patient?.contact;
  return {
    ...toDoc<Record<string, any>>(booking),
    doctor: doctor ? { ...toDoc(doctorFields), userId: doctor.id } : null,
    doctorName: profile?.full_name ?? '',
    doctorSpecialtyNameAr: specialty?.name ?? '',
    patientName: patient?.full_name ?? '',
    patientPhone: contact?.phone ?? undefined,
    clinicName: clinic?.name?.trim() || NO_CLINIC_NAME,
    clinic: clinic ? { ...toDoc(clinic), ownerUserId: clinic.owner_id } : null,
  };
}

const byDateTime = (a: any, b: any) =>
  a.appointmentDate.localeCompare(b.appointmentDate) ||
  a.appointmentTime.localeCompare(b.appointmentTime);
const byTime = (a: any, b: any) => a.appointmentTime.localeCompare(b.appointmentTime);

const ACTIVE = ['confirmed', 'present', 'in_room'];

type DoctorFilters = { query?: string; status?: string; visitType?: string };

function matchesFilters(booking: any, filters: DoctorFilters) {
  if (filters.status && booking.status !== filters.status) return false;
  if (filters.visitType && booking.visitType !== filters.visitType) return false;
  const search = filters.query?.trim().toLocaleLowerCase();
  if (!search) return true;
  return [booking.patientName, booking.patientPhone, booking.reason]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(search));
}

function groupByDate(bookings: any[]) {
  const groups = new Map<string, any[]>();
  for (const booking of bookings) {
    const list = groups.get(booking.appointmentDate) ?? [];
    list.push(booking);
    groups.set(booking.appointmentDate, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const appointments = [...list].sort(byTime);
      return { date, total: appointments.length, appointments };
    });
}

function countTodayStats(bookings: any[]) {
  const stats = { total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 };
  for (const b of bookings) {
    stats.total += 1;
    if (ACTIVE.includes(b.status)) stats.confirmed += 1;
    if (b.status === 'completed') stats.completed += 1;
    if (b.status === 'cancelled') stats.cancelled += 1;
    if (b.status === 'no_show') stats.noShow += 1;
  }
  return stats;
}

async function listPatientBookings(ctx: any, statuses: string[], ascending: boolean) {
  const userId = requireUser(ctx);
  const rows = unwrap(
    await ctx.db
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('patient_id', userId)
      .in('status', statuses)
      .order('appointment_date', { ascending })
      .order('appointment_time', { ascending })
      .limit(100),
  ) as BookingRow[];
  return rows.map(toBookingDetails);
}

async function listDoctorRange(
  ctx: any,
  start: string | null,
  end: string | null,
  filters: DoctorFilters = {},
) {
  const doctorId = requireDoctor(ctx);
  let request = ctx.db.from('bookings').select(BOOKING_SELECT).eq('doctor_id', doctorId);
  if (start) request = request.gte('appointment_date', start);
  if (end) request = request.lte('appointment_date', end);
  const rows = unwrap(
    await request.order('appointment_date').order('appointment_time').limit(500),
  ) as BookingRow[];
  return rows.map(toBookingDetails).filter((booking) => matchesFilters(booking, filters));
}

async function paginate(
  request: any,
  paginationOpts: PageOpts,
) {
  const offset = paginationOpts.cursor ? Number(paginationOpts.cursor) : 0;
  const rows = unwrap(
    await request.range(offset, offset + paginationOpts.numItems - 1),
  ) as BookingRow[];
  return {
    page: rows.map(toBookingDetails),
    isDone: rows.length < paginationOpts.numItems,
    continueCursor: String(offset + paginationOpts.numItems),
  };
}

export const bookings = {
  getAvailableSlots: query(
    async (ctx, args: { clinicId: string; doctorId?: string; date: string }) => {
      requireUser(ctx);
      if (!args.doctorId) return [];
      const rows = unwrap(
        await ctx.db.rpc('get_available_slots', {
          p_clinic: args.clinicId,
          p_doctor: args.doctorId,
          p_date: args.date,
        }),
      ) as { slot_time: string; duration: number; available: boolean }[];
      return rows.map((row) => ({
        time: row.slot_time.slice(0, 5),
        duration: row.duration,
        available: row.available,
      }));
    },
  ),

  create: mutation(
    async (
      ctx,
      args: {
        doctorId: string;
        clinicId: string;
        appointmentDate: string;
        appointmentTime: string;
        visitType?: 'first' | 'followup' | 'consultation';
        reason?: string;
        patientNote?: string;
      },
    ) => {
      requireUser(ctx);
      return unwrap(
        await ctx.db.rpc('create_booking', {
          p_doctor_id: args.doctorId,
          p_clinic_id: args.clinicId,
          p_date: args.appointmentDate,
          p_time: args.appointmentTime,
          p_visit_type: args.visitType ?? 'first',
          p_reason: args.reason ?? null,
          p_patient_note: args.patientNote ?? null,
        }),
      );
    },
  ),

  reschedule: mutation(
    async (
      ctx,
      args: {
        bookingId: string;
        clinicId?: string;
        appointmentDate?: string;
        newDate?: string;
        appointmentTime?: string;
        newTime?: string;
      },
    ) => {
      requireUser(ctx);
      const date = args.appointmentDate ?? args.newDate;
      const time = args.appointmentTime ?? args.newTime;
      if (!date || !time) throw new BackendError('Date and time are required');
      unwrap(
        await ctx.db.rpc('reschedule_booking', {
          p_booking: args.bookingId,
          p_date: date,
          p_time: time,
          p_clinic: args.clinicId ?? null,
        }),
      );
      return { ok: true };
    },
  ),

  cancel: mutation(
    async (ctx, args: { bookingId: string; reason?: string; cancellationReason?: string }) => {
      requireUser(ctx);
      unwrap(
        await ctx.db.rpc('cancel_booking', {
          p_booking: args.bookingId,
          p_reason: args.reason ?? args.cancellationReason ?? null,
        }),
      );
      return { ok: true };
    },
  ),

  markCompleted: mutation(async (ctx, args: { bookingId: string }) => {
    requireUser(ctx);
    unwrap(await ctx.db.rpc('set_booking_status', { p_booking: args.bookingId, p_status: 'completed' }));
    return { ok: true };
  }),

  markNoShow: mutation(async (ctx, args: { bookingId: string }) => {
    requireUser(ctx);
    unwrap(await ctx.db.rpc('set_booking_status', { p_booking: args.bookingId, p_status: 'no_show' }));
    return { ok: true };
  }),

  markPresent: mutation(async (ctx, args: { bookingId: string }) => {
    requireUser(ctx);
    const { error } = await ctx.db.rpc('set_booking_status', {
      p_booking: args.bookingId,
      p_status: 'present',
    });
    // Already past "confirmed": nothing to do (matches the old behaviour).
    if (error && error.message !== 'invalid_state') unwrap({ data: null, error });
    return { ok: true };
  }),

  syncMyClinicAppointmentStates: mutation(async (ctx) => {
    const clinicId = await myClinicId(ctx);
    return unwrap(await ctx.db.rpc('sync_clinic_attendance', { p_clinic: clinicId }));
  }),

  updateDoctorNote: mutation(async (ctx, args: { bookingId: string; doctorNote: string }) => {
    requireUser(ctx);
    unwrap(
      await ctx.db.rpc('update_booking_doctor_note', {
        p_booking: args.bookingId,
        p_note: args.doctorNote,
      }),
    );
    return { ok: true };
  }),

  // Patient ---------------------------------------------------------------
  listMyUpcoming: query(async (ctx) => listPatientBookings(ctx, ACTIVE, true)),
  listMyPast: query(async (ctx) => listPatientBookings(ctx, ['completed', 'no_show'], false)),
  listMyCancelled: query(async (ctx) => listPatientBookings(ctx, ['cancelled'], false)),

  getHomeData: query(async (ctx) => {
    const upcoming = await listPatientBookings(ctx, ['confirmed'], true);
    return { upcoming, nextAppointment: upcoming[0] ?? null, stats: { upcoming: upcoming.length } };
  }),

  // Specialist ------------------------------------------------------------
  listDoctorToday: query(
    async (ctx, args: { date?: string; query?: string; status?: string; visitType?: string }) => {
      const date = args.date ?? todayString();
      return listDoctorRange(ctx, date, date, args);
    },
  ),

  listDoctorWeek: query(
    async (ctx, args: { startDate?: string; query?: string; status?: string; visitType?: string }) => {
      const startDate = args.startDate ?? todayString();
      const endDate = addDays(startDate, 6);
      const list = await listDoctorRange(ctx, startDate, endDate, args);
      return { startDate, endDate, days: groupByDate(list) };
    },
  ),

  listDoctorMonth: query(
    async (
      ctx,
      args: { year?: number; month?: number; query?: string; status?: string; visitType?: string },
    ) => {
      const now = new Date();
      const year = args.year ?? now.getFullYear();
      const month = args.month ?? now.getMonth() + 1;
      const { start, end } = monthRange(year, month);
      const list = await listDoctorRange(ctx, start, end, args);
      return { year, month, days: groupByDate(list) };
    },
  ),

  getHomeDataDoctor: query(async (ctx) => {
    const today = todayString();
    const todayList = (await listDoctorRange(ctx, today, today)).sort(byTime);
    const upcoming = await listDoctorRange(ctx, today, addDays(today, 365));
    const todayStats = countTodayStats(todayList);
    const nextPatient =
      [...upcoming].sort(byDateTime).find((booking) => ACTIVE.includes(booking.status)) ?? null;
    return {
      todayAppointments: todayList,
      todayStats,
      nextPatient,
      today: todayList,
      nextAppointment: nextPatient,
      stats: todayStats,
    };
  }),

  listDoctorHistory: query(
    async (ctx, args: { paginationOpts?: PageOpts }) => {
      const doctorId = requireDoctor(ctx);
      return paginate(
        ctx.db
          .from('bookings')
          .select(BOOKING_SELECT)
          .eq('doctor_id', doctorId)
          .lte('appointment_date', todayString())
          .order('appointment_date', { ascending: false })
          .order('appointment_time', { ascending: false }),
        args.paginationOpts ?? DEFAULT_PAGE,
      );
    },
  ),

  // Center ----------------------------------------------------------------
  listMyClinicAppointments: query(async (ctx) => {
    const clinicId = await myClinicId(ctx);
    const rows = unwrap(
      await ctx.db
        .from('bookings')
        .select(BOOKING_SELECT)
        .eq('clinic_id', clinicId)
        .gte('appointment_date', todayString())
        .order('appointment_date')
        .order('appointment_time')
        .limit(300),
    ) as BookingRow[];
    return rows.map(toBookingDetails);
  }),

  listClinicHistory: query(
    async (ctx, args: { paginationOpts?: PageOpts }) => {
      const clinicId = await myClinicId(ctx);
      return paginate(
        ctx.db
          .from('bookings')
          .select(BOOKING_SELECT)
          .eq('clinic_id', clinicId)
          .lt('appointment_date', todayString())
          .order('appointment_date', { ascending: false })
          .order('appointment_time', { ascending: false }),
        args.paginationOpts ?? DEFAULT_PAGE,
      );
    },
  ),

  countMyClinicDoctorsAvailableToday: query(async (ctx) => {
    const clinicId = await myClinicId(ctx);
    const count = unwrap(
      await ctx.db.rpc('count_clinic_doctors_working', {
        p_clinic: clinicId,
        p_date: todayString(),
      }),
    ) as number;
    return { count };
  }),

  countMyClinicBookedAppointments: query(async (ctx) => {
    const clinicId = await myClinicId(ctx);
    const { count, error } = await ctx.db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('appointment_date', todayString())
      .neq('status', 'cancelled');
    if (error) unwrap({ data: null, error });
    return { count: count ?? 0 };
  }),
};
