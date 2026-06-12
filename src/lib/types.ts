// =============================================================================
// Domain Glossary Types for Nabdh
// =============================================================================

// ─── Primitives ──────────────────────────────────────────────────────────────

export type UserRole = 'patient' | 'doctor';

export type Gender = 'male' | 'female';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type VisitType = 'first' | 'followup' | 'consultation';

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

/** 0=Sunday, 1=Monday, ... 6=Saturday */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ─── Base User ───────────────────────────────────────────────────────────────

export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  fullNameAr: string;
  fullNameFr: string;
  phone: string;
  avatarUrl: string | null;
  wilayaId: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export interface Patient extends BaseUser {
  dateOfBirth: string;
  gender: Gender;
  communeId: number;
  bloodType: BloodType | null;
  chronicDiseases: readonly string[];
  allergies: readonly string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

// ─── Doctor ──────────────────────────────────────────────────────────────────

export interface Doctor extends BaseUser {
  specialtyId: string;
  subSpecialties: readonly string[];
  bioAr: string | null;
  bioFr: string | null;
  yearsOfExperience: number;
  languages: readonly string[];
  orderRegistrationNumber: string;
  isVerified: boolean;
  isProfileComplete: boolean;
  avgRating: number;
  totalReviews: number;
}

// ─── Patient Profile (family sub-profiles) ───────────────────────────────────

export interface PatientProfile {
  id: string;
  parentUserId: string;
  fullNameAr: string;
  dateOfBirth: string;
  gender: Gender;
  bloodType: BloodType | null;
  chronicDiseases: readonly string[];
  allergies: readonly string[];
}

// ─── Clinic ──────────────────────────────────────────────────────────────────

export interface Clinic {
  id: string;
  doctorId: string;
  name: string;
  wilayaId: number;
  communeId: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  isActive: boolean;
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export interface Schedule {
  id: string;
  clinicId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  appointmentDurationMinutes: number;
  maxPatientsPerDay: number;
}

// ─── Schedule Exception ──────────────────────────────────────────────────────

export interface ScheduleException {
  id: string;
  clinicId: string;
  exceptionDate: string; // YYYY-MM-DD
  isClosed: boolean;
  customStartTime: string | null; // HH:mm
  customEndTime: string | null;   // HH:mm
  reason: string | null;
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  profileId: string | null;
  appointmentDate: string;  // YYYY-MM-DD
  appointmentTime: string;  // HH:mm
  appointmentDuration: number;
  visitType: VisitType;
  reason: string;
  patientNote: string | null;
  status: AppointmentStatus;
  cancelledBy: 'patient' | 'doctor' | 'system' | null;
  cancellationReason: string | null;
  createdAt: string;
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  bookingId: string;
  patientId: string;
  doctorId: string;
  overallRating: number;
  punctualityRating: number;
  diagnosisRating: number;
  professionalismRating: number;
  cleanlinessRating: number;
  comment: string | null;
  isAnonymous: boolean;
  doctorReply: string | null;
  createdAt: string;
}

// ─── Specialty ───────────────────────────────────────────────────────────────

export interface Specialty {
  id: string;
  nameAr: string;
  nameFr: string;
  icon: string | null;
  parentId: string | null;
}

// ─── Wilaya ──────────────────────────────────────────────────────────────────

export interface Wilaya {
  id: number; // 1-58
  nameAr: string;
  nameFr: string;
}

// ─── Commune ─────────────────────────────────────────────────────────────────

export interface Commune {
  id: number;
  wilayaId: number;
  nameAr: string;
  nameFr: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  // Auth routes
  'auth/welcome': undefined;
  'auth/login': undefined;
  'auth/register': { role?: UserRole };
  'auth/forgot-password': undefined;
  'auth/onboarding': undefined;

  // Main routes
  '(tabs)': undefined;
  'appointment/booking': { doctorId: string; clinicId?: string };
  'appointment/details': { appointmentId: string };
  'appointment/confirmation': { appointmentId: string };
  'doctor/profile': { doctorId: string };
  'doctor/search': undefined;
  'clinic/details': { clinicId: string };
  'profile/edit': undefined;
  'profile/family-profiles': undefined;
  'profile/family-profile/create': undefined;
  'profile/family-profile/edit': { profileId: string };
  'reviews/create': { bookingId: string; doctorId: string };
  'reviews/list': { doctorId: string };
  'settings/index': undefined;
};

// =============================================================================
// Supabase Database Type (single `users` table with role-based nullable fields)
// =============================================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: DatabaseUser;
        Insert: DatabaseUserInsert;
        Update: Partial<DatabaseUserInsert>;
      };
      patient_profiles: {
        Row: DatabasePatientProfile;
        Insert: DatabasePatientProfileInsert;
        Update: Partial<DatabasePatientProfileInsert>;
      };
      clinics: {
        Row: Clinic;
        Insert: Omit<Clinic, 'id'>;
        Update: Partial<Omit<Clinic, 'id'>>;
      };
      schedules: {
        Row: Schedule;
        Insert: Omit<Schedule, 'id'>;
        Update: Partial<Omit<Schedule, 'id'>>;
      };
      schedule_exceptions: {
        Row: ScheduleException;
        Insert: Omit<ScheduleException, 'id'>;
        Update: Partial<Omit<ScheduleException, 'id'>>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, 'id' | 'createdAt'>;
        Update: Partial<Omit<Appointment, 'id' | 'createdAt'>>;
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, 'id' | 'createdAt' | 'doctorReply'>;
        Update: Partial<Omit<Review, 'id' | 'createdAt'>>;
      };
      specialties: {
        Row: Specialty;
        Insert: Omit<Specialty, 'id'>;
        Update: Partial<Omit<Specialty, 'id'>>;
      };
      wilayas: {
        Row: Wilaya;
        Insert: Wilaya;
        Update: Partial<Wilaya>;
      };
      communes: {
        Row: Commune;
        Insert: Commune;
        Update: Partial<Commune>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      gender: Gender;
      blood_type: BloodType;
      visit_type: VisitType;
      appointment_status: AppointmentStatus;
      day_of_week: DayOfWeek;
    };
    CompositeTypes: Record<string, never>;
  };
}

/** Full user row from the `users` table — all patient and doctor fields are
 *  nullable because a single table serves both roles, discriminated by `role`. */
export interface DatabaseUser {
  id: string;
  email: string;
  role: UserRole;
  full_name_ar: string;
  full_name_fr: string;
  phone: string;
  avatar_url: string | null;
  wilaya_id: number;
  is_active: boolean;
  created_at: string;
  // Patient fields (nullable for doctors)
  date_of_birth: string | null;
  gender: Gender | null;
  commune_id: number | null;
  blood_type: BloodType | null;
  chronic_diseases: string[] | null;
  allergies: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  // Doctor fields (nullable for patients)
  specialty_id: string | null;
  sub_specialties: string[] | null;
  bio_ar: string | null;
  bio_fr: string | null;
  years_of_experience: number | null;
  languages: string[] | null;
  order_registration_number: string | null;
  is_verified: boolean;
  is_profile_complete: boolean;
  avg_rating: number;
  total_reviews: number;
}

export type DatabaseUserInsert = Omit<DatabaseUser, 'created_at'>;

export interface DatabasePatientProfile {
  id: string;
  parent_user_id: string;
  full_name_ar: string;
  date_of_birth: string;
  gender: Gender;
  blood_type: BloodType | null;
  chronic_diseases: string[];
  allergies: string[];
}

export type DatabasePatientProfileInsert = Omit<DatabasePatientProfile, 'id'>;
