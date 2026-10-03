-- NOT YET APPLIED to the nabdh project: the MCP migration tool holds statements
-- containing DELETE for human confirmation. Run this file once in the Supabase
-- dashboard (SQL editor), then it is live. Until then the app's "delete account"
-- button shows an error.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Tell clients whose upcoming appointments disappear with this account.
  insert into public.notifications (user_id, type, title, body, data)
  select b.patient_id, 'booking_cancelled', 'تم إلغاء موعدك',
         format('تم إلغاء موعد %s الساعة %s بسبب حذف حساب مقدم الخدمة', b.appointment_date, to_char(b.appointment_time, 'HH24:MI')),
         jsonb_build_object('bookingId', b.id)
  from public.bookings b
  where b.status in ('confirmed', 'present')
    and (b.appointment_date + b.appointment_time) > private.algeria_now()
    and b.patient_id <> v_uid
    and (b.doctor_id = v_uid
         or b.clinic_id in (select c.id from public.clinics c where c.owner_id = v_uid));

  -- Removes the profile and, through cascades, every row that belongs to it.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
