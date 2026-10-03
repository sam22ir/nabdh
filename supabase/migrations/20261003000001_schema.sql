-- Nabdh schema (Supabase). Replaces the Convex schema in convex/schema.ts.
-- Dropped on purpose: patients.chronicDiseases/allergies, reviews.diagnosisRating,
-- legacy doctor-owned clinics, nullable schedule doctor ids, patient profile stub.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;

create type public.app_role as enum ('patient', 'doctor', 'clinic');
create type public.booking_status as enum
  ('confirmed', 'present', 'in_room', 'cancelled', 'completed', 'no_show');
create type public.visit_type as enum ('first', 'followup', 'consultation');
create type public.membership_status as enum
  ('pending', 'accepted', 'rejected', 'cancelled', 'ended');
create type public.exception_type as enum
  ('single_hour', 'time_range', 'full_day', 'multi_day');
create type public.note_visibility as enum
  ('doctor_private', 'care_team', 'patient_visible');

-- Reference data ------------------------------------------------------------
create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'briefcase',
  parent_id uuid references public.specialties (id) on delete set null
);

create table public.wilayas (
  id smallint primary key,
  name text not null
);

create table public.communes (
  id uuid primary key default gen_random_uuid(),
  wilaya_id smallint not null references public.wilayas (id) on delete cascade,
  name text not null
);
create index communes_wilaya_id_idx on public.communes (wilaya_id);

-- Accounts -------------------------------------------------------------------
-- profiles: public-facing identity only. Contact/legal data lives in
-- profile_private so it can have stricter row access.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  gender text check (gender in ('male', 'female')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_full_name_trgm_idx
  on public.profiles using gin (full_name extensions.gin_trgm_ops);

create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  email text,
  terms_version text,
  privacy_version text,
  legal_accepted_at timestamptz
);

create table public.doctors (
  id uuid primary key references public.profiles (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id),
  wilaya_id smallint references public.wilayas (id),
  bio text not null default '',
  years_of_experience integer not null default 0 check (years_of_experience >= 0),
  consultation_fee numeric(10, 2) check (consultation_fee >= 0),
  follow_up_fee numeric(10, 2) check (follow_up_fee >= 0),
  avg_rating numeric(3, 2) not null default 0,
  total_reviews integer not null default 0,
  created_at timestamptz not null default now()
);
create index doctors_specialty_id_idx on public.doctors (specialty_id);
create index doctors_wilaya_id_idx on public.doctors (wilaya_id);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  wilaya_id smallint not null references public.wilayas (id),
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  map_url text,
  phone text not null,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index clinics_owner_id_idx on public.clinics (owner_id);
create index clinics_wilaya_id_idx on public.clinics (wilaya_id);
create index clinics_name_trgm_idx
  on public.clinics using gin (name extensions.gin_trgm_ops);

create table public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  requested_by text not null check (requested_by in ('doctor', 'clinic')),
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  ended_by text check (ended_by in ('doctor', 'clinic')),
  end_reason text
);
create unique index clinic_memberships_open_uniq
  on public.clinic_memberships (clinic_id, doctor_id)
  where status in ('pending', 'accepted');
create index clinic_memberships_doctor_idx
  on public.clinic_memberships (doctor_id, status);
create index clinic_memberships_clinic_idx
  on public.clinic_memberships (clinic_id, status);

-- Scheduling ------------------------------------------------------------------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  appointment_duration_minutes integer not null check (appointment_duration_minutes > 0),
  max_patients_per_day integer check (max_patients_per_day > 0),
  is_active boolean not null default true,
  check (end_time > start_time),
  unique (clinic_id, doctor_id, day_of_week)
);
create index schedules_doctor_idx on public.schedules (doctor_id);

-- doctor_id null = the whole clinic is closed.
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid references public.doctors (id) on delete cascade,
  exception_date date not null,
  end_date date,
  reason text not null default '',
  exception_type public.exception_type not null default 'full_day',
  custom_start_time time,
  custom_end_time time,
  check (end_date is null or end_date >= exception_date)
);
create index schedule_exceptions_clinic_idx
  on public.schedule_exceptions (clinic_id, exception_date);
create index schedule_exceptions_doctor_idx
  on public.schedule_exceptions (doctor_id, exception_date);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  appointment_duration integer not null default 30 check (appointment_duration > 0),
  visit_type public.visit_type not null default 'first',
  reason text,
  patient_note text,
  doctor_note text,
  status public.booking_status not null default 'confirmed',
  cancelled_by text check (cancelled_by in ('patient', 'doctor', 'clinic', 'system')),
  cancellation_reason text,
  confirmed_at timestamptz default now(),
  present_at timestamptz,
  in_room_at timestamptz,
  cancelled_at timestamptz,
  no_show_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  period tsrange generated always as (
    tsrange(
      appointment_date + appointment_time,
      appointment_date + appointment_time + make_interval(mins => appointment_duration)
    )
  ) stored,
  -- A doctor can never be double-booked, even under concurrent requests.
  constraint bookings_no_doctor_overlap
    exclude using gist (doctor_id with =, period with &&)
    where (status <> 'cancelled')
);
create index bookings_patient_idx on public.bookings (patient_id, appointment_date);
create index bookings_doctor_idx on public.bookings (doctor_id, appointment_date);
create index bookings_clinic_idx on public.bookings (clinic_id, appointment_date, appointment_time);

create table public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_role public.app_role not null check (author_role in ('doctor', 'clinic')),
  author_name text not null,
  visibility public.note_visibility not null default 'care_team',
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);
create index booking_notes_booking_idx on public.booking_notes (booking_id, created_at);
create index booking_notes_author_idx on public.booking_notes (author_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  punctuality_rating smallint not null check (punctuality_rating between 1 and 5),
  professionalism_rating smallint not null check (professionalism_rating between 1 and 5),
  cleanliness_rating smallint not null check (cleanliness_rating between 1 and 5),
  comment text,
  is_anonymous boolean not null default false,
  is_hidden boolean not null default false,
  doctor_reply text,
  created_at timestamptz not null default now()
);
create index reviews_doctor_idx on public.reviews (doctor_id, is_hidden);
create index reviews_patient_idx on public.reviews (patient_id);

-- Engagement ------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.doctor_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  new_booking_alerts boolean not null default true,
  cancellation_alerts boolean not null default true,
  daily_summary boolean not null default false,
  min_cancel_hours integer check (min_cancel_hours >= 0),
  updated_at timestamptz not null default now()
);

create table public.clinic_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete cascade,
  auto_complete_appointments boolean not null default false,
  new_booking_alerts boolean not null default true,
  cancellation_alerts boolean not null default true,
  daily_summary boolean not null default false,
  updated_at timestamptz not null default now()
);
create index clinic_settings_clinic_idx on public.clinic_settings (clinic_id);

create table public.patient_favorites (
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, doctor_id)
);
create index patient_favorites_doctor_idx on public.patient_favorites (doctor_id);

-- Keep doctors.avg_rating / total_reviews in sync with visible reviews --------
create function private.refresh_doctor_rating(p_doctor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.doctors d
  set avg_rating = coalesce(r.avg, 0),
      total_reviews = coalesce(r.cnt, 0)
  from (
    select round(avg(overall_rating)::numeric, 2) as avg, count(*)::int as cnt
    from public.reviews
    where doctor_id = p_doctor and not is_hidden
  ) r
  where d.id = p_doctor;
$$;

create function private.reviews_rating_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_doctor_rating(coalesce(new.doctor_id, old.doctor_id));
  return null;
end;
$$;

create trigger reviews_refresh_rating
after insert or update or delete on public.reviews
for each row execute function private.reviews_rating_trigger();
