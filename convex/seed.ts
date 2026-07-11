import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';

const specialties = [
  { name: 'طب عام', icon: 'stethoscope' },
  { name: 'طب القلب', icon: 'heart-pulse' },
  { name: 'الأمراض الجلدية', icon: 'sparkles' },
  { name: 'طب الأطفال', icon: 'baby' },
  { name: 'طب العيون', icon: 'eye' },
  { name: 'التشريح المرضي', icon: 'microscope' },
  { name: 'جراحة الوجه والفكين', icon: 'scan-face' },
  { name: 'جراحة الصدر', icon: 'lungs' },
  { name: 'علم الأوبئة والطب الوقائي', icon: 'shield-plus' },
  { name: 'علم المناعة', icon: 'shield-check' },
  { name: 'الأحياء الدقيقة الطبية', icon: 'microscope' },
  { name: 'علم الطفيليات', icon: 'bug' },
  { name: 'الكيمياء الحيوية الطبية', icon: 'flask-conical' },
  { name: 'الإنعاش الطبي', icon: 'activity' },
  { name: 'علاج الأورام بالإشعاع', icon: 'radiation' },
  { name: 'طب حديثي الولادة', icon: 'baby' },
  { name: 'طب الألم', icon: 'heart-pulse' },
];

const wilayas: Array<{ id: number; name: string; communes?: string[] }> = [
  { id: 1, name: 'أدرار' },
  { id: 2, name: 'الشلف' },
  { id: 3, name: 'الأغواط' },
  { id: 4, name: 'أم البواقي' },
  { id: 5, name: 'باتنة' },
  { id: 6, name: 'بجاية' },
  { id: 7, name: 'بسكرة' },
  { id: 8, name: 'بشار' },
  { id: 9, name: 'البليدة' },
  { id: 10, name: 'البويرة' },
  { id: 11, name: 'تمنراست' },
  { id: 12, name: 'تبسة' },
  { id: 13, name: 'تلمسان' },
  { id: 14, name: 'تيارت' },
  { id: 15, name: 'تيزي وزو' },
  { id: 16, name: 'الجزائر', communes: ['الجزائر الوسطى', 'باب الوادي', 'حيدرة'] },
  { id: 17, name: 'الجلفة' },
  { id: 18, name: 'جيجل' },
  { id: 19, name: 'سطيف' },
  { id: 20, name: 'سعيدة' },
  { id: 21, name: 'سكيكدة' },
  { id: 22, name: 'سيدي بلعباس' },
  { id: 23, name: 'عنابة' },
  { id: 24, name: 'قالمة' },
  { id: 25, name: 'قسنطينة', communes: ['قسنطينة', 'الخروب', 'عين سمارة'] },
  { id: 26, name: 'المدية' },
  { id: 27, name: 'مستغانم' },
  { id: 28, name: 'المسيلة' },
  { id: 29, name: 'معسكر' },
  { id: 30, name: 'ورقلة' },
  { id: 31, name: 'وهران', communes: ['وهران', 'السانية', 'بئر الجير'] },
  { id: 32, name: 'البيض' },
  { id: 33, name: 'إليزي' },
  { id: 34, name: 'برج بوعريريج' },
  { id: 35, name: 'بومرداس' },
  { id: 36, name: 'الطارف' },
  { id: 37, name: 'تندوف' },
  { id: 38, name: 'تيسمسيلت' },
  { id: 39, name: 'الوادي' },
  { id: 40, name: 'خنشلة' },
  { id: 41, name: 'سوق أهراس' },
  { id: 42, name: 'تيبازة' },
  { id: 43, name: 'ميلة' },
  { id: 44, name: 'عين الدفلى' },
  { id: 45, name: 'النعامة' },
  { id: 46, name: 'عين تموشنت' },
  { id: 47, name: 'غرداية' },
  { id: 48, name: 'غليزان' },
  { id: 49, name: 'تيميمون' },
  { id: 50, name: 'برج باجي مختار' },
  { id: 51, name: 'أولاد جلال' },
  { id: 52, name: 'بني عباس' },
  { id: 53, name: 'عين صالح' },
  { id: 54, name: 'عين قزام' },
  { id: 55, name: 'تقرت' },
  { id: 56, name: 'جانت' },
  { id: 57, name: 'المغير' },
  { id: 58, name: 'المنيعة' },
  { id: 59, name: 'أفلو' },
  { id: 60, name: 'الأبيض سيدي الشيخ' },
  { id: 61, name: 'العريشة' },
  { id: 62, name: 'القنطرة' },
  { id: 63, name: 'بريكة' },
  { id: 64, name: 'بوسعادة' },
  { id: 65, name: 'بئر العاتر' },
  { id: 66, name: 'قصر البخاري' },
  { id: 67, name: 'قصر الشلالة' },
  { id: 68, name: 'عين وسارة' },
  { id: 69, name: 'مسعد' },
];

function normalizeSpecialtyName(value: string) {
  return value
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .split(/\s+/)
    .map((word) => word.replace(/^ال/, ''))
    .join(' ');
}

export const seedReferenceData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingSpecialties = await ctx.db.query('specialties').take(100);
    const specialtyNames = new Set(
      existingSpecialties.map((specialty) =>
        normalizeSpecialtyName(specialty.name),
      ),
    );

    for (const specialty of specialties) {
      const normalizedName = normalizeSpecialtyName(specialty.name);
      if (!specialtyNames.has(normalizedName)) {
        await ctx.db.insert('specialties', specialty);
        specialtyNames.add(normalizedName);
      }
    }

    for (const wilaya of wilayas) {
      let wilayaDoc = await ctx.db
        .query('wilayas')
        .withIndex('by_wilaya_code', (q) => q.eq('id', wilaya.id))
        .unique();
      if (!wilayaDoc) {
        const wilayaId = await ctx.db.insert('wilayas', {
          id: wilaya.id,
          name: wilaya.name,
        });
        wilayaDoc = await ctx.db.get(wilayaId);
      }
      if (!wilayaDoc) continue;

      for (const commune of wilaya.communes ?? []) {
        const existingCommunes = await ctx.db
          .query('communes')
          .withIndex('by_wilayaId', (q) => q.eq('wilayaId', wilayaDoc!._id))
          .take(100);
        if (!existingCommunes.some((row) => row.name === commune)) {
          await ctx.db.insert('communes', {
            wilayaId: wilayaDoc._id,
            name: commune,
          });
        }
      }
    }

    return { ok: true };
  },
});

function formatDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayInAlgeria() {
  return formatDateOnly(new Date(Date.now() + 60 * 60 * 1000));
}

async function ensureGeneralSpecialty(ctx: any) {
  const existing = await ctx.db
    .query('specialties')
    .withSearchIndex('search_name', (q: any) => q.search('name', 'طب عام'))
    .take(1);

  if (existing[0]) return existing[0]._id;

  return await ctx.db.insert('specialties', {
    name: 'طب عام',
    icon: 'stethoscope',
  });
}

async function ensureMockDoctor(ctx: any, clinicId: Id<'clinics'>) {
  const tokenIdentifier = `mock:clinic:${clinicId}:doctor`;
  const existingUser = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: any) => q.eq('tokenIdentifier', tokenIdentifier))
    .unique();

  const userId =
    existingUser?._id ??
    (await ctx.db.insert('users', {
      tokenIdentifier,
      fullName: 'الدكتورة نادية بن سالم',
      gender: 'female',
      role: 'doctor',
      phone: '+213700000901',
      phoneNormalized: '+213700000901',
      phoneLoginKey: 'dz213700000901',
      email: 'mock.clinic.doctor@example.test',
      emailNormalized: 'mock.clinic.doctor@example.test',
      isActive: true,
    }));

  const existingDoctor = await ctx.db
    .query('doctors')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .unique();

  if (existingDoctor) return existingDoctor._id;

  const specialtyId = await ensureGeneralSpecialty(ctx);
  return await ctx.db.insert('doctors', {
    userId,
    specialtyId,
    bio: 'طبيبة تجريبية لاختبار مواعيد العيادة.',
    yearsOfExperience: 8,
    consultationFee: 2500,
    followUpFee: 1500,
    avgRating: 0,
    totalReviews: 0,
  });
}

async function ensureMockPatient(ctx: any, clinicId: Id<'clinics'>) {
  const tokenIdentifier = `mock:clinic:${clinicId}:patient`;
  const existingUser = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: any) => q.eq('tokenIdentifier', tokenIdentifier))
    .unique();

  const userId =
    existingUser?._id ??
    (await ctx.db.insert('users', {
      tokenIdentifier,
      fullName: 'سمير موعد',
      gender: 'male',
      role: 'patient',
      phone: '+213700000902',
      phoneNormalized: '+213700000902',
      phoneLoginKey: 'dz213700000902',
      email: 'mock.clinic.patient@example.test',
      emailNormalized: 'mock.clinic.patient@example.test',
      isActive: true,
    }));

  const existingPatient = await ctx.db
    .query('patients')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .unique();

  if (existingPatient) return existingPatient._id;

  return await ctx.db.insert('patients', {
    userId,
    chronicDiseases: [],
    allergies: [],
  });
}

export const seedMockDoctorForClinic = mutation({
  args: {
    clinicId: v.optional(v.id('clinics')),
  },
  handler: async (ctx, args) => {
    const clinic = args.clinicId
      ? await ctx.db.get(args.clinicId)
      : (
          await ctx.db
            .query('clinics')
            .filter((q) => q.eq(q.field('isActive'), true))
            .take(1)
        )[0];

    if (!clinic) {
      throw new ConvexError('No active clinic found to seed mock doctor data');
    }

    const now = Date.now();
    const doctorId = await ensureMockDoctor(ctx, clinic._id);
    const patientId = await ensureMockPatient(ctx, clinic._id);

    const membership = await ctx.db
      .query('clinicMemberships')
      .withIndex('by_clinicId_and_doctorId', (q) =>
        q.eq('clinicId', clinic._id).eq('doctorId', doctorId),
      )
      .unique();

    if (membership) {
      if (membership.status !== 'accepted') {
        await ctx.db.patch(membership._id, {
          status: 'accepted',
          updatedAt: now,
          acceptedAt: now,
        });
      }
    } else {
      await ctx.db.insert('clinicMemberships', {
        clinicId: clinic._id,
        doctorId,
        requestedBy: 'clinic',
        status: 'accepted',
        createdAt: now,
        updatedAt: now,
        acceptedAt: now,
      });
    }

    const appointmentDate = todayInAlgeria();
    const appointmentTime = '11:30';
    const existingBookings = await ctx.db
      .query('bookings')
      .withIndex('by_clinicId_and_doctorId_and_appointmentDate_and_appointmentTime', (q) =>
        q
          .eq('clinicId', clinic._id)
          .eq('doctorId', doctorId)
          .eq('appointmentDate', appointmentDate)
          .eq('appointmentTime', appointmentTime),
      )
      .take(1);

    const bookingId =
      existingBookings[0]?._id ??
      (await ctx.db.insert('bookings', {
        patientId,
        doctorId,
        clinicId: clinic._id,
        appointmentDate,
        appointmentTime,
        appointmentDuration: 30,
        visitType: 'consultation',
        reason: 'موعد تجريبي لاختبار تبديل الأطباء',
        status: 'confirmed',
        confirmedAt: now,
      }));

    return {
      ok: true,
      clinicId: clinic._id,
      doctorId,
      patientId,
      bookingId,
      appointmentDate,
      appointmentTime,
    };
  },
});
