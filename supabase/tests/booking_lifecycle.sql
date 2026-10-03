-- Manual check: reschedule, automatic attendance, clinic counters.
-- Always ends with RAISE EXCEPTION (nothing persists); read the results text.
do $$
declare
  p uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); d uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  v_spec uuid; v_clinic uuid; v_day date; v_b uuid; v_out text := ''; v_res jsonb; v_dow int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (p, 'p@test.local', '{"full_name":"Client"}'), (p2, 'p2@test.local', '{"full_name":"Other"}'),
    (d, 'd@test.local', '{"full_name":"Specialist"}'), (c, 'c@test.local', '{"full_name":"Center"}');
  select id into v_spec from public.specialties where name = 'القلب';
  v_day := private.algeria_now()::date + 8;
  v_dow := extract(dow from v_day)::int;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  v_clinic := public.onboard_clinic(p_clinic_name => 'مركز', p_wilaya_id => 16::smallint, p_latitude => 36.7, p_longitude => 3.0, p_terms_version => '1', p_privacy_version => '1');
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role','authenticated')::text, true);
  perform public.onboard_doctor(v_spec, 16::smallint, '1', '1');
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  perform public.onboard_patient('1', '1');
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role','authenticated')::text, true);
  perform public.onboard_patient('1', '1');

  execute 'reset role';
  insert into public.clinic_memberships (clinic_id, doctor_id, requested_by, status, accepted_at) values (v_clinic, d, 'clinic', 'accepted', now());
  insert into public.schedules (clinic_id, doctor_id, day_of_week, start_time, end_time, appointment_duration_minutes)
    values (v_clinic, d, v_dow, '09:00', '12:00', 30);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  v_out := v_out || 'working on scheduled day=' || public.count_clinic_doctors_working(v_clinic, v_day) || ' (expect 1)' || E'\n';
  v_out := v_out || 'working on unscheduled day=' || public.count_clinic_doctors_working(v_clinic, v_day + 1) || ' (expect 0)' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  v_b := public.create_booking(d, v_clinic, v_day, '09:00');
  perform public.reschedule_booking(v_b, v_day, '10:30'::time);
  v_out := v_out || 'rescheduled to ' || (select appointment_time::text from public.bookings where id = v_b) || ' (expect 10:30:00)' || E'\n';
  begin perform public.reschedule_booking(v_b, v_day, '13:00'::time);
  exception when others then v_out := v_out || 'outside schedule -> ' || sqlerrm || E'\n'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', p2, 'role','authenticated')::text, true);
  begin perform public.reschedule_booking(v_b, v_day, '11:00'::time);
  exception when others then v_out := v_out || 'other client reschedules -> ' || sqlerrm || E'\n'; end;

  execute 'reset role';
  insert into public.bookings (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, appointment_duration, status) values
    (p, d, v_clinic, v_day - 20, '09:00', 30, 'confirmed'),
    (p, d, v_clinic, v_day - 20, '10:00', 30, 'present'),
    (p, d, v_clinic, v_day - 20, '11:00', 30, 'in_room');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  v_res := public.sync_clinic_attendance(v_clinic);
  v_out := v_out || 'attendance ' || v_res::text || ' (expect completed 2, no_show 1)' || E'\n';

  execute 'reset role';
  raise exception E'RESULTS (rolled back):\n%', v_out;
end $$;
