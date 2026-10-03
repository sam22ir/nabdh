-- Row Level Security. Every public table has RLS enabled. Role comes from
-- public.profiles.role (set once by an onboard_* function), never from client
-- supplied JWT metadata. All writes that change state go through the
-- security definer functions in the next migration; direct table writes are
-- limited to a few safe, column-restricted updates.

-- Helper functions (not exposed through the API: private schema) ---------------
create function private.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create function private.is_active_profile(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = p_id and is_active) $$;

create function private.owns_clinic(p_clinic uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.clinics
    where id = p_clinic and owner_id = (select auth.uid())
  )
$$;

create function private.is_accepted_member(p_clinic uuid, p_doctor uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.clinic_memberships
    where clinic_id = p_clinic and doctor_id = p_doctor and status = 'accepted'
  )
$$;

-- Clinic owner (for accepted doctors, or clinic-wide rows) or the doctor
-- themselves (for their own accepted clinics).
create function private.can_manage_schedule(p_clinic uuid, p_doctor uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_doctor is null then private.owns_clinic(p_clinic)
    when private.owns_clinic(p_clinic) then private.is_accepted_member(p_clinic, p_doctor)
    when p_doctor = (select auth.uid()) then private.is_accepted_member(p_clinic, p_doctor)
    else false
  end
$$;

create function private.is_booking_party(p_patient uuid, p_doctor uuid, p_clinic uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_patient = (select auth.uid())
      or p_doctor = (select auth.uid())
      or private.owns_clinic(p_clinic)
$$;

-- Staff side of a booking: the doctor or the clinic owner.
create function private.is_booking_staff(p_doctor uuid, p_clinic uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select p_doctor = (select auth.uid()) or private.owns_clinic(p_clinic) $$;

create function private.can_read_note(p_booking uuid, p_author uuid, p_visibility public.note_visibility)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_author = (select auth.uid())
    or exists (
      select 1 from public.bookings b
      where b.id = p_booking
        and case p_visibility
          when 'patient_visible' then
            b.patient_id = (select auth.uid()) or private.is_booking_staff(b.doctor_id, b.clinic_id)
          when 'care_team' then
            private.is_booking_staff(b.doctor_id, b.clinic_id)
          else false
        end
    )
$$;

grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Enable RLS everywhere ---------------------------------------------------------
alter table public.specialties enable row level security;
alter table public.wilayas enable row level security;
alter table public.communes enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.doctors enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_notes enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.doctor_settings enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.patient_favorites enable row level security;

-- Start from no privileges, then grant exactly what the app needs -------------
revoke all on all tables in schema public from anon, authenticated;

-- Reference data: readable by everyone (incl. signed-out), writable by no one.
grant select on public.specialties, public.wilayas, public.communes to anon, authenticated;
create policy ref_specialties_read on public.specialties for select to anon, authenticated using (true);
create policy ref_wilayas_read on public.wilayas for select to anon, authenticated using (true);
create policy ref_communes_read on public.communes for select to anon, authenticated using (true);

-- profiles ---------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, gender) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (is_active and role in ('doctor', 'clinic'))
  or exists (
    select 1 from public.bookings b
    where b.patient_id = profiles.id
      and private.is_booking_staff(b.doctor_id, b.clinic_id)
  )
);
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_private ----------------------------------------------------------------
grant select on public.profile_private to authenticated;
grant update (phone, email) on public.profile_private to authenticated;
create policy profile_private_read on public.profile_private for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.patient_id = profile_private.user_id
      and private.is_booking_staff(b.doctor_id, b.clinic_id)
  )
);
create policy profile_private_update_own on public.profile_private for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- doctors ------------------------------------------------------------------------
grant select on public.doctors to authenticated;
grant update (specialty_id, wilaya_id, bio, years_of_experience, consultation_fee, follow_up_fee)
  on public.doctors to authenticated;
create policy doctors_read on public.doctors for select to authenticated
using (id = (select auth.uid()) or private.is_active_profile(id));
create policy doctors_update_own on public.doctors for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- clinics ------------------------------------------------------------------------
grant select, insert on public.clinics to authenticated;
grant update (name, wilaya_id, address, latitude, longitude, map_url, phone, email, is_active)
  on public.clinics to authenticated;
create policy clinics_read on public.clinics for select to authenticated
using (is_active or owner_id = (select auth.uid()));
create policy clinics_insert_own on public.clinics for insert to authenticated
with check (owner_id = (select auth.uid()) and (select private.my_role()) = 'clinic');
create policy clinics_update_own on public.clinics for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- clinic_memberships: read-only from the client; state changes via functions ------
grant select on public.clinic_memberships to authenticated;
create policy memberships_read on public.clinic_memberships for select to authenticated
using (doctor_id = (select auth.uid()) or private.owns_clinic(clinic_id));

-- schedules / exceptions -----------------------------------------------------------
grant select, insert, update, delete on public.schedules to authenticated;
create policy schedules_read on public.schedules for select to authenticated using (true);
create policy schedules_insert on public.schedules for insert to authenticated
with check (private.can_manage_schedule(clinic_id, doctor_id));
create policy schedules_update on public.schedules for update to authenticated
using (private.can_manage_schedule(clinic_id, doctor_id))
with check (private.can_manage_schedule(clinic_id, doctor_id));
create policy schedules_delete on public.schedules for delete to authenticated
using (private.can_manage_schedule(clinic_id, doctor_id));

grant select, insert, update, delete on public.schedule_exceptions to authenticated;
create policy exceptions_read on public.schedule_exceptions for select to authenticated using (true);
create policy exceptions_insert on public.schedule_exceptions for insert to authenticated
with check (private.can_manage_schedule(clinic_id, doctor_id));
create policy exceptions_update on public.schedule_exceptions for update to authenticated
using (private.can_manage_schedule(clinic_id, doctor_id))
with check (private.can_manage_schedule(clinic_id, doctor_id));
create policy exceptions_delete on public.schedule_exceptions for delete to authenticated
using (private.can_manage_schedule(clinic_id, doctor_id));

-- bookings: parties can read; all changes go through functions ----------------------
grant select on public.bookings to authenticated;
create policy bookings_read on public.bookings for select to authenticated
using (private.is_booking_party(patient_id, doctor_id, clinic_id));

-- booking_notes -----------------------------------------------------------------------
grant select on public.booking_notes to authenticated;
create policy notes_read on public.booking_notes for select to authenticated
using (private.can_read_note(booking_id, author_id, visibility));

-- reviews ---------------------------------------------------------------------------------
grant select on public.reviews to authenticated;
create policy reviews_read on public.reviews for select to authenticated
using (not is_hidden or patient_id = (select auth.uid()) or doctor_id = (select auth.uid()));

-- notifications ------------------------------------------------------------------------------
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
using (user_id = (select auth.uid()));

-- push_tokens ------------------------------------------------------------------------------------
grant select, insert, delete on public.push_tokens to authenticated;
create policy push_tokens_read on public.push_tokens for select to authenticated
using (user_id = (select auth.uid()));
create policy push_tokens_insert on public.push_tokens for insert to authenticated
with check (user_id = (select auth.uid()));
create policy push_tokens_delete on public.push_tokens for delete to authenticated
using (user_id = (select auth.uid()));

-- settings ------------------------------------------------------------------------------------------
grant select, update on public.doctor_settings to authenticated;
create policy doctor_settings_read on public.doctor_settings for select to authenticated
using (user_id = (select auth.uid()));
create policy doctor_settings_update on public.doctor_settings for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.clinic_settings to authenticated;
grant update (auto_complete_appointments, new_booking_alerts, cancellation_alerts, daily_summary, updated_at)
  on public.clinic_settings to authenticated;
create policy clinic_settings_read on public.clinic_settings for select to authenticated
using (user_id = (select auth.uid()));
create policy clinic_settings_update on public.clinic_settings for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- favorites ---------------------------------------------------------------------------------------------
grant select, insert, delete on public.patient_favorites to authenticated;
create policy favorites_read on public.patient_favorites for select to authenticated
using (patient_id = (select auth.uid()));
create policy favorites_insert on public.patient_favorites for insert to authenticated
with check (patient_id = (select auth.uid()) and (select private.my_role()) = 'patient');
create policy favorites_delete on public.patient_favorites for delete to authenticated
using (patient_id = (select auth.uid()));
