-- Reschedule, automatic attendance, and clinic counters.

create function public.reschedule_booking(
  p_booking uuid, p_date date, p_time time, p_clinic uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.bookings%rowtype;
  v_clinic uuid;
  v_slot record;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or v_b.patient_id <> v_uid then
    raise exception 'not_found';
  end if;
  if v_b.status <> 'confirmed' then
    raise exception 'invalid_state';
  end if;
  v_clinic := coalesce(p_clinic, v_b.clinic_id);
  if v_clinic = v_b.clinic_id and p_date = v_b.appointment_date and p_time = v_b.appointment_time then
    return;
  end if;

  select * into v_slot from public.get_available_slots(v_clinic, v_b.doctor_id, p_date) s
  where s.slot_time = p_time;
  if not found or not v_slot.available then
    raise exception 'slot_unavailable';
  end if;

  begin
    update public.bookings
    set clinic_id = v_clinic, appointment_date = p_date, appointment_time = p_time,
        appointment_duration = v_slot.duration
    where id = p_booking;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;

  if coalesce((select new_booking_alerts from public.doctor_settings where user_id = v_b.doctor_id), true) then
    perform private.notify(
      v_b.doctor_id, 'booking_rescheduled', 'تعديل موعد',
      format('تم تغيير موعد إلى %s الساعة %s', p_date, to_char(p_time, 'HH24:MI')),
      jsonb_build_object('bookingId', p_booking)
    );
  end if;
end;
$$;

-- Moves bookings through present -> in_room -> completed / no_show as time passes.
create function private.process_clinic_attendance(p_clinic uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto boolean := coalesce(
    (select auto_complete_appointments from public.clinic_settings where clinic_id = p_clinic limit 1), true);
  v_now timestamp := private.algeria_now();
  v_b public.bookings%rowtype;
  v_start timestamp;
  v_end timestamp;
  v_in_room int := 0;
  v_completed int := 0;
  v_no_show int := 0;
  v_doctor text;
  v_clinic_name text;
begin
  select name into v_clinic_name from public.clinics where id = p_clinic;
  for v_b in
    select * from public.bookings
    where clinic_id = p_clinic and status in ('confirmed', 'present', 'in_room')
    for update
  loop
    v_start := v_b.appointment_date + v_b.appointment_time;
    v_end := v_start + make_interval(mins => v_b.appointment_duration);

    if v_b.status = 'in_room' and v_auto and v_end <= v_now then
      update public.bookings set status = 'completed', completed_at = now() where id = v_b.id;
      v_completed := v_completed + 1;
    elsif v_b.status = 'present' and v_start <= v_now then
      if v_auto and v_end <= v_now then
        update public.bookings
        set status = 'completed', in_room_at = coalesce(in_room_at, now()), completed_at = now()
        where id = v_b.id;
        v_completed := v_completed + 1;
      else
        update public.bookings
        set status = 'in_room', in_room_at = coalesce(in_room_at, now())
        where id = v_b.id;
        v_in_room := v_in_room + 1;
      end if;
    elsif v_b.status = 'confirmed' and v_start <= v_now then
      update public.bookings set status = 'no_show', no_show_at = now() where id = v_b.id;
      v_no_show := v_no_show + 1;
      select p.full_name into v_doctor from public.profiles p where p.id = v_b.doctor_id;
      perform private.notify(
        v_b.patient_id, 'booking_no_show', 'تم اعتبار الموعد غياباً',
        format('تم تسجيل موعدك مع %s في %s كغياب. يمكنك الحجز لاحقاً أو اختيار مختص أو مركز آخر.',
               coalesce(v_doctor, 'المختص'), coalesce(v_clinic_name, 'المركز')),
        jsonb_build_object('bookingId', v_b.id, 'clinicId', v_b.clinic_id, 'doctorId', v_b.doctor_id)
      );
    end if;
  end loop;
  return jsonb_build_object('in_room', v_in_room, 'completed', v_completed, 'no_show', v_no_show);
end;
$$;

create function public.sync_clinic_attendance(p_clinic uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not private.owns_clinic(p_clinic) then
    raise exception 'not_found';
  end if;
  return private.process_clinic_attendance(p_clinic);
end;
$$;

create function public.count_clinic_doctors_working(p_clinic uuid, p_date date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.owns_clinic(p_clinic) then
    raise exception 'not_found';
  end if;
  if exists (
    select 1 from public.schedule_exceptions e
    where e.clinic_id = p_clinic and e.doctor_id is null
      and e.exception_date <= p_date and coalesce(e.end_date, e.exception_date) >= p_date
      and e.exception_type not in ('single_hour', 'time_range')
  ) then
    return 0;
  end if;
  return (
    select count(*)::int
    from public.clinic_memberships m
    join public.schedules s
      on s.clinic_id = m.clinic_id and s.doctor_id = m.doctor_id
     and s.day_of_week = extract(dow from p_date)::int and s.is_active
    where m.clinic_id = p_clinic and m.status = 'accepted'
      and not exists (
        select 1 from public.schedule_exceptions e
        where e.clinic_id = p_clinic and e.doctor_id = m.doctor_id
          and e.exception_date <= p_date and coalesce(e.end_date, e.exception_date) >= p_date
          and e.exception_type in ('full_day', 'multi_day')
      )
  );
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'reschedule_booking(uuid,date,time,uuid)',
    'sync_clinic_attendance(uuid)',
    'count_clinic_doctors_working(uuid,date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function private.process_clinic_attendance(uuid) from public, anon, authenticated;
