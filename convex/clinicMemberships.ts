import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';

type DbCtx = QueryCtx | MutationCtx;

const ALGERIA_OFFSET_MS = 60 * 60 * 1000;

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayString() {
  return formatDateOnly(new Date(Date.now() + ALGERIA_OFFSET_MS));
}

async function getAuthedDoctor(ctx: DbCtx) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'doctor') throw new ConvexError('Doctor account required');
  const doctor = await ctx.db
    .query('doctors')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique();
  if (!doctor) throw new ConvexError('Doctor profile not found');
  return { user, doctor };
}

async function getAuthedClinic(ctx: DbCtx) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'clinic') throw new ConvexError('Clinic account required');
  const clinic = await ctx.db
    .query('clinics')
    .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', user._id))
    .unique();
  if (!clinic) throw new ConvexError('Clinic profile not found');
  return { user, clinic };
}

async function getDoctorUser(ctx: DbCtx, doctorId: Id<'doctors'>) {
  const doctor = await ctx.db.get(doctorId);
  if (!doctor) return null;
  const user = await ctx.db.get(doctor.userId);
  if (!user) return null;
  return { doctor, user };
}

async function findMembershipsBetween(
  ctx: DbCtx,
  clinicId: Id<'clinics'>,
  doctorId: Id<'doctors'>,
) {
  return await ctx.db
    .query('clinicMemberships')
    .withIndex('by_clinicId_and_doctorId', (q) =>
      q.eq('clinicId', clinicId).eq('doctorId', doctorId),
    )
    .take(50);
}

async function getAcceptedMembershipForDoctor(
  ctx: DbCtx,
  doctorId: Id<'doctors'>,
) {
  const memberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_doctorId_and_status', (q) =>
      q.eq('doctorId', doctorId).eq('status', 'accepted'),
    )
    .take(2);
  return memberships[0] ?? null;
}

async function getAcceptedMembershipBetween(
  ctx: DbCtx,
  clinicId: Id<'clinics'>,
  doctorId: Id<'doctors'>,
) {
  const memberships = await findMembershipsBetween(ctx, clinicId, doctorId);
  return memberships.find((membership) => membership.status === 'accepted') ?? null;
}

async function notifyUser(
  ctx: MutationCtx,
  userId: Id<'users'>,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  await ctx.runMutation(internal.notifications.createForUser, {
    userId,
    type,
    title,
    body,
    data,
  });
}

async function cancelFutureBookingsForMembership(
  ctx: MutationCtx,
  membership: Doc<'clinicMemberships'>,
  reason: string,
) {
  const today = todayString();
  const bookings = await ctx.db
    .query('bookings')
    .withIndex('by_doctorId_and_appointmentDate', (q) =>
      q.eq('doctorId', membership.doctorId).gte('appointmentDate', today),
    )
    .take(500);

  let cancelled = 0;
  for (const booking of bookings) {
    if (booking.clinicId !== membership.clinicId || booking.status !== 'confirmed') {
      continue;
    }
    await ctx.db.patch(booking._id, {
      status: 'cancelled',
      cancelledBy: 'system',
      cancellationReason: reason,
      cancelledAt: Date.now(),
    });
    cancelled += 1;

    const patient = await ctx.db.get(booking.patientId);
    const patientUser = patient ? await ctx.db.get(patient.userId) : null;
    if (patientUser) {
      await notifyUser(
        ctx,
        patientUser._id,
        'booking_cancelled',
        'تم إلغاء الموعد',
        `تم إلغاء موعدك: ${reason}`,
        {
          bookingId: booking._id,
          clinicId: booking.clinicId,
          doctorId: booking.doctorId,
          reason,
        },
      );
    }
  }

  return cancelled;
}

async function buildMembershipCard(ctx: DbCtx, membership: Doc<'clinicMemberships'>) {
  const clinic = await ctx.db.get(membership.clinicId);
  const doctorUser = await getDoctorUser(ctx, membership.doctorId);
  return {
    ...membership,
    clinic,
    clinicName: clinic?.name ?? '',
    doctorName: doctorUser?.user.fullName ?? '',
    doctorPhone: doctorUser?.user.phone ?? '',
  };
}

export const requestToJoinClinic = mutation({
  args: { clinicId: v.id('clinics') },
  returns: v.id('clinicMemberships'),
  handler: async (ctx, args) => {
    const { doctor } = await getAuthedDoctor(ctx);
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) throw new ConvexError('Clinic not found');

    const accepted = await getAcceptedMembershipForDoctor(ctx, doctor._id);
    if (accepted) throw new ConvexError('Doctor already belongs to a clinic');

    const existing = await findMembershipsBetween(ctx, args.clinicId, doctor._id);
    const open = existing.find(
      (membership) =>
        membership.status === 'pending' || membership.status === 'accepted',
    );
    if (open) return open._id;

    const now = Date.now();
    const membershipId = await ctx.db.insert('clinicMemberships', {
      clinicId: args.clinicId,
      doctorId: doctor._id,
      requestedBy: 'doctor',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    if (clinic.ownerUserId) {
      await notifyUser(
        ctx,
        clinic.ownerUserId,
        'doctor_join_request',
        'طلب انضمام مختص',
        'يوجد طلب جديد من مختص للانضمام إلى المركز.',
        { membershipId, clinicId: args.clinicId, doctorId: doctor._id },
      );
    }

    return membershipId;
  },
});

export const inviteDoctor = mutation({
  args: { doctorId: v.id('doctors') },
  returns: v.id('clinicMemberships'),
  handler: async (ctx, args) => {
    const { clinic } = await getAuthedClinic(ctx);
    const doctorUser = await getDoctorUser(ctx, args.doctorId);
    if (!doctorUser) throw new ConvexError('Doctor not found');

    const existing = await findMembershipsBetween(ctx, clinic._id, args.doctorId);
    const open = existing.find(
      (membership) =>
        membership.status === 'pending' || membership.status === 'accepted',
    );
    if (open) return open._id;

    const now = Date.now();
    const membershipId = await ctx.db.insert('clinicMemberships', {
      clinicId: clinic._id,
      doctorId: args.doctorId,
      requestedBy: 'clinic',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await notifyUser(
      ctx,
      doctorUser.user._id,
      'clinic_invite',
      'دعوة للانضمام إلى مركز',
      `${clinic.name} أرسلت لك دعوة للانضمام إلى المركز.`,
      { membershipId, clinicId: clinic._id, doctorId: args.doctorId },
    );

    return membershipId;
  },
});

export const accept = mutation({
  args: { membershipId: v.id('clinicMemberships') },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.status !== 'pending') {
      throw new ConvexError('Membership request not found');
    }

    if (membership.requestedBy === 'doctor') {
      if (user.role !== 'clinic') throw new ConvexError('Clinic account required');
      const clinic = await ctx.db.get(membership.clinicId);
      if (!clinic || clinic.ownerUserId !== user._id) {
        throw new ConvexError('Membership request not found');
      }
    } else {
      if (user.role !== 'doctor') throw new ConvexError('Doctor account required');
      const doctor = await ctx.db.get(membership.doctorId);
      if (!doctor || doctor.userId !== user._id) {
        throw new ConvexError('Membership request not found');
      }
    }

    const accepted = await getAcceptedMembershipForDoctor(ctx, membership.doctorId);
    if (accepted && accepted._id !== membership._id) {
      throw new ConvexError('Doctor already belongs to a clinic');
    }

    await ctx.db.patch(args.membershipId, {
      status: 'accepted',
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });

    const clinic = await ctx.db.get(membership.clinicId);
    const doctorUser = await getDoctorUser(ctx, membership.doctorId);
    if (membership.requestedBy === 'doctor' && doctorUser) {
      await notifyUser(
        ctx,
        doctorUser.user._id,
        'clinic_membership_accepted',
        'تم قبول طلب الانضمام',
        `${clinic?.name ?? 'المركز'} قبلت طلب الانضمام.`,
        { membershipId: args.membershipId },
      );
    } else if (membership.requestedBy === 'clinic' && clinic?.ownerUserId) {
      await notifyUser(
        ctx,
        clinic.ownerUserId,
        'clinic_membership_accepted',
        'تم قبول الدعوة',
        `${doctorUser?.user.fullName ?? 'المختص'} قبل دعوة المركز.`,
        { membershipId: args.membershipId },
      );
    }

    return { ok: true };
  },
});

export const reject = mutation({
  args: { membershipId: v.id('clinicMemberships') },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.status !== 'pending') {
      throw new ConvexError('Membership request not found');
    }

    if (membership.requestedBy === 'doctor') {
      const clinic = await ctx.db.get(membership.clinicId);
      if (user.role !== 'clinic' || clinic?.ownerUserId !== user._id) {
        throw new ConvexError('Membership request not found');
      }
    } else {
      const doctor = await ctx.db.get(membership.doctorId);
      if (user.role !== 'doctor' || doctor?.userId !== user._id) {
        throw new ConvexError('Membership request not found');
      }
    }

    await ctx.db.patch(args.membershipId, {
      status: 'rejected',
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const cancel = mutation({
  args: { membershipId: v.id('clinicMemberships') },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.status !== 'pending') {
      throw new ConvexError('Membership request not found');
    }

    if (membership.requestedBy === 'doctor') {
      const doctor = await ctx.db.get(membership.doctorId);
      if (user.role !== 'doctor' || doctor?.userId !== user._id) {
        throw new ConvexError('Membership request not found');
      }
    } else {
      const clinic = await ctx.db.get(membership.clinicId);
      if (user.role !== 'clinic' || clinic?.ownerUserId !== user._id) {
        throw new ConvexError('Membership request not found');
      }
    }

    await ctx.db.patch(args.membershipId, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const leaveClinic = mutation({
  args: { reason: v.optional(v.string()) },
  returns: v.object({ ok: v.boolean(), cancelled: v.number() }),
  handler: async (ctx, args) => {
    const { doctor } = await getAuthedDoctor(ctx);
    const membership = await getAcceptedMembershipForDoctor(ctx, doctor._id);
    if (!membership) throw new ConvexError('Accepted clinic not found');

    const reason = args.reason?.trim() || 'غادر المختص المركز';
    await ctx.db.patch(membership._id, {
      status: 'ended',
      endedAt: Date.now(),
      endedBy: 'doctor',
      endReason: reason,
      updatedAt: Date.now(),
    });
    const cancelled = await cancelFutureBookingsForMembership(ctx, membership, reason);
    return { ok: true, cancelled };
  },
});

export const removeDoctor = mutation({
  args: {
    doctorId: v.id('doctors'),
    reason: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), cancelled: v.number() }),
  handler: async (ctx, args) => {
    const { clinic } = await getAuthedClinic(ctx);
    const membership = await getAcceptedMembershipBetween(ctx, clinic._id, args.doctorId);
    if (!membership) throw new ConvexError('Accepted doctor not found');

    const reason = args.reason?.trim() || 'تم إنهاء عضوية المختص في المركز';
    await ctx.db.patch(membership._id, {
      status: 'ended',
      endedAt: Date.now(),
      endedBy: 'clinic',
      endReason: reason,
      updatedAt: Date.now(),
    });
    const cancelled = await cancelFutureBookingsForMembership(ctx, membership, reason);
    return { ok: true, cancelled };
  },
});

export const getMyAcceptedClinic = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { doctor } = await getAuthedDoctor(ctx);
    const membership = await getAcceptedMembershipForDoctor(ctx, doctor._id);
    if (!membership) return null;
    return await buildMembershipCard(ctx, membership);
  },
});

export const listMyDoctorInvites = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { doctor } = await getAuthedDoctor(ctx);
    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_doctorId_and_status', (q) =>
        q.eq('doctorId', doctor._id).eq('status', 'pending'),
      )
      .take(50);
    const invites = memberships.filter(
      (membership) => membership.requestedBy === 'clinic',
    );
    const cards = [];
    for (const membership of invites) {
      cards.push(await buildMembershipCard(ctx, membership));
    }
    return cards;
  },
});

export const listMyDoctorRequests = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { doctor } = await getAuthedDoctor(ctx);
    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_doctorId_and_status', (q) =>
        q.eq('doctorId', doctor._id).eq('status', 'pending'),
      )
      .take(50);
    const requests = memberships.filter(
      (membership) => membership.requestedBy === 'doctor',
    );
    const cards = [];
    for (const membership of requests) {
      cards.push(await buildMembershipCard(ctx, membership));
    }
    return cards;
  },
});

export const listMyClinicRequests = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { clinic } = await getAuthedClinic(ctx);
    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_clinicId_and_status', (q) =>
        q.eq('clinicId', clinic._id).eq('status', 'pending'),
      )
      .take(50);
    const requests = memberships.filter(
      (membership) => membership.requestedBy === 'doctor',
    );
    const cards = [];
    for (const membership of requests) {
      cards.push(await buildMembershipCard(ctx, membership));
    }
    return cards;
  },
});

export const listMyClinicDoctors = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { clinic } = await getAuthedClinic(ctx);
    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_clinicId_and_status', (q) =>
        q.eq('clinicId', clinic._id).eq('status', 'accepted'),
      )
      .take(100);
    const cards = [];
    for (const membership of memberships) {
      cards.push(await buildMembershipCard(ctx, membership));
    }
    return cards;
  },
});

export const listMyClinicInvites = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const { clinic } = await getAuthedClinic(ctx);
    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_clinicId_and_status', (q) =>
        q.eq('clinicId', clinic._id).eq('status', 'pending'),
      )
      .take(50);
    const invites = memberships.filter(
      (membership) => membership.requestedBy === 'clinic',
    );
    const cards = [];
    for (const membership of invites) {
      cards.push(await buildMembershipCard(ctx, membership));
    }
    return cards;
  },
});
