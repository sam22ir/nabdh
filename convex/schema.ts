import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    fullName: v.string(),
    gender: v.optional(v.union(v.literal('male'), v.literal('female'))),
    role: v.union(v.literal('patient'), v.literal('doctor'), v.literal('clinic')),
    phone: v.string(),
    phoneNormalized: v.string(),
    phoneLoginKey: v.string(),
    email: v.optional(v.string()),
    emailNormalized: v.optional(v.string()),
    isActive: v.boolean(),
    termsVersion: v.optional(v.string()),
    privacyVersion: v.optional(v.string()),
    legalAcceptedAt: v.optional(v.number()),
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_phoneNormalized', ['phoneNormalized'])
    .index('by_phoneLoginKey', ['phoneLoginKey'])
    .index('by_emailNormalized', ['emailNormalized'])
    .index('by_role', ['role']),

  patients: defineTable({
    userId: v.id('users'),
    chronicDiseases: v.array(v.string()),
    allergies: v.array(v.string()),
  }).index('by_userId', ['userId']),

  doctors: defineTable({
    userId: v.id('users'),
    specialtyId: v.id('specialties'),
    // Optional during the rollout so existing doctor records remain valid.
    wilayaId: v.optional(v.id('wilayas')),
    bio: v.string(),
    yearsOfExperience: v.number(),
    consultationFee: v.optional(v.number()),
    followUpFee: v.optional(v.number()),
    avgRating: v.number(),
    totalReviews: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_specialtyId', ['specialtyId'])
    .index('by_wilayaId', ['wilayaId']),

  clinics: defineTable({
    // Deprecated for legacy doctor-owned clinic rows. New clinic accounts use
    // ownerUserId and doctor access is represented by clinicMemberships.
    doctorId: v.optional(v.id('doctors')),
    ownerUserId: v.optional(v.id('users')),
    name: v.string(),
    wilayaId: v.id('wilayas'),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    mapUrl: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    emailNormalized: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index('by_doctorId', ['doctorId'])
    .index('by_ownerUserId', ['ownerUserId'])
    .index('by_wilayaId', ['wilayaId']),

  clinicMemberships: defineTable({
    clinicId: v.id('clinics'),
    doctorId: v.id('doctors'),
    requestedBy: v.union(v.literal('doctor'), v.literal('clinic')),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('rejected'),
      v.literal('cancelled'),
      v.literal('ended'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    acceptedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    endedBy: v.optional(v.union(v.literal('doctor'), v.literal('clinic'))),
    endReason: v.optional(v.string()),
  })
    .index('by_clinicId', ['clinicId'])
    .index('by_doctorId', ['doctorId'])
    .index('by_clinicId_and_status', ['clinicId', 'status'])
    .index('by_doctorId_and_status', ['doctorId', 'status'])
    .index('by_clinicId_and_doctorId', ['clinicId', 'doctorId']),

  schedules: defineTable({
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    appointmentDurationMinutes: v.number(),
    maxPatientsPerDay: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index('by_clinicId', ['clinicId'])
    .index('by_clinicId_and_dayOfWeek', ['clinicId', 'dayOfWeek'])
    .index('by_clinicId_and_doctorId', ['clinicId', 'doctorId'])
    .index('by_clinicId_and_doctorId_and_dayOfWeek', [
      'clinicId',
      'doctorId',
      'dayOfWeek',
    ]),

  scheduleExceptions: defineTable({
    clinicId: v.id('clinics'),
    doctorId: v.optional(v.id('doctors')),
    exceptionDate: v.string(),
    endDate: v.optional(v.string()),
    reason: v.string(),
    exceptionType: v.optional(
      v.union(
        v.literal('single_hour'),
        v.literal('time_range'),
        v.literal('full_day'),
        v.literal('multi_day'),
      ),
    ),
    isClosed: v.optional(v.boolean()),
    customStartTime: v.optional(v.string()),
    customEndTime: v.optional(v.string()),
  })
    .index('by_clinicId', ['clinicId'])
    .index('by_clinicId_and_exceptionDate', ['clinicId', 'exceptionDate'])
    .index('by_clinicId_and_doctorId_and_exceptionDate', [
      'clinicId',
      'doctorId',
      'exceptionDate',
    ]),

  bookings: defineTable({
    patientId: v.id('patients'),
    doctorId: v.id('doctors'),
    clinicId: v.id('clinics'),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
    appointmentDuration: v.number(),
    visitType: v.union(
      v.literal('first'),
      v.literal('followup'),
      v.literal('consultation'),
    ),
    reason: v.optional(v.string()),
    patientNote: v.optional(v.string()),
    doctorNote: v.optional(v.string()),
    status: v.union(
      v.literal('confirmed'),
      v.literal('present'),
      v.literal('in_room'),
      v.literal('cancelled'),
      v.literal('completed'),
      v.literal('no_show'),
    ),
    cancelledBy: v.optional(
      v.union(
        v.literal('patient'),
        v.literal('doctor'),
        v.literal('clinic'),
        v.literal('system'),
      ),
    ),
    cancellationReason: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    presentAt: v.optional(v.number()),
    inRoomAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    noShowAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index('by_patientId', ['patientId'])
    .index('by_doctorId_and_appointmentDate', ['doctorId', 'appointmentDate'])
    .index('by_clinicId_and_appointmentDate_and_appointmentTime', [
      'clinicId',
      'appointmentDate',
      'appointmentTime',
    ])
    .index('by_clinicId_and_doctorId_and_appointmentDate_and_appointmentTime', [
      'clinicId',
      'doctorId',
      'appointmentDate',
      'appointmentTime',
    ]),

  encounterNotes: defineTable({
    bookingId: v.id('bookings'),
    patientId: v.id('patients'),
    doctorId: v.id('doctors'),
    clinicId: v.id('clinics'),
    authorUserId: v.id('users'),
    authorRole: v.union(v.literal('doctor'), v.literal('clinic')),
    authorName: v.string(),
    visibility: v.union(
      v.literal('doctor_private'),
      v.literal('care_team'),
      v.literal('patient_visible'),
    ),
    content: v.string(),
    createdAt: v.number(),
  })
    .index('by_bookingId_and_createdAt', ['bookingId', 'createdAt'])
    .index('by_doctorId_and_createdAt', ['doctorId', 'createdAt'])
    .index('by_clinicId_and_createdAt', ['clinicId', 'createdAt']),

  reviews: defineTable({
    bookingId: v.id('bookings'),
    patientId: v.id('patients'),
    doctorId: v.id('doctors'),
    overallRating: v.number(),
    punctualityRating: v.number(),
    diagnosisRating: v.number(),
    professionalismRating: v.number(),
    cleanlinessRating: v.number(),
    comment: v.optional(v.string()),
    isAnonymous: v.boolean(),
    isHidden: v.boolean(),
    doctorReply: v.optional(v.string()),
  })
    .index('by_doctorId', ['doctorId'])
    .index('by_doctorId_and_isHidden', ['doctorId', 'isHidden'])
    .index('by_bookingId', ['bookingId']),

  specialties: defineTable({
    name: v.string(),
    icon: v.string(),
    parentId: v.optional(v.id('specialties')),
  })
    .index('by_parentId', ['parentId'])
    .searchIndex('search_name', { searchField: 'name' }),

  wilayas: defineTable({
    id: v.number(),
    name: v.string(),
  }).index('by_wilaya_code', ['id']),

  communes: defineTable({
    wilayaId: v.id('wilayas'),
    name: v.string(),
  }).index('by_wilayaId', ['wilayaId']),

  notifications: defineTable({
    userId: v.id('users'),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    isRead: v.boolean(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_isRead', ['userId', 'isRead']),

  pushTokens: defineTable({
    userId: v.id('users'),
    token: v.string(),
    platform: v.union(v.literal('android'), v.literal('ios')),
  })
    .index('by_userId', ['userId'])
    .index('by_token', ['token'])
    .index('by_userId_and_token', ['userId', 'token']),

  doctorSettings: defineTable({
    userId: v.id('users'),
    doctorId: v.optional(v.id('doctors')),
    newBookingAlerts: v.boolean(),
    cancellationAlerts: v.boolean(),
    dailySummary: v.boolean(),
    minCancelHours: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  clinicSettings: defineTable({
    userId: v.id('users'),
    clinicId: v.optional(v.id('clinics')),
    autoCompleteAppointments: v.boolean(),
    newBookingAlerts: v.optional(v.boolean()),
    cancellationAlerts: v.optional(v.boolean()),
    dailySummary: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_clinicId', ['clinicId']),

  patientFavorites: defineTable({
    patientId: v.id('patients'),
    doctorId: v.id('doctors'),
  })
    .index('by_patientId', ['patientId'])
    .index('by_doctorId', ['doctorId'])
    .index('by_patientId_and_doctorId', ['patientId', 'doctorId']),
});
