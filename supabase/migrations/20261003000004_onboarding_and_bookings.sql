-- Onboarding (Google sign-in -> one short step per role) and the booking engine.
-- Errors raised as plain messages the client can match on:
--   unauthenticated, forbidden, not_found, already_onboarded, name_required,
--   terms_required, slot_unavailable, invalid_state, too_late

-- Helpers -----------------------------------------------------------------------
create function private.create_profile(
  p_role public.app_role,
  p_full_name text,
  p_phone text,
  p_terms_version text,
  p_privacy_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user auth.users%rowtype;
  v_name text;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'already_onboarded';
  end if;
  if p_terms_version is null or p_privacy_version is null then
    raise exception 'terms_required';
  end if;

  select * into v_user from auth.users where id = v_uid;
  v_name := nullif(btrim(coalesce(
    p_full_name,
    v_user.raw_user_meta_data ->> 'full_name',
    v_user.raw_user_meta_data ->> 'name',
    split_part(coalesce(v_user.email, ''), '@', 1)
  )), '');
  if v_name is null then
    raise exception 'name_required';
  end if;

  insert into public.profiles (id, role, full_name) values (v_uid, p_role, v_name);
  insert into public.profile_private
    (user_id, phone, email, terms_version, privacy_version, legal_accepted_at)
  values
    (v_uid, nullif(btrim(p_phone), ''), v_user.email, p_terms_version, p_privacy_version, now());
  return v_uid;
end;
$$;

create function private.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, p_data)
$$;

create function private.algeria_now()
returns timestamp
language sql stable
as $$ select now() at time zone 'Africa/Algiers' $$;

-- Onboarding ------------------------------------------------------------------------
create function public.onboard_patient(
  p_terms_version text,
  p_privacy_version text,
  p_full_name text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_profile('patient', p_full_name, p_phone, p_terms_version, p_privacy_version);
end;
$$;

create function public.onboard_doctor(
  p_specialty_id uuid,
  p_wilaya_id smallint,
  p_terms_version text,
  p_privacy_version text,
  p_full_name text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := private.create_profile('doctor', p_full_name, p_phone, p_terms_version, p_privacy_version);
  insert into public.doctors (id, specialty_id, wilaya_id) values (v_uid, p_specialty_id, p_wilaya_id);
  insert into public.doctor_settings (user_id) values (v_uid);
  return v_uid;
end;
$$;

create function public.onboard_clinic(
  p_clinic_name text,
  p_wilaya_id smallint,
  p_phone text,
  p_terms_version text,
  p_privacy_version text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_clinic uuid;
begin
  v_uid := private.create_profile(
    'clinic', coalesce(p_full_name, p_clinic_name), p_phone, p_terms_version, p_privacy_version
  );
  insert into public.clinics (owner_id, name, wilaya_id, phone)
  values (v_uid, btrim(p_clinic_name), p_wilaya_id, btrim(p_phone))
  returning id into v_clinic;
  insert into public.clinic_settings (user_id, clinic_id) values (v_uid, v_clinic);
  return v_clinic;
end;
$$;

-- Slots -------------------------------------------------------------------------------
create function public.get_available_slots(p_clinic uuid, p_doctor uuid, p_date date)
returns table (slot_time time, duration integer, available boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sched public.schedules%rowtype;
  v_now timestamp := private.algeria_now();
  v_total_minutes integer;
  v_count integer;
  v_day_full boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.clinics where id = p_clinic and is_active) then
    return;
  end if;
  if not private.is_accepted_member(p_clinic, p_doctor) then
    return;
  end if;
  -- clinic-wide closure
  if exists (
    select 1 from public.schedule_exceptions e
    where e.clinic_id = p_clinic and e.doctor_id is null
      and e.exception_date <= p_date and coalesce(e.end_date, e.exception_date) >= p_date
      and e.exception_type not in ('single_hour', 'time_range')
  ) then
    return;
  end if;
  -- doctor full-day exception
  if exists (
    select 1 from public.schedule_exceptions e
    where e.clinic_id = p_clinic and e.doctor_id = p_doctor
      and e.exception_date <= p_date and coalesce(e.end_date, e.exception_date) >= p_date
      and e.exception_type in ('full_day', 'multi_day')
  ) then
    return;
  end if;

  select * into v_sched from public.schedules s
  where s.clinic_id = p_clinic and s.doctor_id = p_doctor
    and s.day_of_week = extract(dow from p_date)::int and s.is_active;
  if not found then
    return;
  end if;

  if v_sched.max_patients_per_day is not null then
    select count(*) into v_count from public.bookings b
    where b.doctor_id = p_doctor and b.clinic_id = p_clinic
      and b.appointment_date = p_date and b.status <> 'cancelled';
    v_day_full := v_count >= v_sched.max_patients_per_day;
  end if;

  v_total_minutes := (extract(epoch from (v_sched.end_time - v_sched.start_time)) / 60)::int;

  return query
  select
    t.slot_start::time as slot_time,
    v_sched.appointment_duration_minutes as duration,
    (
      not v_day_full
      and t.slot_start > v_now
      and not exists (
        select 1 from public.bookings b
        where b.doctor_id = p_doctor and b.status <> 'cancelled'
          and b.period && tsrange(t.slot_start, t.slot_end)
      )
      and not exists (
        select 1 from public.schedule_exceptions e
        where e.clinic_id = p_clinic and e.doctor_id = p_doctor
          and e.exception_type in ('single_hour', 'time_range')
          and e.custom_start_time is not null and e.custom_end_time is not null
          and e.exception_date <= p_date and coalesce(e.end_date, e.exception_date) >= p_date
          and t.slot_start < p_date + e.custom_end_time
          and t.slot_end > p_date + e.custom_start_time
      )
    ) as available
  from (
    select
      p_date + v_sched.start_time + make_interval(mins => i * v_sched.appointment_duration_minutes) as slot_start,
      p_date + v_sched.start_time + make_interval(mins => (i + 1) * v_sched.appointment_duration_minutes) as slot_end
    from generate_series(0, v_total_minutes / v_sched.appointment_duration_minutes - 1) as i
  ) t
  order by t.slot_start;
end;
$$;

-- Create / cancel / status ----------------------------------------------------------------
create function public.create_booking(
  p_doctor_id uuid,
  p_clinic_id uuid,
  p_date date,
  p_time time,
  p_visit_type public.visit_type default 'first',
  p_reason text default null,
  p_patient_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_patient public.profiles%rowtype;
  v_slot record;
  v_id uuid;
  v_owner uuid;
  v_body text;
  v_data jsonb;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select * into v_patient from public.profiles where id = v_uid and is_active;
  if not found or v_patient.role <> 'patient' then
    raise exception 'forbidden';
  end if;

  select * into v_slot from public.get_available_slots(p_clinic_id, p_doctor_id, p_date) s
  where s.slot_time = p_time;
  if not found or not v_slot.available then
    raise exception 'slot_unavailable';
  end if;

  begin
    insert into public.bookings
      (patient_id, doctor_id, clinic_id, appointment_date, appointment_time,
       appointment_duration, visit_type, reason, patient_note, status, confirmed_at)
    values
      (v_uid, p_doctor_id, p_clinic_id, p_date, p_time,
       v_slot.duration, p_visit_type, p_reason, p_patient_note, 'confirmed', now())
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;

  v_body := format('%s حجز موعداً بتاريخ %s الساعة %s',
                   v_patient.full_name, p_date, to_char(p_time, 'HH24:MI'));
  v_data := jsonb_build_object('bookingId', v_id);

  if coalesce((select new_booking_alerts from public.doctor_settings where user_id = p_doctor_id), true) then
    perform private.notify(p_doctor_id, 'new_booking', 'موعد جديد', v_body, v_data);
  end if;
  select owner_id into v_owner from public.clinics where id = p_clinic_id;
  if v_owner is not null and v_owner <> p_doctor_id
     and coalesce((select new_booking_alerts from public.clinic_settings where user_id = v_owner), true) then
    perform private.notify(v_owner, 'new_booking', 'موعد جديد', v_body, v_data);
  end if;
  return v_id;
end;
$$;

create function public.cancel_booking(p_booking uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.app_role;
  v_b public.bookings%rowtype;
  v_owner uuid;
  v_min_hours integer;
  v_body text;
  v_data jsonb;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or not private.is_booking_party(v_b.patient_id, v_b.doctor_id, v_b.clinic_id) then
    raise exception 'not_found';
  end if;
  v_role := private.my_role();
  if v_b.status not in ('confirmed', 'present') then
    raise exception 'invalid_state';
  end if;

  if v_b.patient_id = v_uid then
    select min_cancel_hours into v_min_hours from public.doctor_settings where user_id = v_b.doctor_id;
    if v_min_hours is not null
       and (v_b.appointment_date + v_b.appointment_time) - private.algeria_now() < make_interval(hours => v_min_hours) then
      raise exception 'too_late';
    end if;
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_by = v_role::text,
      cancellation_reason = nullif(btrim(p_reason), ''),
      cancelled_at = now()
  where id = p_booking;

  v_data := jsonb_build_object('bookingId', p_booking);
  v_body := format('تم إلغاء موعد %s الساعة %s', v_b.appointment_date, to_char(v_b.appointment_time, 'HH24:MI'));
  select owner_id into v_owner from public.clinics where id = v_b.clinic_id;

  if v_b.patient_id = v_uid then
    if coalesce((select cancellation_alerts from public.doctor_settings where user_id = v_b.doctor_id), true) then
      perform private.notify(v_b.doctor_id, 'booking_cancelled', 'إلغاء موعد', v_body, v_data);
    end if;
    if v_owner is not null and v_owner <> v_b.doctor_id
       and coalesce((select cancellation_alerts from public.clinic_settings where user_id = v_owner), true) then
      perform private.notify(v_owner, 'booking_cancelled', 'إلغاء موعد', v_body, v_data);
    end if;
  else
    perform private.notify(v_b.patient_id, 'booking_cancelled', 'تم إلغاء موعدك', v_body, v_data);
  end if;
end;
$$;

create function public.set_booking_status(p_booking uuid, p_status public.booking_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or not private.is_booking_staff(v_b.doctor_id, v_b.clinic_id) then
    raise exception 'not_found';
  end if;

  if not (
    (v_b.status = 'confirmed' and p_status in ('present', 'no_show', 'completed'))
    or (v_b.status = 'present' and p_status in ('in_room', 'no_show', 'completed'))
    or (v_b.status = 'in_room' and p_status = 'completed')
  ) then
    raise exception 'invalid_state';
  end if;

  update public.bookings set
    status = p_status,
    present_at = case when p_status = 'present' then now() else present_at end,
    in_room_at = case when p_status = 'in_room' then now() else in_room_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    no_show_at = case when p_status = 'no_show' then now() else no_show_at end
  where id = p_booking;

  if p_status = 'no_show' then
    perform private.notify(
      v_b.patient_id, 'no_show', 'تم تسجيل غيابك',
      format('تم تسجيل غيابك عن موعد %s الساعة %s', v_b.appointment_date, to_char(v_b.appointment_time, 'HH24:MI')),
      jsonb_build_object('bookingId', p_booking)
    );
  end if;
end;
$$;

create function public.update_booking_doctor_note(p_booking uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set doctor_note = nullif(btrim(p_note), '')
  where id = p_booking and doctor_id = (select auth.uid());
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- Only signed-in users may call the API functions ---------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'onboard_patient(text,text,text,text)',
    'onboard_doctor(uuid,smallint,text,text,text,text)',
    'onboard_clinic(text,smallint,text,text,text,text)',
    'get_available_slots(uuid,uuid,date)',
    'create_booking(uuid,uuid,date,time,public.visit_type,text,text)',
    'cancel_booking(uuid,text)',
    'set_booking_status(uuid,public.booking_status)',
    'update_booking_doctor_note(uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Internal helpers are only ever called by other security definer functions.
revoke all on function private.create_profile(public.app_role, text, text, text, text) from public, anon, authenticated;
revoke all on function private.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.refresh_doctor_rating(uuid) from public, anon, authenticated;
revoke all on function private.reviews_rating_trigger() from public, anon, authenticated;
grant execute on function private.algeria_now() to authenticated, service_role;
