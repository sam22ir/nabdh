import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { getAuthedUser } from './lib/auth';
import { normalizeOptionalEmail } from './lib/identity';

type DbCtx = QueryCtx | MutationCtx;

type PublicDoctorFilters = {
  specialtyId?: Doc<'doctors'>['specialtyId'];
  wilayaId?: Doc<'clinics'>['wilayaId'];
  search?: string;
  availableToday?: boolean;
};

async function listActiveClinics(
  ctx: DbCtx,
  doctorId: Doc<'doctors'>['_id'],
) {
  const legacyClinics = await ctx.db
    .query('clinics')
    .withIndex('by_doctorId', (q) => q.eq('doctorId', doctorId))
    .take(20);

  const acceptedMemberships = await ctx.db
    .query('clinicMemberships')
    .withIndex('by_doctorId_and_status', (q) =>
      q.eq('doctorId', doctorId).eq('status', 'accepted'),
    )
    .take(5);

  const clinics = [...legacyClinics];
  const seenClinicIds = new Set(clinics.map((clinic) => clinic._id));
  for (const membership of acceptedMemberships) {
    if (seenClinicIds.has(membership.clinicId)) continue;
    const clinic = await ctx.db.get(membership.clinicId);
    if (clinic) {
      clinics.push(clinic);
      seenClinicIds.add(clinic._id);
    }
  }

  const activeClinics = [];
  for (const clinic of clinics) {
    if (clinic.isActive) activeClinics.push(clinic);
  }
  return activeClinics;
}

async function getPrimaryWilaya(
  ctx: DbCtx,
  clinics: Doc<'clinics'>[],
) {
  const primaryClinic = clinics[0];
  if (!primaryClinic) return null;
  return await ctx.db.get(primaryClinic.wilayaId);
}

async function hasAvailableScheduleToday(
  ctx: DbCtx,
  clinics: Doc<'clinics'>[],
  doctorId: Doc<'doctors'>['_id'],
) {
  const dayOfWeek = new Date().getDay();
  for (const clinic of clinics) {
    const schedule = clinic.doctorId === doctorId
      ? await ctx.db
          .query('schedules')
          .withIndex('by_clinicId_and_dayOfWeek', (q) =>
            q.eq('clinicId', clinic._id).eq('dayOfWeek', dayOfWeek),
          )
          .unique()
      : await ctx.db
          .query('schedules')
          .withIndex('by_clinicId_and_doctorId_and_dayOfWeek', (q) =>
            q
              .eq('clinicId', clinic._id)
              .eq('doctorId', doctorId)
              .eq('dayOfWeek', dayOfWeek),
          )
          .unique();
    if (schedule?.isActive) return true;
  }
  return false;
}

async function listActiveScheduleDays(
  ctx: DbCtx,
  clinics: Doc<'clinics'>[],
  doctorId: Doc<'doctors'>['_id'],
) {
  const activeDays = new Set<number>();

  for (const clinic of clinics) {
    const schedules = clinic.doctorId === doctorId
      ? await ctx.db
          .query('schedules')
          .withIndex('by_clinicId_and_dayOfWeek', (q) =>
            q.eq('clinicId', clinic._id),
          )
          .take(7)
      : await ctx.db
          .query('schedules')
          .withIndex('by_clinicId_and_doctorId_and_dayOfWeek', (q) =>
            q.eq('clinicId', clinic._id).eq('doctorId', doctorId),
          )
          .take(7);

    for (const schedule of schedules) {
      if (schedule.isActive) {
        activeDays.add(schedule.dayOfWeek);
      }
    }
  }

  return activeDays;
}

async function getNextAvailableInDays(
  ctx: DbCtx,
  clinics: Doc<'clinics'>[],
  doctorId: Doc<'doctors'>['_id'],
) {
  const activeDays = await listActiveScheduleDays(ctx, clinics, doctorId);
  if (activeDays.size === 0) return null;

  const today = new Date().getDay();
  for (let offset = 0; offset < 7; offset += 1) {
    const dayOfWeek = (today + offset) % 7;
    if (activeDays.has(dayOfWeek)) {
      return offset;
    }
  }

  return null;
}

function hasClinicInWilaya(
  clinics: Doc<'clinics'>[],
  wilayaId: Doc<'clinics'>['wilayaId'],
) {
  for (const clinic of clinics) {
    if (clinic.wilayaId === wilayaId) return true;
  }
  return false;
}

function normalizedSearch(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
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

async function doctorCard(
  ctx: DbCtx,
  user: Doc<'users'>,
  doctor: Doc<'doctors'>,
  clinics?: Doc<'clinics'>[],
) {
  const specialty = await ctx.db.get(doctor.specialtyId);
  if (!specialty || !user.isActive || user.role !== 'doctor') return null;
  const activeClinics = clinics ?? await listActiveClinics(ctx, doctor._id);
  const wilaya = await getPrimaryWilaya(ctx, activeClinics);
  const nextAvailableInDays = await getNextAvailableInDays(
    ctx,
    activeClinics,
    doctor._id,
  );
  const isAvailableToday = nextAvailableInDays === 0;
  const acceptedClinic = activeClinics.find((clinic) => clinic.ownerUserId) ?? null;
  const legacyClinic = activeClinics.find((clinic) => clinic.doctorId === doctor._id) ?? null;
  const bookingClinic = acceptedClinic ?? legacyClinic;

  return {
    _id: doctor._id,
    userId: user._id,
    fullName: user.fullName,
    fullNameAr: user.fullName,
    gender: user.gender,
    phone: user.phone,
    user: {
      _id: user._id,
      _creationTime: user._creationTime,
      fullName: user.fullName,
      fullNameAr: user.fullName,
      gender: user.gender,
      phone: user.phone,
      email: user.email ?? null,
      image: null,
    },
    specialty: {
      ...specialty,
      nameAr: specialty.name,
      nameFr: specialty.name,
    },
    specialtyId: doctor.specialtyId,
    wilaya: wilaya
      ? {
          ...wilaya,
          nameAr: wilaya.name,
          nameFr: wilaya.name,
        }
      : null,
    clinics: activeClinics,
    acceptedClinicId: bookingClinic?._id ?? null,
    isBookable: Boolean(bookingClinic),
    bio: doctor.bio,
    bioAr: doctor.bio,
    yearsOfExperience: doctor.yearsOfExperience,
    ...(doctor.consultationFee && doctor.consultationFee > 0
      ? { consultationFee: doctor.consultationFee }
      : {}),
    ...(doctor.followUpFee && doctor.followUpFee > 0
      ? { followUpFee: doctor.followUpFee }
      : {}),
    avgRating: doctor.avgRating,
    totalReviews: doctor.totalReviews,
    isVerified: false,
    isAvailableToday,
    nextAvailableInDays,
  };
}

type PublicDoctorCard = Exclude<Awaited<ReturnType<typeof doctorCard>>, null>;

async function getAuthedPatient(ctx: DbCtx) {
  const user = await getAuthedUser(ctx);
  if (user.role !== 'patient') {
    throw new ConvexError('Patient account required');
  }
  const patient = await ctx.db
    .query('patients')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .unique();
  if (!patient) throw new ConvexError('Patient profile not found');
  return patient;
}

async function listPublicDoctors(
  ctx: DbCtx,
  args: PublicDoctorFilters,
) {
  const users = await ctx.db
    .query('users')
    .withIndex('by_role', (q) => q.eq('role', 'doctor'))
    .take(100);

  const searchText = normalizedSearch(args.search);
  const results: PublicDoctorCard[] = [];
  for (const user of users) {
    const doctor = await ctx.db
      .query('doctors')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();
    if (!doctor) continue;
    if (args.specialtyId && doctor.specialtyId !== args.specialtyId) continue;

    const clinics = await listActiveClinics(ctx, doctor._id);
    if (args.wilayaId && !hasClinicInWilaya(clinics, args.wilayaId)) continue;

    const card = await doctorCard(ctx, user, doctor, clinics);
    if (!card) continue;
    if (args.availableToday && !card.isAvailableToday) continue;
    if (
      searchText &&
      !card.fullName.toLocaleLowerCase().includes(searchText) &&
      !card.specialty.name.toLocaleLowerCase().includes(searchText) &&
      !card.specialty.nameAr.toLocaleLowerCase().includes(searchText)
    ) {
      continue;
    }
    results.push(card);
  }

  return results.slice(0, 100);
}

export const listPublic = query({
  args: {
    paginationOpts: paginationOptsValidator,
    specialtyId: v.optional(v.id('specialties')),
    wilayaId: v.optional(v.id('wilayas')),
    search: v.optional(v.string()),
    availableToday: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const results = await listPublicDoctors(ctx, args);
    return paginateResults(results, args.paginationOpts);
  },
});

export const search = query({
  args: {
    paginationOpts: paginationOptsValidator,
    query: v.optional(v.string()),
    specialtyId: v.optional(v.id('specialties')),
    wilayaId: v.optional(v.id('wilayas')),
    availableToday: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const results = await listPublicDoctors(ctx, {
      search: args.query,
      specialtyId: args.specialtyId,
      wilayaId: args.wilayaId,
      availableToday: args.availableToday,
    });
    return paginateResults(results, args.paginationOpts);
  },
});

export const getById = query({
  args: { doctorId: v.id('doctors') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) return null;
    const user = await ctx.db.get(doctor.userId);
    if (!user) return null;
    const card = await doctorCard(ctx, user, doctor);
    if (!card) return null;

    return card;
  },
});

export const getMyProfile = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'doctor') return null;
    const doctor = await ctx.db
      .query('doctors')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();
    if (!doctor) return null;
    const profile = await doctorCard(ctx, user, doctor);
    if (!profile) return null;

    const {
      clinics: _clinics,
      acceptedClinicId: _acceptedClinicId,
      isBookable: _isBookable,
      wilaya: _wilaya,
      isAvailableToday: _isAvailableToday,
      avgRating: _avgRating,
      totalReviews: _totalReviews,
      isVerified: _isVerified,
      ...doctorProfile
    } = profile;

    return doctorProfile;
  },
});

export const updateProfile = mutation({
  args: {
    fullNameAr: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    bioAr: v.optional(v.string()),
    yearsOfExperience: v.optional(v.number()),
    consultationFee: v.optional(v.union(v.number(), v.null())),
    followUpFee: v.optional(v.union(v.number(), v.null())),
    specialtyId: v.optional(v.id('specialties')),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'doctor') throw new ConvexError('Doctor account required');
    const doctor = await ctx.db
      .query('doctors')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();
    if (!doctor) throw new ConvexError('Doctor profile not found');

    const userPatch: Partial<Doc<'users'>> = {};
    if (args.fullNameAr !== undefined) userPatch.fullName = args.fullNameAr.trim();
    if (args.phone !== undefined) userPatch.phone = args.phone.trim();
    if (args.email !== undefined) {
      const emailIdentity = normalizeOptionalEmail(args.email);
      if (emailIdentity.emailNormalized) {
        const emailUser = await ctx.db
          .query('users')
          .withIndex('by_emailNormalized', (q) =>
            q.eq('emailNormalized', emailIdentity.emailNormalized),
          )
          .unique();
        if (emailUser && emailUser._id !== user._id) {
          throw new ConvexError('This email is already registered');
        }
      }
      userPatch.email = emailIdentity.email;
      userPatch.emailNormalized = emailIdentity.emailNormalized;
    }
    if (Object.keys(userPatch).length > 0) {
      await ctx.db.patch(user._id, userPatch);
    }

    const doctorPatch: Partial<Doc<'doctors'>> = {};
    const bio = args.bio ?? args.bioAr;
    if (bio !== undefined) doctorPatch.bio = bio;
    if (args.yearsOfExperience !== undefined) {
      doctorPatch.yearsOfExperience = args.yearsOfExperience;
    }
    if (args.consultationFee !== undefined) {
      doctorPatch.consultationFee = args.consultationFee ?? undefined;
    }
    if (args.followUpFee !== undefined) {
      doctorPatch.followUpFee = args.followUpFee ?? undefined;
    }
    if (args.specialtyId !== undefined) doctorPatch.specialtyId = args.specialtyId;

    if (Object.keys(doctorPatch).length > 0) {
      await ctx.db.patch(doctor._id, doctorPatch);
    }
    return { ok: true };
  },
});

export const isFavorite = query({
  args: { doctorId: v.id('doctors') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const patient = await getAuthedPatient(ctx);
    const favorite = await ctx.db
      .query('patientFavorites')
      .withIndex('by_patientId_and_doctorId', (q) =>
        q.eq('patientId', patient._id).eq('doctorId', args.doctorId),
      )
      .unique();
    return favorite !== null;
  },
});

export const toggleFavorite = mutation({
  args: { doctorId: v.id('doctors') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const patient = await getAuthedPatient(ctx);
    const favorite = await ctx.db
      .query('patientFavorites')
      .withIndex('by_patientId_and_doctorId', (q) =>
        q.eq('patientId', patient._id).eq('doctorId', args.doctorId),
      )
      .unique();

    if (favorite) {
      await ctx.db.delete(favorite._id);
      return { ok: true, isFavorite: false };
    }

    await ctx.db.insert('patientFavorites', {
      patientId: patient._id,
      doctorId: args.doctorId,
    });
    return { ok: true, isFavorite: true };
  },
});

export const getFavorites = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const patient = await getAuthedPatient(ctx);
    const favorites = await ctx.db
      .query('patientFavorites')
      .withIndex('by_patientId', (q) => q.eq('patientId', patient._id))
      .take(100);

    const cards = [];
    for (const favorite of favorites) {
      const doctor = await ctx.db.get(favorite.doctorId);
      if (!doctor) continue;
      const user = await ctx.db.get(doctor.userId);
      if (!user) continue;
      const card = await doctorCard(ctx, user, doctor);
      if (card) cards.push(card);
    }
    return cards;
  },
});
