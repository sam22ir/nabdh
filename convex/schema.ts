import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // -------------------------------------------------
  // Auth tables from @convex-dev/auth — stores
  // sessions, accounts, verification codes, and the
  // base user record created at sign-up.
  // -------------------------------------------------
  ...authTables,

  // -------------------------------------------------
  // users — extends the Convex Auth base record with
  // Nabdh-specific fields (bilingual names, role,
  // wilaya, avatar, active flag).
  // -------------------------------------------------
  users: defineTable({
    // Auth-managed fields (must be present for
    // @convex-dev/auth to work correctly).
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Nabdh-specific fields
    tokenIdentifier: v.optional(v.string()),
    fullNameAr: v.optional(v.string()),
    fullNameFr: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    role: v.optional(
      v.union(
        v.literal("patient"),
        v.literal("doctor"),
        v.literal("clinic_admin"),
        v.literal("super_admin"),
      ),
    ),
    wilayaId: v.optional(v.id("wilayas")),
    avatarUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("tokenIdentifier", ["tokenIdentifier"])
    .index("by_role", ["role"]),

  // -------------------------------------------------
  // patients — each Patient gets one record here,
  // linked to their users entry via userId.
  // Only users with role="patient" should have one.
  // -------------------------------------------------
  patients: defineTable({
    userId: v.id("users"),
    dateOfBirth: v.string(),
    gender: v.union(v.literal("male"), v.literal("female")),
    communeId: v.id("communes"),
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
  }).index("by_userId", ["userId"]),

  // -------------------------------------------------
  // doctors — one record per doctor, linked to users
  // via userId. Verified doctors have isVerified=true
  // (set after manual credential check).
  // -------------------------------------------------
  doctors: defineTable({
    userId: v.id("users"),
    specialtyId: v.id("specialties"),
    subSpecialties: v.array(v.id("specialties")),
    bioAr: v.string(),
    bioFr: v.string(),
    yearsOfExperience: v.number(),
    languages: v.array(v.string()),
    orderRegistrationNumber: v.string(),
    isVerified: v.boolean(),
    isProfileComplete: v.boolean(),
    consultationFee: v.number(),
    followUpFee: v.number(),
    avgRating: v.number(),
    totalReviews: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_specialty", ["specialtyId"])
    .index("by_isProfileComplete", ["isProfileComplete"])
    .index("by_verified", ["isVerified"]),

  // -------------------------------------------------
  // patientProfiles — family sub-profiles under a
  // Patient's account (spouse, child, parent).
  // Each profile carries its own name and medical
  // info so the Patient can book on their behalf.
  // -------------------------------------------------
  patientProfiles: defineTable({
    parentUserId: v.id("users"),
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
  }).index("by_parentUserId", ["parentUserId"]),

  // -------------------------------------------------
  // clinics — physical locations where a Doctor sees
  // patients. A Doctor can work at multiple clinics.
  // -------------------------------------------------
  clinics: defineTable({
    doctorId: v.id("doctors"),
    name: v.string(),
    wilayaId: v.id("wilayas"),
    communeId: v.id("communes"),
    address: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    phone: v.string(),
    isActive: v.boolean(),
  })
    .index("by_doctorId", ["doctorId"])
    .index("by_wilaya", ["wilayaId"]),

  // -------------------------------------------------
  // schedules — recurring weekly patterns for a
  // clinic. dayOfWeek uses 0=Sunday (Algerian week
  // starts Sunday).
  // -------------------------------------------------
  schedules: defineTable({
    clinicId: v.id("clinics"),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    appointmentDurationMinutes: v.number(),
    maxPatientsPerDay: v.number(),
    isActive: v.boolean(),
  })
    .index("by_clinicId", ["clinicId"])
    .index("by_clinicId_and_dayOfWeek", ["clinicId", "dayOfWeek"]),

  // -------------------------------------------------
  // scheduleExceptions — one-off overrides to the
  // recurring schedule (holidays, sick days, custom
  // hours). isClosed=true means the clinic is fully
  // closed on that date.
  // -------------------------------------------------
  scheduleExceptions: defineTable({
    clinicId: v.id("clinics"),
    exceptionDate: v.string(),
    isClosed: v.boolean(),
    customStartTime: v.optional(v.string()),
    customEndTime: v.optional(v.string()),
    reason: v.string(),
  }).index("by_clinicId_and_date", ["clinicId", "exceptionDate"]),

  // -------------------------------------------------
  // bookings — the core Appointment record. Status
  // lifecycle: confirmed -> completed / cancelled / no_show.
  // The compound index on (clinicId, appointmentDate,
  // appointmentTime) is CRITICAL for slot-conflict
  // detection when a patient tries to book.
  // -------------------------------------------------
  bookings: defineTable({
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
      v.union(
        v.literal("patient"),
        v.literal("doctor"),
        v.literal("system"),
      ),
    ),
    cancellationReason: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_patientId", ["patientId"])
    .index("by_doctorId_and_date", ["doctorId", "appointmentDate"])
    .index("by_clinicId_and_date_and_time", [
      "clinicId",
      "appointmentDate",
      "appointmentTime",
    ]),

  // -------------------------------------------------
  // reviews — 5-star rating with four sub-dimensions,
  // left by a patient after a completed appointment.
  // Doctors can reply once (doctorReply).
  // -------------------------------------------------
  reviews: defineTable({
    bookingId: v.id("bookings"),
    patientId: v.id("patients"),
    doctorId: v.id("doctors"),
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
    .index("by_doctorId", ["doctorId"])
    .index("by_doctorId_and_isHidden", ["doctorId", "isHidden"])
    .index("by_bookingId", ["bookingId"]),

  // -------------------------------------------------
  // specialties — medical specialties (e.g.
  // Cardiologie / طب القلب). Supports hierarchy via
  // parentId (e.g. Chirurgie -> Chirurgie cardiaque).
  // -------------------------------------------------
  specialties: defineTable({
    nameAr: v.string(),
    nameFr: v.string(),
    icon: v.string(),
    parentId: v.optional(v.id("specialties")),
  })
    .index("by_parentId", ["parentId"])
    .searchIndex("search_nameFr", { searchField: "nameFr" })
    .searchIndex("search_nameAr", { searchField: "nameAr" }),

  // -------------------------------------------------
  // wilayas — Algerian administrative divisions
  // (1-58). The `id` field stores the official wilaya
  // code, NOT the Convex document _id.
  // -------------------------------------------------
  wilayas: defineTable({
    id: v.number(),
    nameAr: v.string(),
    nameFr: v.string(),
  }).index("by_wilaya_code", ["id"]),

  // -------------------------------------------------
  // communes — municipalities within a wilaya.
  // wilayaId references the wilaya document (not the
  // numerical code).
  // -------------------------------------------------
  communes: defineTable({
    wilayaId: v.id("wilayas"),
    nameAr: v.string(),
    nameFr: v.string(),
  }).index("by_wilayaId", ["wilayaId"]),

  // -------------------------------------------------
  // notifications — push notification metadata stored
  // per-user. `data` carries arbitrary payload for the
  // client to handle (e.g. deep-link params).
  // -------------------------------------------------
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    isRead: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_read", ["userId", "isRead"]),

  // -------------------------------------------------
  // pushTokens — Expo push tokens per user, used for
  // sending push notifications.
  // -------------------------------------------------
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("android"), v.literal("ios")),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"])
    .index("by_userId_and_token", ["userId", "token"]),

  // -------------------------------------------------
  // doctorSettings — account-level operational
  // preferences for doctor notification and booking
  // policy controls.
  // -------------------------------------------------
  doctorSettings: defineTable({
    doctorId: v.id("doctors"),
    userId: v.id("users"),
    newBookingAlerts: v.boolean(),
    cancellationAlerts: v.boolean(),
    dailySummary: v.boolean(),
    minCancelHours: v.number(),
    updatedAt: v.number(),
  })
    .index("by_doctorId", ["doctorId"])
    .index("by_userId", ["userId"]),

  // -------------------------------------------------
  // patientFavorites — bookmarking of doctors by
  // patients for quick access.
  // -------------------------------------------------
  patientFavorites: defineTable({
    patientId: v.id("patients"),
    doctorId: v.id("doctors"),
  })
    .index("by_patientId", ["patientId"])
    .index("by_patientId_and_doctorId", ["patientId", "doctorId"]),
});
