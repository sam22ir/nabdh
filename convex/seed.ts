import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Seeds reference data plus a deterministic demo dataset for local/dev use:
 * Algerian wilayas, medical specialties, selectable communes, public doctors,
 * clinics, schedules, a patient account, appointments, reviews, and favorites.
 *
 * Uses an upsert pattern (checks for existing records before inserting) so
 * it is safe to run multiple times without creating duplicates.
 */
export const seed = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // -----------------------------------------------------------------------
    // 1. Wilayas — all 58 Algerian wilayas with Arabic and French names
    // -----------------------------------------------------------------------
    const wilayas: Array<{ id: number; nameAr: string; nameFr: string }> = [
      { id: 1, nameAr: "أدرار", nameFr: "Adrar" },
      { id: 2, nameAr: "الشلف", nameFr: "Chlef" },
      { id: 3, nameAr: "الأغواط", nameFr: "Laghouat" },
      { id: 4, nameAr: "أم البواقي", nameFr: "Oum El Bouaghi" },
      { id: 5, nameAr: "باتنة", nameFr: "Batna" },
      { id: 6, nameAr: "بجاية", nameFr: "Béjaïa" },
      { id: 7, nameAr: "بسكرة", nameFr: "Biskra" },
      { id: 8, nameAr: "بشار", nameFr: "Béchar" },
      { id: 9, nameAr: "البليدة", nameFr: "Blida" },
      { id: 10, nameAr: "البويرة", nameFr: "Bouira" },
      { id: 11, nameAr: "تمنراست", nameFr: "Tamanrasset" },
      { id: 12, nameAr: "تبسة", nameFr: "Tébessa" },
      { id: 13, nameAr: "تلمسان", nameFr: "Tlemcen" },
      { id: 14, nameAr: "تيارت", nameFr: "Tiaret" },
      { id: 15, nameAr: "تيزي وزو", nameFr: "Tizi Ouzou" },
      { id: 16, nameAr: "الجزائر", nameFr: "Alger" },
      { id: 17, nameAr: "الجلفة", nameFr: "Djelfa" },
      { id: 18, nameAr: "جيجل", nameFr: "Jijel" },
      { id: 19, nameAr: "سطيف", nameFr: "Sétif" },
      { id: 20, nameAr: "سعيدة", nameFr: "Saïda" },
      { id: 21, nameAr: "سكيكدة", nameFr: "Skikda" },
      { id: 22, nameAr: "سيدي بلعباس", nameFr: "Sidi Bel Abbès" },
      { id: 23, nameAr: "عنابة", nameFr: "Annaba" },
      { id: 24, nameAr: "قالمة", nameFr: "Guelma" },
      { id: 25, nameAr: "قسنطينة", nameFr: "Constantine" },
      { id: 26, nameAr: "المدية", nameFr: "Médéa" },
      { id: 27, nameAr: "مستغانم", nameFr: "Mostaganem" },
      { id: 28, nameAr: "المسيلة", nameFr: "M'Sila" },
      { id: 29, nameAr: "معسكر", nameFr: "Mascara" },
      { id: 30, nameAr: "ورقلة", nameFr: "Ouargla" },
      { id: 31, nameAr: "وهران", nameFr: "Oran" },
      { id: 32, nameAr: "البيض", nameFr: "El Bayadh" },
      { id: 33, nameAr: "إليزي", nameFr: "Illizi" },
      { id: 34, nameAr: "برج بوعريريج", nameFr: "Bordj Bou Arréridj" },
      { id: 35, nameAr: "بومرداس", nameFr: "Boumerdès" },
      { id: 36, nameAr: "الطارف", nameFr: "El Tarf" },
      { id: 37, nameAr: "تندوف", nameFr: "Tindouf" },
      { id: 38, nameAr: "تيسمسيلت", nameFr: "Tissemsilt" },
      { id: 39, nameAr: "الوادي", nameFr: "El Oued" },
      { id: 40, nameAr: "خنشلة", nameFr: "Khenchela" },
      { id: 41, nameAr: "سوق أهراس", nameFr: "Souk Ahras" },
      { id: 42, nameAr: "تيبازة", nameFr: "Tipaza" },
      { id: 43, nameAr: "ميلة", nameFr: "Mila" },
      { id: 44, nameAr: "عين الدفلى", nameFr: "Aïn Defla" },
      { id: 45, nameAr: "النعامة", nameFr: "Naâma" },
      { id: 46, nameAr: "عين تموشنت", nameFr: "Aïn Témouchent" },
      { id: 47, nameAr: "غرداية", nameFr: "Ghardaïa" },
      { id: 48, nameAr: "غليزان", nameFr: "Relizane" },
      { id: 49, nameAr: "تيميمون", nameFr: "Timimoun" },
      { id: 50, nameAr: "برج باجي مختار", nameFr: "Bordj Badji Mokhtar" },
      { id: 51, nameAr: "أولاد جلال", nameFr: "Ouled Djellal" },
      { id: 52, nameAr: "بني عباس", nameFr: "Béni Abbès" },
      { id: 53, nameAr: "عين صالح", nameFr: "In Salah" },
      { id: 54, nameAr: "عين قزام", nameFr: "In Guezzam" },
      { id: 55, nameAr: "تقرت", nameFr: "Touggourt" },
      { id: 56, nameAr: "جانت", nameFr: "Djanet" },
      { id: 57, nameAr: "المغير", nameFr: "El Meghaier" },
      { id: 58, nameAr: "المنيعة", nameFr: "El Menia" },
    ];

    const wilayaIdMap = new Map<number, Id<"wilayas">>();

    for (const w of wilayas) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (ctx.db.query("wilayas") as any)
        .withIndex("by_wilaya_code")
        .filter((q: any) => q.eq(q.field("id"), w.id))
        .first();

      if (!existing) {
        const docId = await ctx.db.insert("wilayas", {
          id: w.id,
          nameAr: w.nameAr,
          nameFr: w.nameFr,
        });
        wilayaIdMap.set(w.id, docId);
      } else {
        wilayaIdMap.set(w.id, existing._id);
      }
    }

    // -----------------------------------------------------------------------
    // 2. Specialties — 44 medical specialties with Arabic, French, and icons
    // -----------------------------------------------------------------------
    const specialties: Array<{
      nameAr: string;
      nameFr: string;
      icon: string;
    }> = [
      { nameAr: "طب القلب", nameFr: "Cardiologie", icon: "❤️" },
      { nameAr: "الأمراض الجلدية", nameFr: "Dermatologie", icon: "🩹" },
      { nameAr: "طب الأطفال", nameFr: "Pédiatrie", icon: "👶" },
      { nameAr: "أمراض النساء", nameFr: "Gynécologie", icon: "🩺" },
      { nameAr: "جراحة العظام", nameFr: "Orthopédie", icon: "🦴" },
      { nameAr: "طب العيون", nameFr: "Ophtalmologie", icon: "👁️" },
      { nameAr: "الأنف والأذن والحنجرة", nameFr: "ORL", icon: "👂" },
      { nameAr: "طب الأعصاب", nameFr: "Neurologie", icon: "🧠" },
      { nameAr: "الطب النفسي", nameFr: "Psychiatrie", icon: "💚" },
      { nameAr: "أمراض الجهاز الهضمي", nameFr: "Gastro-entérologie", icon: "🫃" },
      { nameAr: "أمراض الصدر", nameFr: "Pneumologie", icon: "🫁" },
      { nameAr: "أمراض الكلى", nameFr: "Néphrologie", icon: "🫘" },
      { nameAr: "المسالك البولية", nameFr: "Urologie", icon: "⚕️" },
      { nameAr: "أمراض الغدد", nameFr: "Endocrinologie", icon: "🔬" },
      { nameAr: "أمراض المفاصل", nameFr: "Rhumatologie", icon: "🦿" },
      { nameAr: "أمراض الدم", nameFr: "Hématologie", icon: "🩸" },
      { nameAr: "علاج الأورام", nameFr: "Oncologie", icon: "🎗️" },
      { nameAr: "الجراحة العامة", nameFr: "Chirurgie générale", icon: "🩹" },
      { nameAr: "جراحة القلب", nameFr: "Chirurgie cardiaque", icon: "❤️‍🩹" },
      { nameAr: "التخدير", nameFr: "Anesthésiologie", icon: "💉" },
      { nameAr: "طب الطوارئ", nameFr: "Médecine d'urgence", icon: "🚑" },
      { nameAr: "الطب العام", nameFr: "Médecine générale", icon: "🩺" },
      { nameAr: "الطب الباطني", nameFr: "Médecine interne", icon: "🔬" },
      { nameAr: "الأشعة", nameFr: "Radiologie", icon: "📡" },
      { nameAr: "الطب الرياضي", nameFr: "Médecine du sport", icon: "🏃" },
      { nameAr: "طب العمل", nameFr: "Médecine du travail", icon: "👷" },
      { nameAr: "طب نفس الأطفال", nameFr: "Pédopsychiatrie", icon: "🧒" },
      { nameAr: "جراحة الأطفال", nameFr: "Chirurgie pédiatrique", icon: "🧸" },
      { nameAr: "الجراحة التجميلية", nameFr: "Chirurgie plastique", icon: "✨" },
      { nameAr: "جراحة الأعصاب", nameFr: "Neurochirurgie", icon: "🧠" },
      { nameAr: "الطب الفيزيائي", nameFr: "Médecine physique", icon: "♿" },
      { nameAr: "طب المسنين", nameFr: "Gériatrie", icon: "👴" },
      { nameAr: "أمراض الحساسية", nameFr: "Allergologie", icon: "🤧" },
      { nameAr: "الأمراض المعدية", nameFr: "Infectiologie", icon: "🦠" },
      { nameAr: "طب الفم", nameFr: "Stomatologie", icon: "🦷" },
      { nameAr: "جراحة الأسنان", nameFr: "Chirurgie dentaire", icon: "🦷" },
      { nameAr: "الطب الشرعي", nameFr: "Médecine légale", icon: "⚖️" },
      { nameAr: "علم الأدوية", nameFr: "Pharmacologie", icon: "💊" },
      { nameAr: "البيولوجيا الطبية", nameFr: "Biologie médicale", icon: "🧬" },
      { nameAr: "الطب النووي", nameFr: "Médecine nucléaire", icon: "☢️" },
      { nameAr: "جراحة الأوعية", nameFr: "Chirurgie vasculaire", icon: "🩸" },
      { nameAr: "أمراض السكري", nameFr: "Diabétologie", icon: "🍬" },
      { nameAr: "التغذية", nameFr: "Nutrition", icon: "🥗" },
      { nameAr: "الطب التجميلي", nameFr: "Médecine esthétique", icon: "💆" },
    ];

    const specialtyIdMap = new Map<string, Id<"specialties">>();

    for (const s of specialties) {
      const existing = await ctx.db
        .query("specialties")
        .filter((q) => q.eq(q.field("nameFr"), s.nameFr))
        .first();

      if (!existing) {
        const docId = await ctx.db.insert("specialties", {
          nameAr: s.nameAr,
          nameFr: s.nameFr,
          icon: s.icon,
        });
        specialtyIdMap.set(s.nameFr, docId);
      } else {
        specialtyIdMap.set(s.nameFr, existing._id);
      }
    }

    // -----------------------------------------------------------------------
    // 3. Communes — major communes for Algiers (wilaya 16) and Oran (wilaya 31)
    // -----------------------------------------------------------------------
    const algiersId = wilayaIdMap.get(16);
    const oranId = wilayaIdMap.get(31);

    if (algiersId) {
      const algiersCommunes: Array<{
        nameAr: string;
        nameFr: string;
      }> = [
        { nameAr: "سيدي امحمد", nameFr: "Sidi M'hamed" },
        { nameAr: "بلوزداد", nameFr: "Belouizdad" },
        { nameAr: "القصبة", nameFr: "Casbah" },
        { nameAr: "باب الوادي", nameFr: "Bab El Oued" },
        { nameAr: "بوزريعة", nameFr: "Bouzaréah" },
        { nameAr: "الحراش", nameFr: "El Harrach" },
        { nameAr: "براقي", nameFr: "Baraki" },
        { nameAr: "درارية", nameFr: "Draria" },
        { nameAr: "الشراقة", nameFr: "Chéraga" },
        { nameAr: "الدار البيضاء", nameFr: "Dar El Beida" },
        { nameAr: "الرويبة", nameFr: "Rouïba" },
        { nameAr: "باب الزوار", nameFr: "Bab Ezzouar" },
        { nameAr: "بئر مراد رايس", nameFr: "Bir Mourad Raïs" },
        { nameAr: "حسين داي", nameFr: "Hussein Dey" },
        { nameAr: "المحمدية", nameFr: "Mohammadia" },
      ];

      for (const c of algiersCommunes) {
        const existing = await ctx.db
          .query("communes")
          .withIndex("by_wilayaId", (q: any) => q.eq("wilayaId", algiersId as Id<"wilayas">))
          .filter((q) => q.eq(q.field("nameFr"), c.nameFr))
          .first();

        if (!existing) {
          await ctx.db.insert("communes", {
            wilayaId: algiersId,
            nameAr: c.nameAr,
            nameFr: c.nameFr,
          });
        }
      }
    }

    if (oranId) {
      const oranCommunes: Array<{
        nameAr: string;
        nameFr: string;
      }> = [
        { nameAr: "وهران", nameFr: "Oran" },
        { nameAr: "السانية", nameFr: "Es Senia" },
        { nameAr: "بئر الجير", nameFr: "Bir El Djir" },
        { nameAr: "بطيوة", nameFr: "Boutlélis" },
        { nameAr: "عين الترك", nameFr: "Aïn El Turk" },
        { nameAr: "المرسى الكبير", nameFr: "El Marsa" },
        { nameAr: "بوسفر", nameFr: "Bousfer" },
        { nameAr: "سيدي الشحمي", nameFr: "Sidi El Chahmi" },
        { nameAr: "حاسي بونيف", nameFr: "Hassi Bounif" },
        { nameAr: "حاسي بن عقبة", nameFr: "Hassi Ben Okba" },
      ];

      for (const c of oranCommunes) {
        const existing = await ctx.db
          .query("communes")
          .withIndex("by_wilayaId", (q: any) => q.eq("wilayaId", oranId as Id<"wilayas">))
          .filter((q) => q.eq(q.field("nameFr"), c.nameFr))
          .first();

        if (!existing) {
          await ctx.db.insert("communes", {
            wilayaId: oranId,
            nameAr: c.nameAr,
            nameFr: c.nameFr,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Commune fallback — make every wilaya selectable in registration.
    // The app can later replace these capital-only fallbacks with a full
    // licensed commune dataset without breaking existing references.
    // -----------------------------------------------------------------------
    for (const w of wilayas) {
      const wilayaId = wilayaIdMap.get(w.id);
      if (!wilayaId) continue;

      const existingCommune = await ctx.db
        .query("communes")
        .withIndex("by_wilayaId", (q) => q.eq("wilayaId", wilayaId))
        .first();

      if (!existingCommune) {
        await ctx.db.insert("communes", {
          wilayaId,
          nameAr: w.nameAr,
          nameFr: w.nameFr,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 5. Demo operational data — real app screens read this through Convex.
    // Keep this block deterministic and idempotent so it can be rerun safely.
    // -----------------------------------------------------------------------
    const requireWilaya = (code: number) => {
      const wilayaId = wilayaIdMap.get(code);
      if (!wilayaId) {
        throw new Error(`Missing seeded wilaya ${code}`);
      }
      return wilayaId;
    };

    const requireSpecialty = (nameFr: string) => {
      const specialtyId = specialtyIdMap.get(nameFr);
      if (!specialtyId) {
        throw new Error(`Missing seeded specialty ${nameFr}`);
      }
      return specialtyId;
    };

    async function getCommuneId(
      wilayaId: Id<"wilayas">,
      preferredNameFr: string,
    ) {
      const communes = await ctx.db
        .query("communes")
        .withIndex("by_wilayaId", (q) => q.eq("wilayaId", wilayaId))
        .collect();
      const commune =
        communes.find((c) => c.nameFr === preferredNameFr) ?? communes[0];
      if (!commune) {
        throw new Error(`Missing commune for wilaya ${wilayaId}`);
      }
      return commune._id;
    }

    type DemoUserInput = {
      email: string;
      name: string;
      fullNameAr: string;
      fullNameFr: string;
      phone: string;
      role: "patient" | "doctor";
      wilayaId: Id<"wilayas">;
    };

    async function upsertUser(data: DemoUserInput) {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", data.email))
        .unique();

      const userData = {
        email: data.email,
        emailVerificationTime: Date.parse("2026-01-01T08:00:00.000Z"),
        tokenIdentifier: `password:${data.email}`,
        name: data.name,
        fullNameAr: data.fullNameAr,
        fullNameFr: data.fullNameFr,
        phone: data.phone,
        phoneVerificationTime: Date.parse("2026-01-01T08:00:00.000Z"),
        role: data.role,
        wilayaId: data.wilayaId,
        isActive: true,
      };

      if (existing) {
        await ctx.db.patch(existing._id, userData);
        return existing._id;
      }

      return await ctx.db.insert("users", userData);
    }

    type DemoDoctorInput = {
      userId: Id<"users">;
      specialtyId: Id<"specialties">;
      subSpecialties: Array<Id<"specialties">>;
      bioAr: string;
      bioFr: string;
      yearsOfExperience: number;
      languages: string[];
      orderRegistrationNumber: string;
      consultationFee: number;
      followUpFee: number;
      avgRating: number;
      totalReviews: number;
    };

    async function upsertDoctor(data: DemoDoctorInput) {
      const existing = await ctx.db
        .query("doctors")
        .withIndex("by_userId", (q) => q.eq("userId", data.userId))
        .unique();

      const doctorData = {
        userId: data.userId,
        specialtyId: data.specialtyId,
        subSpecialties: data.subSpecialties,
        bioAr: data.bioAr,
        bioFr: data.bioFr,
        yearsOfExperience: data.yearsOfExperience,
        languages: data.languages,
        orderRegistrationNumber: data.orderRegistrationNumber,
        isVerified: true,
        isProfileComplete: true,
        consultationFee: data.consultationFee,
        followUpFee: data.followUpFee,
        avgRating: data.avgRating,
        totalReviews: data.totalReviews,
      };

      if (existing) {
        await ctx.db.patch(existing._id, doctorData);
        return existing._id;
      }

      return await ctx.db.insert("doctors", doctorData);
    }

    type DemoClinicInput = {
      doctorId: Id<"doctors">;
      name: string;
      wilayaId: Id<"wilayas">;
      communeId: Id<"communes">;
      address: string;
      latitude: number;
      longitude: number;
      phone: string;
    };

    async function upsertClinic(data: DemoClinicInput) {
      const clinics = await ctx.db
        .query("clinics")
        .withIndex("by_doctorId", (q) => q.eq("doctorId", data.doctorId))
        .collect();
      const existing = clinics.find((clinic) => clinic.name === data.name);

      const clinicData = {
        doctorId: data.doctorId,
        name: data.name,
        wilayaId: data.wilayaId,
        communeId: data.communeId,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        phone: data.phone,
        isActive: true,
      };

      if (existing) {
        await ctx.db.patch(existing._id, clinicData);
        return existing._id;
      }

      return await ctx.db.insert("clinics", clinicData);
    }

    type DemoScheduleInput = {
      clinicId: Id<"clinics">;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      appointmentDurationMinutes: number;
      maxPatientsPerDay: number;
    };

    async function upsertSchedule(data: DemoScheduleInput) {
      const existing = await ctx.db
        .query("schedules")
        .withIndex("by_clinicId_and_dayOfWeek", (q) =>
          q.eq("clinicId", data.clinicId).eq("dayOfWeek", data.dayOfWeek),
        )
        .first();

      const scheduleData = {
        clinicId: data.clinicId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        appointmentDurationMinutes: data.appointmentDurationMinutes,
        maxPatientsPerDay: data.maxPatientsPerDay,
        isActive: true,
      };

      if (existing) {
        await ctx.db.patch(existing._id, scheduleData);
        return existing._id;
      }

      return await ctx.db.insert("schedules", scheduleData);
    }

    async function upsertScheduleException(data: {
      clinicId: Id<"clinics">;
      exceptionDate: string;
      reason: string;
    }) {
      const existing = await ctx.db
        .query("scheduleExceptions")
        .withIndex("by_clinicId_and_date", (q) =>
          q.eq("clinicId", data.clinicId).eq("exceptionDate", data.exceptionDate),
        )
        .first();

      const exceptionData = {
        clinicId: data.clinicId,
        exceptionDate: data.exceptionDate,
        isClosed: true,
        reason: data.reason,
      };

      if (existing) {
        await ctx.db.patch(existing._id, exceptionData);
        return existing._id;
      }

      return await ctx.db.insert("scheduleExceptions", exceptionData);
    }

    async function upsertPatient(data: {
      userId: Id<"users">;
      dateOfBirth: string;
      gender: "male" | "female";
      communeId: Id<"communes">;
      bloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
      chronicDiseases: string[];
      allergies: string[];
      emergencyContactName: string;
      emergencyContactPhone: string;
    }) {
      const existing = await ctx.db
        .query("patients")
        .withIndex("by_userId", (q) => q.eq("userId", data.userId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
      }

      return await ctx.db.insert("patients", data);
    }

    async function upsertPatientProfile(data: {
      parentUserId: Id<"users">;
      fullNameAr: string;
      dateOfBirth: string;
      gender: "male" | "female";
      bloodType: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
      chronicDiseases: string[];
      allergies: string[];
    }) {
      const profiles = await ctx.db
        .query("patientProfiles")
        .withIndex("by_parentUserId", (q) => q.eq("parentUserId", data.parentUserId))
        .collect();
      const existing = profiles.find(
        (profile) => profile.fullNameAr === data.fullNameAr,
      );

      if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
      }

      return await ctx.db.insert("patientProfiles", data);
    }

    type DemoBookingInput = {
      patientId: Id<"patients">;
      doctorId: Id<"doctors">;
      clinicId: Id<"clinics">;
      profileId?: Id<"patientProfiles">;
      appointmentDate: string;
      appointmentTime: string;
      appointmentDuration: number;
      visitType: "first" | "followup" | "consultation";
      reason?: string;
      patientNote?: string;
      doctorNote?: string;
      status: "confirmed" | "cancelled" | "completed" | "no_show";
      confirmedAt?: number;
      completedAt?: number;
      cancelledBy?: "patient" | "doctor" | "system";
      cancellationReason?: string;
      cancelledAt?: number;
    };

    async function upsertBooking(data: DemoBookingInput) {
      const existing = await ctx.db
        .query("bookings")
        .withIndex("by_clinicId_and_date_and_time", (q) =>
          q
            .eq("clinicId", data.clinicId)
            .eq("appointmentDate", data.appointmentDate)
            .eq("appointmentTime", data.appointmentTime),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
      }

      return await ctx.db.insert("bookings", data);
    }

    async function upsertReview(data: {
      bookingId: Id<"bookings">;
      patientId: Id<"patients">;
      doctorId: Id<"doctors">;
      overallRating: number;
      punctualityRating: number;
      diagnosisRating: number;
      professionalismRating: number;
      cleanlinessRating: number;
      comment: string;
      isAnonymous: boolean;
      doctorReply?: string;
    }) {
      const existing = await ctx.db
        .query("reviews")
        .withIndex("by_bookingId", (q) => q.eq("bookingId", data.bookingId))
        .first();

      const reviewData = {
        ...data,
        isHidden: false,
      };

      if (existing) {
        await ctx.db.patch(existing._id, reviewData);
        return existing._id;
      }

      return await ctx.db.insert("reviews", reviewData);
    }

    async function upsertFavorite(
      patientId: Id<"patients">,
      doctorId: Id<"doctors">,
    ) {
      const existing = await ctx.db
        .query("patientFavorites")
        .withIndex("by_patientId_and_doctorId", (q) =>
          q.eq("patientId", patientId).eq("doctorId", doctorId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("patientFavorites", { patientId, doctorId });
      }
    }

    async function upsertNotification(data: {
      userId: Id<"users">;
      type: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
      isRead: boolean;
    }) {
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", data.userId))
        .collect();
      const existing = notifications.find(
        (notification) =>
          notification.type === data.type && notification.title === data.title,
      );

      if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
      }

      return await ctx.db.insert("notifications", data);
    }

    async function upsertPushToken(data: {
      userId: Id<"users">;
      token: string;
      platform: "android" | "ios";
    }) {
      const existing = await ctx.db
        .query("pushTokens")
        .withIndex("by_userId_and_token", (q) =>
          q.eq("userId", data.userId).eq("token", data.token),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, data);
        return existing._id;
      }

      return await ctx.db.insert("pushTokens", data);
    }

    const algerWilayaId = requireWilaya(16);
    const oranWilayaId = requireWilaya(31);
    const sidiMhamedId = await getCommuneId(algerWilayaId, "Sidi M'hamed");
    const babEzzouarId = await getCommuneId(algerWilayaId, "Bab Ezzouar");
    const cheragaId = await getCommuneId(algerWilayaId, "Chéraga");
    const oranCommuneId = await getCommuneId(oranWilayaId, "Oran");

    const cardiologyId = requireSpecialty("Cardiologie");
    const pediatricsId = requireSpecialty("Pédiatrie");
    const orthopedicId = requireSpecialty("Orthopédie");
    const internalMedicineId = requireSpecialty("Médecine interne");
    const diabetesId = requireSpecialty("Diabétologie");
    const generalMedicineId = requireSpecialty("Médecine générale");

    const aminaUserId = await upsertUser({
      email: "demo.doctor.amina@nabdh.test",
      name: "Dr Amina Benyoucef",
      fullNameAr: "د. أمينة بن يوسف",
      fullNameFr: "Dr Amina Benyoucef",
      phone: "0550 10 20 30",
      role: "doctor",
      wilayaId: algerWilayaId,
    });
    const aminaDoctorId = await upsertDoctor({
      userId: aminaUserId,
      specialtyId: cardiologyId,
      subSpecialties: [internalMedicineId, diabetesId],
      bioAr:
        "طبيبة قلب متخصصة في متابعة ضغط الدم، اضطرابات النبض، والوقاية القلبية.",
      bioFr:
        "Cardiologue spécialisée dans le suivi de l'hypertension, des troubles du rythme et de la prévention cardiovasculaire.",
      yearsOfExperience: 12,
      languages: ["ar", "fr"],
      orderRegistrationNumber: "DEMO-ORD-ALGER-001",
      consultationFee: 3500,
      followUpFee: 2200,
      avgRating: 4.8,
      totalReviews: 2,
    });

    const karimUserId = await upsertUser({
      email: "demo.doctor.karim@nabdh.test",
      name: "Dr Karim Mansouri",
      fullNameAr: "د. كريم منصوري",
      fullNameFr: "Dr Karim Mansouri",
      phone: "0551 40 50 60",
      role: "doctor",
      wilayaId: oranWilayaId,
    });
    const karimDoctorId = await upsertDoctor({
      userId: karimUserId,
      specialtyId: orthopedicId,
      subSpecialties: [generalMedicineId],
      bioAr: "جراح عظام يعالج إصابات المفاصل والركبة والكتف والكسور الرياضية.",
      bioFr:
        "Orthopédiste pour les pathologies articulaires, les blessures sportives et le suivi post-fracture.",
      yearsOfExperience: 9,
      languages: ["ar", "fr", "en"],
      orderRegistrationNumber: "DEMO-ORD-ORAN-002",
      consultationFee: 3000,
      followUpFee: 1800,
      avgRating: 4.6,
      totalReviews: 1,
    });

    const leilaUserId = await upsertUser({
      email: "demo.doctor.leila@nabdh.test",
      name: "Dr Leila Haddad",
      fullNameAr: "د. ليلى حداد",
      fullNameFr: "Dr Leila Haddad",
      phone: "0552 70 80 90",
      role: "doctor",
      wilayaId: algerWilayaId,
    });
    const leilaDoctorId = await upsertDoctor({
      userId: leilaUserId,
      specialtyId: pediatricsId,
      subSpecialties: [generalMedicineId],
      bioAr: "طبيبة أطفال تتابع نمو الطفل، اللقاحات، والحالات التنفسية الشائعة.",
      bioFr:
        "Pédiatre assurant le suivi de croissance, les vaccins et les pathologies respiratoires courantes.",
      yearsOfExperience: 15,
      languages: ["ar", "fr"],
      orderRegistrationNumber: "DEMO-ORD-ALGER-003",
      consultationFee: 2800,
      followUpFee: 1600,
      avgRating: 4.9,
      totalReviews: 2,
    });

    const aminaMainClinicId = await upsertClinic({
      doctorId: aminaDoctorId,
      name: "Cabinet Cardio Didouche",
      wilayaId: algerWilayaId,
      communeId: sidiMhamedId,
      address: "24 Rue Didouche Mourad, Alger Centre",
      latitude: 36.7661,
      longitude: 3.0506,
      phone: "021 63 12 45",
    });
    const aminaWestClinicId = await upsertClinic({
      doctorId: aminaDoctorId,
      name: "Clinique Cardio Chéraga",
      wilayaId: algerWilayaId,
      communeId: cheragaId,
      address: "Lotissement Les Dunes, Chéraga",
      latitude: 36.7677,
      longitude: 2.9592,
      phone: "021 37 44 88",
    });
    const karimClinicId = await upsertClinic({
      doctorId: karimDoctorId,
      name: "Clinique Orthopédie Oran",
      wilayaId: oranWilayaId,
      communeId: oranCommuneId,
      address: "12 Boulevard Emir Abdelkader, Oran",
      latitude: 35.6971,
      longitude: -0.6337,
      phone: "041 33 20 10",
    });
    const leilaClinicId = await upsertClinic({
      doctorId: leilaDoctorId,
      name: "Cabinet Pédiatrie Bab Ezzouar",
      wilayaId: algerWilayaId,
      communeId: babEzzouarId,
      address: "Cité 5 Juillet, Bab Ezzouar",
      latitude: 36.7169,
      longitude: 3.1849,
      phone: "023 92 18 77",
    });

    const scheduleGroups: DemoScheduleInput[] = [
      {
        clinicId: aminaMainClinicId,
        dayOfWeek: 0,
        startTime: "09:00",
        endTime: "13:00",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 8,
      },
      {
        clinicId: aminaMainClinicId,
        dayOfWeek: 2,
        startTime: "14:00",
        endTime: "18:00",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 8,
      },
      {
        clinicId: aminaWestClinicId,
        dayOfWeek: 4,
        startTime: "10:00",
        endTime: "15:00",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 10,
      },
      {
        clinicId: karimClinicId,
        dayOfWeek: 1,
        startTime: "08:30",
        endTime: "13:30",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 10,
      },
      {
        clinicId: karimClinicId,
        dayOfWeek: 3,
        startTime: "15:00",
        endTime: "19:00",
        appointmentDurationMinutes: 30,
        maxPatientsPerDay: 8,
      },
      {
        clinicId: leilaClinicId,
        dayOfWeek: 0,
        startTime: "08:30",
        endTime: "12:30",
        appointmentDurationMinutes: 20,
        maxPatientsPerDay: 12,
      },
      {
        clinicId: leilaClinicId,
        dayOfWeek: 2,
        startTime: "13:30",
        endTime: "17:30",
        appointmentDurationMinutes: 20,
        maxPatientsPerDay: 12,
      },
    ];
    for (const schedule of scheduleGroups) {
      await upsertSchedule(schedule);
    }
    await upsertScheduleException({
      clinicId: aminaMainClinicId,
      exceptionDate: "2099-01-01",
      reason: "Jour férié",
    });

    const patientUserId = await upsertUser({
      email: "demo.patient@nabdh.test",
      name: "Sara Benali",
      fullNameAr: "سارة بن علي",
      fullNameFr: "Sara Benali",
      phone: "0555 12 34 56",
      role: "patient",
      wilayaId: algerWilayaId,
    });
    const patientId = await upsertPatient({
      userId: patientUserId,
      dateOfBirth: "1992-05-12",
      gender: "female",
      communeId: sidiMhamedId,
      bloodType: "O+",
      chronicDiseases: ["Hypertension légère"],
      allergies: ["Pénicilline"],
      emergencyContactName: "Nadir Benali",
      emergencyContactPhone: "0666 20 30 40",
    });
    const childProfileId = await upsertPatientProfile({
      parentUserId: patientUserId,
      fullNameAr: "آدم بن علي",
      dateOfBirth: "2018-09-21",
      gender: "male",
      bloodType: "A+",
      chronicDiseases: [],
      allergies: ["Pollen"],
    });

    const completedAt = Date.parse("2026-01-15T10:30:00.000Z");
    const confirmedAt = Date.parse("2026-01-01T08:00:00.000Z");
    const leilaCompletedBookingId = await upsertBooking({
      patientId,
      doctorId: leilaDoctorId,
      clinicId: leilaClinicId,
      profileId: childProfileId,
      appointmentDate: "2026-01-15",
      appointmentTime: "09:40",
      appointmentDuration: 20,
      visitType: "consultation",
      reason: "Suivi pédiatrique",
      patientNote: "Toux nocturne depuis trois jours",
      doctorNote: "Evolution favorable, hydratation et contrôle si fièvre.",
      status: "completed",
      confirmedAt,
      completedAt,
    });
    const aminaCompletedBookingId = await upsertBooking({
      patientId,
      doctorId: aminaDoctorId,
      clinicId: aminaMainClinicId,
      appointmentDate: "2026-02-20",
      appointmentTime: "10:30",
      appointmentDuration: 30,
      visitType: "followup",
      reason: "Contrôle tension artérielle",
      patientNote: "Apporter le carnet de tension",
      doctorNote: "Traitement bien toléré.",
      status: "completed",
      confirmedAt,
      completedAt: Date.parse("2026-02-20T11:00:00.000Z"),
    });
    await upsertBooking({
      patientId,
      doctorId: aminaDoctorId,
      clinicId: aminaMainClinicId,
      appointmentDate: "2099-01-04",
      appointmentTime: "09:00",
      appointmentDuration: 30,
      visitType: "first",
      reason: "Palpitations occasionnelles",
      patientNote: "Première consultation cardiologie",
      status: "confirmed",
      confirmedAt,
    });
    await upsertBooking({
      patientId,
      doctorId: karimDoctorId,
      clinicId: karimClinicId,
      profileId: childProfileId,
      appointmentDate: "2099-01-05",
      appointmentTime: "10:30",
      appointmentDuration: 30,
      visitType: "consultation",
      reason: "Douleur genou après sport",
      status: "confirmed",
      confirmedAt,
    });

    await upsertReview({
      bookingId: leilaCompletedBookingId,
      patientId,
      doctorId: leilaDoctorId,
      overallRating: 5,
      punctualityRating: 5,
      diagnosisRating: 5,
      professionalismRating: 5,
      cleanlinessRating: 5,
      comment: "طبيبة ممتازة وشرحت العلاج بوضوح.",
      isAnonymous: false,
      doctorReply: "Merci pour votre confiance.",
    });
    await upsertReview({
      bookingId: aminaCompletedBookingId,
      patientId,
      doctorId: aminaDoctorId,
      overallRating: 5,
      punctualityRating: 4,
      diagnosisRating: 5,
      professionalismRating: 5,
      cleanlinessRating: 5,
      comment: "Suivi sérieux et rendez-vous très clair.",
      isAnonymous: false,
    });

    await upsertFavorite(patientId, leilaDoctorId);
    await upsertFavorite(patientId, aminaDoctorId);
    await upsertNotification({
      userId: patientUserId,
      type: "appointment_reminder",
      title: "تذكير بالموعد",
      body: "لديك موعد مؤكد يوم 2099-01-04 على الساعة 09:00.",
      data: {
        doctorId: aminaDoctorId,
        clinicId: aminaMainClinicId,
        appointmentDate: "2099-01-04",
      },
      isRead: false,
    });
    await upsertNotification({
      userId: aminaUserId,
      type: "new_booking",
      title: "Nouvelle réservation démo",
      body: "Sara Benali a une réservation de démonstration confirmée.",
      data: {
        patientId,
        clinicId: aminaMainClinicId,
        appointmentDate: "2099-01-04",
      },
      isRead: true,
    });
    await upsertPushToken({
      userId: patientUserId,
      token: "ExponentPushToken[demo-patient-token]",
      platform: "android",
    });

    return null;
  },
});
