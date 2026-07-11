import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { getAuthedUser, getAuthedUserId, getOptionalAuthedUser } from './lib/auth';
import { buildPhoneIdentity, normalizeOptionalEmail } from './lib/identity';

const roleValidator = v.union(
  v.literal('patient'),
  v.literal('doctor'),
  v.literal('clinic'),
);
const genderValidator = v.union(v.literal('male'), v.literal('female'));
type DbCtx = QueryCtx | MutationCtx;
type AccountUser = Doc<'users'>;

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

async function getPatientProfile(ctx: DbCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('patients')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();
}

async function getDoctorProfile(ctx: DbCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('doctors')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique();
}

async function getClinicProfile(ctx: DbCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('clinics')
    .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
    .unique();
}

async function getJoinedProfile(ctx: DbCtx, user: AccountUser) {
  if (user.role === 'patient') {
    return await getPatientProfile(ctx, user._id);
  }
  if (user.role === 'clinic') {
    return await getClinicProfile(ctx, user._id);
  }
  return await getDoctorProfile(ctx, user._id);
}

async function deleteUserNotificationsAndPushTokens(ctx: MutationCtx, userId: Id<'users'>) {
  const notifications = await ctx.db
    .query('notifications')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .take(200);
  for (const notification of notifications) {
    await ctx.db.delete(notification._id);
  }

  const pushTokens = await ctx.db
    .query('pushTokens')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .take(100);
  for (const token of pushTokens) {
    await ctx.db.delete(token._id);
  }
}

export const me = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const user = await getOptionalAuthedUser(ctx);
    if (!user) return null;

    return {
      ...user,
      profile: await getJoinedProfile(ctx, user),
    };
  },
});

export const getProfile = query({
  args: { userId: v.id('users') },
  returns: v.any(),
  handler: async (ctx, args) => {
    const callerId = await getAuthedUserId(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    if (callerId !== args.userId) {
      throw new ConvexError('Access denied. You can only read your own profile.');
    }

    return {
      ...user,
      profile: await getJoinedProfile(ctx, user),
    };
  },
});

export const registerAccount = mutation({
  args: {
    role: roleValidator,
    fullName: v.optional(v.string()),
    clinicName: v.optional(v.string()),
    gender: v.optional(genderValidator),
    phone: v.string(),
    phoneLoginKey: v.optional(v.string()),
    email: v.string(),
    specialtyId: v.optional(v.id('specialties')),
    wilayaId: v.optional(v.id('wilayas')),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    mapUrl: v.optional(v.string()),
    termsVersion: v.optional(v.string()),
    privacyVersion: v.optional(v.string()),
    legalAcceptedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Authentication required');
    }

    const existingIdentityUser = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (existingIdentityUser) {
      throw new ConvexError('Account already exists');
    }

    const phoneIdentity = buildPhoneIdentity(args.phone);
    const emailIdentity = normalizeOptionalEmail(args.email);

    const phoneUser = await ctx.db
      .query('users')
      .withIndex('by_phoneNormalized', (q) =>
        q.eq('phoneNormalized', phoneIdentity.phoneNormalized),
      )
      .unique();
    if (phoneUser) {
      throw new ConvexError('This phone is already registered');
    }

    if (emailIdentity.emailNormalized) {
      const emailUser = await ctx.db
        .query('users')
        .withIndex('by_emailNormalized', (q) =>
          q.eq('emailNormalized', emailIdentity.emailNormalized),
        )
        .unique();
      if (emailUser) {
        throw new ConvexError('This email is already registered');
      }
    }

    if (args.role !== 'clinic' && args.gender !== 'male' && args.gender !== 'female') {
      throw new ConvexError('Gender is required');
    }

    if (args.role === 'doctor') {
      if (!args.specialtyId) {
        throw new ConvexError('Specialty is required');
      }
      const specialty = await ctx.db.get(args.specialtyId);
      if (!specialty) {
        throw new ConvexError('Specialty is required');
      }
      if (!args.wilayaId) {
        throw new ConvexError('Wilaya is required');
      }
      const wilaya = await ctx.db.get(args.wilayaId);
      if (!wilaya) {
        throw new ConvexError('Wilaya is required');
      }
    }

    if (args.role === 'clinic') {
      if (!args.wilayaId) {
        throw new ConvexError('Wilaya is required');
      }
      const wilaya = await ctx.db.get(args.wilayaId);
      if (!wilaya) {
        throw new ConvexError('Wilaya is required');
      }
    }

    const fullName = (args.role === 'clinic'
      ? args.clinicName ?? args.fullName ?? ''
      : args.fullName ?? ''
    ).trim();
    if (!fullName) {
      throw new ConvexError(
        args.role === 'clinic' ? 'Clinic name is required' : 'Full name is required',
      );
    }

    const userId = await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      fullName,
      role: args.role,
      phone: phoneIdentity.phone,
      phoneNormalized: phoneIdentity.phoneNormalized,
      phoneLoginKey: args.phoneLoginKey ?? phoneIdentity.phoneLoginKey,
      email: emailIdentity.email,
      emailNormalized: emailIdentity.emailNormalized,
      isActive: true,
      ...(args.termsVersion ? { termsVersion: args.termsVersion } : {}),
      ...(args.privacyVersion ? { privacyVersion: args.privacyVersion } : {}),
      ...(args.legalAcceptedAt !== undefined
        ? { legalAcceptedAt: args.legalAcceptedAt }
        : {}),
      ...(args.gender ? { gender: args.gender } : {}),
    });

    if (args.role === 'patient') {
      await ctx.db.insert('patients', {
        userId,
        chronicDiseases: [],
        allergies: [],
      });
    } else if (args.role === 'doctor') {
      await ctx.db.insert('doctors', {
        userId,
        specialtyId: args.specialtyId!,
        wilayaId: args.wilayaId!,
        bio: '',
        yearsOfExperience: 0,
        avgRating: 0,
        totalReviews: 0,
      });
    } else {
      await ctx.db.insert('clinics', {
        ownerUserId: userId,
        name: fullName,
        wilayaId: args.wilayaId!,
        phone: phoneIdentity.phone,
        email: emailIdentity.email,
        emailNormalized: emailIdentity.emailNormalized,
        ...(args.address?.trim() ? { address: args.address.trim() } : {}),
        ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
        ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
        ...(args.mapUrl?.trim() ? { mapUrl: args.mapUrl.trim() } : {}),
        isActive: true,
      });
    }

    return { userId };
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const userPatch: Partial<Doc<'users'>> = {
      fullName: args.fullName?.trim() || user.fullName,
      phone: args.phone?.trim() || user.phone,
    };

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

    await ctx.db.patch(user._id, userPatch);
    return { ok: true };
  },
});

export const updateMyClinicProfile = mutation({
  args: {
    clinicName: v.string(),
    phone: v.string(),
    email: v.string(),
    wilayaId: v.id('wilayas'),
    address: v.string(),
    mapUrl: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'clinic') {
      throw new ConvexError('Clinic account required');
    }

    const clinic = await getClinicProfile(ctx, user._id);
    if (!clinic) {
      throw new ConvexError('Clinic profile not found');
    }

    const clinicName = args.clinicName.trim();
    if (!clinicName) {
      throw new ConvexError('Clinic name is required');
    }

    const wilaya = await ctx.db.get(args.wilayaId);
    if (!wilaya) {
      throw new ConvexError('Wilaya is required');
    }

    const phoneIdentity = buildPhoneIdentity(args.phone);
    const emailIdentity = normalizeOptionalEmail(args.email);

    const phoneUser = await ctx.db
      .query('users')
      .withIndex('by_phoneNormalized', (q) =>
        q.eq('phoneNormalized', phoneIdentity.phoneNormalized),
      )
      .unique();
    if (phoneUser && phoneUser._id !== user._id) {
      throw new ConvexError('This phone is already registered');
    }

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

    const { _id: _userId, _creationTime: _userCreationTime, ...userFields } = user;
    await ctx.db.replace(user._id, {
      ...userFields,
      fullName: clinicName,
      phone: phoneIdentity.phone,
      phoneNormalized: phoneIdentity.phoneNormalized,
      phoneLoginKey: phoneIdentity.phoneLoginKey,
      email: emailIdentity.email,
      emailNormalized: emailIdentity.emailNormalized,
    });

    const {
      _id: _clinicId,
      _creationTime: _clinicCreationTime,
      address: _existingAddress,
      mapUrl: _existingMapUrl,
      ...clinicFields
    } = clinic;
    const address = args.address.trim();
    const mapUrl = args.mapUrl.trim();

    await ctx.db.replace(clinic._id, {
      ...clinicFields,
      name: clinicName,
      wilayaId: args.wilayaId,
      phone: phoneIdentity.phone,
      email: emailIdentity.email,
      emailNormalized: emailIdentity.emailNormalized,
      ...(address ? { address } : {}),
      ...(mapUrl ? { mapUrl } : {}),
    });

    return { ok: true };
  },
});

export const completePatientProfile = mutation({
  args: {},
  returns: v.any(),
  handler: async () => ({ ok: true }),
});

export const completeDoctorProfile = mutation({
  args: {
    specialtyId: v.id('specialties'),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'doctor') {
      throw new ConvexError('Only doctors can complete a doctor profile');
    }

    const specialty = await ctx.db.get(args.specialtyId);
    if (!specialty) {
      throw new ConvexError('Specialty is required');
    }

    const existingDoctor = await getDoctorProfile(ctx, user._id);
    if (existingDoctor) {
      await ctx.db.patch(existingDoctor._id, {
        specialtyId: args.specialtyId,
      });
      return { ok: true };
    }

    await ctx.db.insert('doctors', {
      userId: user._id,
      specialtyId: args.specialtyId,
      bio: '',
      yearsOfExperience: 0,
      avgRating: 0,
      totalReviews: 0,
    });

    return { ok: true };
  },
});

export const deleteMyDoctorAccount = mutation({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'doctor') {
      throw new ConvexError('Only doctors can delete this account');
    }

    const doctor = await getDoctorProfile(ctx, user._id);
    if (!doctor) {
      throw new ConvexError('Doctor profile not found');
    }

    const clinics = await ctx.db
      .query('clinics')
      .withIndex('by_doctorId', (q) => q.eq('doctorId', doctor._id))
      .take(100);
    const clinicIds = new Set(clinics.map((clinic) => clinic._id));

    for (const clinic of clinics) {
      const schedules = await ctx.db
        .query('schedules')
        .withIndex('by_clinicId', (q) => q.eq('clinicId', clinic._id))
        .take(100);
      for (const schedule of schedules) {
        await ctx.db.delete(schedule._id);
      }

      const exceptions = await ctx.db
        .query('scheduleExceptions')
        .withIndex('by_clinicId_and_exceptionDate', (q) => q.eq('clinicId', clinic._id))
        .take(100);
      for (const exception of exceptions) {
        await ctx.db.delete(exception._id);
      }
    }

    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_doctorId_and_appointmentDate', (q) => q.eq('doctorId', doctor._id))
      .take(500);
    const today = todayString();
    for (const booking of bookings) {
      if (booking.appointmentDate >= today && booking.status === 'confirmed') {
        await ctx.db.patch(booking._id, {
          status: 'cancelled',
          cancelledBy: 'system',
          cancellationReason: 'تم حذف حساب الطبيب',
          cancelledAt: Date.now(),
        });
      }
    }

    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_doctorId', (q) => q.eq('doctorId', doctor._id))
      .take(200);
    for (const review of reviews) {
      await ctx.db.patch(review._id, { isHidden: true });
    }

    const favorites = await ctx.db
      .query('patientFavorites')
      .withIndex('by_doctorId', (q) => q.eq('doctorId', doctor._id))
      .take(200);
    for (const favorite of favorites) {
      await ctx.db.delete(favorite._id);
    }

    const settings = await ctx.db
      .query('doctorSettings')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique();
    if (settings) {
      await ctx.db.delete(settings._id);
    }

    await deleteUserNotificationsAndPushTokens(ctx, user._id);

    for (const clinic of clinics) {
      if (clinicIds.has(clinic._id)) {
        await ctx.db.delete(clinic._id);
      }
    }

    await ctx.db.delete(doctor._id);
    await ctx.db.delete(user._id);

    return { ok: true };
  },
});

export const deleteMyClinicAccount = mutation({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'clinic') {
      throw new ConvexError('Only clinics can delete this account');
    }

    const clinic = await getClinicProfile(ctx, user._id);
    if (!clinic) {
      throw new ConvexError('Clinic profile not found');
    }

    const schedules = await ctx.db
      .query('schedules')
      .withIndex('by_clinicId', (q) => q.eq('clinicId', clinic._id))
      .take(200);
    for (const schedule of schedules) {
      await ctx.db.delete(schedule._id);
    }

    const exceptions = await ctx.db
      .query('scheduleExceptions')
      .withIndex('by_clinicId_and_exceptionDate', (q) => q.eq('clinicId', clinic._id))
      .take(200);
    for (const exception of exceptions) {
      await ctx.db.delete(exception._id);
    }

    const memberships = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_clinicId', (q) => q.eq('clinicId', clinic._id))
      .take(200);
    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_clinicId_and_appointmentDate_and_appointmentTime', (q) =>
        q.eq('clinicId', clinic._id),
      )
      .take(500);
    const today = todayString();
    for (const booking of bookings) {
      if (
        booking.appointmentDate >= today &&
        (booking.status === 'confirmed' ||
          booking.status === 'present' ||
          booking.status === 'in_room')
      ) {
        await ctx.db.patch(booking._id, {
          status: 'cancelled',
          cancelledBy: 'system',
          cancellationReason: 'تم حذف حساب العيادة',
          cancelledAt: Date.now(),
        });
      }
    }

    const settings = await ctx.db
      .query('clinicSettings')
      .withIndex('by_clinicId', (q) => q.eq('clinicId', clinic._id))
      .unique();
    if (settings) {
      await ctx.db.delete(settings._id);
    }

    await deleteUserNotificationsAndPushTokens(ctx, user._id);

    await ctx.db.delete(clinic._id);
    await ctx.db.delete(user._id);

    return { ok: true };
  },
});

export const deleteMyPatientAccount = mutation({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (user.role !== 'patient') {
      throw new ConvexError('Only patients can delete this account');
    }

    const patient = await getPatientProfile(ctx, user._id);
    if (!patient) {
      throw new ConvexError('Patient profile not found');
    }

    const bookings = await ctx.db
      .query('bookings')
      .withIndex('by_patientId', (q) => q.eq('patientId', patient._id))
      .take(500);
    for (const booking of bookings) {
      const reviews = await ctx.db
        .query('reviews')
        .withIndex('by_bookingId', (q) => q.eq('bookingId', booking._id))
        .take(20);
      for (const review of reviews) {
        await ctx.db.delete(review._id);
      }
      await ctx.db.delete(booking._id);
    }

    const favorites = await ctx.db
      .query('patientFavorites')
      .withIndex('by_patientId', (q) => q.eq('patientId', patient._id))
      .take(200);
    for (const favorite of favorites) {
      await ctx.db.delete(favorite._id);
    }

    await deleteUserNotificationsAndPushTokens(ctx, user._id);

    await ctx.db.delete(patient._id);
    await ctx.db.delete(user._id);

    return { ok: true };
  },
});

export const getLoginResolution = query({
  args: {
    role: roleValidator,
    phone: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getAuthedUser(ctx);
    const phone = args.phone.trim();

    if (user.role !== args.role) {
      return { ok: false, reason: 'role_mismatch' as const };
    }

    if (user.phone !== phone) {
      return { ok: false, reason: 'phone_display_mismatch' as const };
    }

    return {
      ok: true,
      redirectTo:
        user.role === 'patient'
          ? ('/(patient)' as const)
          : user.role === 'doctor'
            ? ('/(doctor)/dashboard' as const)
            : ('/(clinic)/dashboard' as const),
    };
  },
});

export const findAccountByIdentifier = query({
  args: {
    phone: v.string(),
    email: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.phone.trim()) {
      const phoneIdentity = buildPhoneIdentity(args.phone);
      const phoneUser = await ctx.db
        .query('users')
        .withIndex('by_phoneNormalized', (q) =>
          q.eq('phoneNormalized', phoneIdentity.phoneNormalized),
        )
        .unique();
      if (phoneUser) {
        return {
          exists: true,
          role: phoneUser.role,
          by: 'phone' as const,
          phoneLoginKey: phoneUser.phoneLoginKey,
        };
      }
    }

    const emailIdentity = normalizeOptionalEmail(args.email);
    if (!emailIdentity.emailNormalized) {
      return { exists: false };
    }

    const emailUser = await ctx.db
      .query('users')
      .withIndex('by_emailNormalized', (q) =>
        q.eq('emailNormalized', emailIdentity.emailNormalized),
      )
      .unique();

    if (!emailUser) {
      return { exists: false };
    }

    return {
      exists: true,
      role: emailUser.role,
      by: 'email' as const,
      phoneLoginKey: emailUser.phoneLoginKey,
    };
  },
});
