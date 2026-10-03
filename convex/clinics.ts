import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';
import { neutralSpecialtyName } from './lib/specialties';

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

function clinicLocationFields(args: {
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
}) {
  const fields: {
    latitude?: number;
    longitude?: number;
    mapUrl?: string;
  } = {};

  if (args.latitude !== undefined) fields.latitude = args.latitude;
  if (args.longitude !== undefined) fields.longitude = args.longitude;

  const mapUrl = args.mapUrl?.trim();
  if (mapUrl) fields.mapUrl = mapUrl;

  return fields;
}

function paginateResults<T>(
  results: T[],
  paginationOpts: { numItems: number; cursor: string | null },
) {
  const requestedStart = paginationOpts.cursor
    ? Number.parseInt(paginationOpts.cursor, 10)
    : 0;
  const start = Number.isFinite(requestedStart) && requestedStart > 0
    ? requestedStart
    : 0;
  const end = start + Math.max(0, Math.floor(paginationOpts.numItems));
  const page = results.slice(start, end);
  const isDone = end >= results.length;

  return {
    page,
    isDone,
    continueCursor: isDone ? '' : String(end),
  };
}

async function acceptedMembershipsForClinic(ctx: any, clinicId: any) {
  return await ctx.db
    .query('clinicMemberships')
    .withIndex('by_clinicId_and_status', (q: any) =>
      q.eq('clinicId', clinicId).eq('status', 'accepted'),
    )
    .take(100);
}

async function clinicCard(ctx: any, clinic: any) {
  const wilaya = await ctx.db.get(clinic.wilayaId);
  const acceptedMemberships = await acceptedMembershipsForClinic(ctx, clinic._id);
  return {
    ...clinic,
    nameAr: clinic.name,
    wilaya: wilaya
      ? {
          ...wilaya,
          nameAr: wilaya.name,
          nameFr: wilaya.name,
        }
      : null,
    acceptedDoctorCount: acceptedMemberships.length,
    isBookable: clinic.isActive && acceptedMemberships.length > 0,
  };
}

async function doctorBookingCard(ctx: any, membership: any, preselectedDoctorId?: any) {
  const doctor = await ctx.db.get(membership.doctorId);
  if (!doctor) return null;
  const user = await ctx.db.get(doctor.userId);
  const specialty = await ctx.db.get(doctor.specialtyId);
  if (!user || !specialty || !user.isActive) return null;

  return {
    _id: doctor._id,
    userId: user._id,
    fullName: user.fullName,
    fullNameAr: user.fullName,
    gender: user.gender,
    specialtyId: doctor.specialtyId,
    specialty: {
      ...specialty,
      name: neutralSpecialtyName(specialty.name),
      nameAr: neutralSpecialtyName(specialty.name),
      nameFr: neutralSpecialtyName(specialty.name),
    },
    avgRating: doctor.avgRating,
    totalReviews: doctor.totalReviews,
    isPreselected: preselectedDoctorId === doctor._id,
  };
}

export const listPublic = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    wilayaId: v.optional(v.id('wilayas')),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const wilayaId = args.wilayaId;
    const clinics = wilayaId
      ? await ctx.db
          .query('clinics')
          .withIndex('by_wilayaId', (q) => q.eq('wilayaId', wilayaId))
          .take(100)
      : await ctx.db.query('clinics').take(100);

    const search = args.search?.trim().toLocaleLowerCase() ?? '';
    const cards = [];
    for (const clinic of clinics) {
      if (!clinic.ownerUserId) continue;
      if (
        search &&
        !clinic.name.toLocaleLowerCase().includes(search) &&
        !(clinic.address ?? '').toLocaleLowerCase().includes(search)
      ) {
        continue;
      }
      cards.push(await clinicCard(ctx, clinic));
    }

    return paginateResults(cards, args.paginationOpts);
  },
});

export const getBookingContext = query({
  args: {
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic) return null;

    const memberships = await acceptedMembershipsForClinic(ctx, args.clinicId);
    const doctors = [];
    for (const membership of memberships) {
      const card = await doctorBookingCard(ctx, membership, args.doctorId);
      if (card) doctors.push(card);
    }

    return {
      clinic: await clinicCard(ctx, clinic),
      doctors,
    };
  },
});

export const getMyClinics = query({
  args: {},
  handler: async (ctx) => {
    const doctor = await getAuthedDoctor(ctx);
    return await ctx.db
      .query('clinics')
      .withIndex('by_doctorId', (q) => q.eq('doctorId', doctor._id))
      .take(50);
  },
});

export const getById = query({
  args: { clinicId: v.id('clinics') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.clinicId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    wilayaId: v.id('wilayas'),
    address: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    mapUrl: v.optional(v.string()),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const doctor = await getAuthedDoctor(ctx);
    return await ctx.db.insert('clinics', {
      doctorId: doctor._id,
      name: args.name.trim(),
      wilayaId: args.wilayaId,
      address: args.address.trim(),
      ...clinicLocationFields(args),
      phone: args.phone.trim(),
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    clinicId: v.id('clinics'),
    name: v.string(),
    wilayaId: v.id('wilayas'),
    address: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    mapUrl: v.optional(v.string()),
    phone: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const doctor = await getAuthedDoctor(ctx);
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic || clinic.doctorId !== doctor._id) {
      throw new ConvexError('Clinic not found');
    }

    await ctx.db.patch(args.clinicId, {
      name: args.name.trim(),
      wilayaId: args.wilayaId,
      address: args.address.trim(),
      ...clinicLocationFields(args),
      phone: args.phone.trim(),
      isActive: args.isActive ?? clinic.isActive,
    });
    return { ok: true };
  },
});

export const setActive = mutation({
  args: {
    clinicId: v.id('clinics'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const doctor = await getAuthedDoctor(ctx);
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic || clinic.doctorId !== doctor._id) {
      throw new ConvexError('Clinic not found');
    }

    await ctx.db.patch(args.clinicId, { isActive: args.isActive });
    return { ok: true };
  },
});

export const delete_ = mutation({
  args: { clinicId: v.id('clinics') },
  handler: async (ctx, args) => {
    const doctor = await getAuthedDoctor(ctx);
    const clinic = await ctx.db.get(args.clinicId);
    if (!clinic || clinic.doctorId !== doctor._id) {
      throw new ConvexError('Clinic not found');
    }
    await ctx.db.patch(args.clinicId, { isActive: false });
    return { ok: true };
  },
});
