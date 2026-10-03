-- Same as set_booking_status in migration 4, with the no-show notification type
-- renamed to booking_no_show (what the app and the old backend used).
create or replace function public.set_booking_status(p_booking uuid, p_status public.booking_status)
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
      v_b.patient_id, 'booking_no_show', 'تم تسجيل غيابك',
      format('تم تسجيل غيابك عن موعد %s الساعة %s', v_b.appointment_date, to_char(v_b.appointment_time, 'HH24:MI')),
      jsonb_build_object('bookingId', p_booking)
    );
  end if;
end;
$$;
