-- Manual end-to-end check for onboarding, RLS and the booking engine.
-- Run against a scratch/dev project with the SQL editor or the MCP execute_sql
-- tool. It always ends with RAISE EXCEPTION, so nothing is persisted; the
-- error message lists the results. Expected values are in the output text.
do $$
declare
  p uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  v_spec uuid; v_clinic uuid; v_day date; v_booking uuid; v_b2 uuid;
  v_out text := ''; v_n int; v_slots int; v_avail int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (p, 'p@test.local', '{"full_name":"Test Patient"}'),
    (p2, 'p2@test.local', '{"name":"Other Patient"}'),
    (d, 'd@test.local', '{"full_name":"Test Specialist"}'),
    (d2, 'd2@test.local', '{"full_name":"Other Specialist"}'),
    (c, 'c@test.local', '{"full_name":"Test Center Owner"}');
  select id into v_spec from public.specialties where name = 'القلب';
  v_day := private.algeria_now()::date + 8;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform public.onboard_patient('2026-07-11', '2026-07-11');
  begin perform public.onboard_patient('2026-07-11', '2026-07-11');
  exception when others then v_out := v_out || 'double onboard -> ' || sqlerrm || E'\n'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  perform public.onboard_patient('2026-07-11', '2026-07-11', null, '0555000111');
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  perform public.onboard_doctor(v_spec, 16::smallint, '2026-07-11', '2026-07-11');
  perform set_config('request.jwt.claims', json_build_object('sub', d2, 'role', 'authenticated')::text, true);
  perform public.onboard_doctor(v_spec, 31::smallint, '2026-07-11', '2026-07-11');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  v_clinic := public.onboard_clinic('مركز النور', 16::smallint, '0555123456', '2026-07-11', '2026-07-11');

  execute 'reset role';
  insert into public.clinic_memberships (clinic_id, doctor_id, requested_by, status, accepted_at)
  values (v_clinic, d, 'clinic', 'accepted', now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  insert into public.schedules (clinic_id, doctor_id, day_of_week, start_time, end_time, appointment_duration_minutes)
  values (v_clinic, d, extract(dow from v_day)::int, '09:00', '12:00', 30);
  begin
    insert into public.schedules (clinic_id, doctor_id, day_of_week, start_time, end_time, appointment_duration_minutes)
    values (v_clinic, d2, 1, '09:00', '12:00', 30);
  exception when others then v_out := v_out || 'non-member schedule blocked -> ' || sqlerrm || E'\n'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  select count(*), count(*) filter (where available) into v_slots, v_avail
    from public.get_available_slots(v_clinic, d, v_day);
  v_out := v_out || 'slots=' || v_slots || ' available=' || v_avail || ' (expect 6/6)' || E'\n';
  v_booking := public.create_booking(d, v_clinic, v_day, '09:30');
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role', 'authenticated')::text, true);
  begin perform public.create_booking(d, v_clinic, v_day, '09:30');
  exception when others then v_out := v_out || 'same slot -> ' || sqlerrm || E'\n'; end;
  begin perform public.create_booking(d, v_clinic, v_day, '09:15');
  exception when others then v_out := v_out || 'off-grid slot -> ' || sqlerrm || E'\n'; end;
  begin perform public.create_booking(d2, v_clinic, v_day, '10:00');
  exception when others then v_out := v_out || 'non-member doctor -> ' || sqlerrm || E'\n'; end;
  v_b2 := public.create_booking(d, v_clinic, v_day, '10:00');

  select count(*) into v_n from public.bookings;
  v_out := v_out || 'p2 sees bookings=' || v_n || ' (expect 1)' || E'\n';
  select count(*) into v_n from public.profile_private where user_id = p;
  v_out := v_out || 'p2 reads p private=' || v_n || ' (expect 0)' || E'\n';
  begin insert into public.bookings (patient_id, doctor_id, clinic_id, appointment_date, appointment_time)
        values (p2, d, v_clinic, v_day, '11:00');
  exception when others then v_out := v_out || 'direct insert booking -> ' || sqlerrm || E'\n'; end;
  begin update public.profiles set role = 'doctor' where id = p2;
  exception when others then v_out := v_out || 'self-promote role -> ' || sqlerrm || E'\n'; end;
  begin perform public.cancel_booking(v_booking);
  exception when others then v_out := v_out || 'cancel other''s booking -> ' || sqlerrm || E'\n'; end;
  begin perform public.set_booking_status(v_b2, 'present');
  exception when others then v_out := v_out || 'patient sets status -> ' || sqlerrm || E'\n'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.bookings;
  v_out := v_out || 'doctor sees bookings=' || v_n || ' (expect 2)' || E'\n';
  perform public.set_booking_status(v_booking, 'present');
  perform public.set_booking_status(v_booking, 'in_room');
  perform public.set_booking_status(v_booking, 'completed');
  begin perform public.set_booking_status(v_booking, 'present');
  exception when others then v_out := v_out || 'completed -> present -> ' || sqlerrm || E'\n'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', d2, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.bookings;
  v_out := v_out || 'unrelated doctor sees bookings=' || v_n || ' (expect 0)' || E'\n';

  execute 'reset role';
  raise exception E'RESULTS (rolled back):\n%', v_out;
end $$;
