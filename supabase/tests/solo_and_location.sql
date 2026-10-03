-- Manual check: required center location, optional phone, solo practice.
-- Always ends with RAISE EXCEPTION (nothing persists); read the results text.
-- Note: pass typed/named args; untyped positional NULLs can resolve to the
-- disabled legacy onboard_clinic overload.
do $$
declare
  p uuid := gen_random_uuid(); d uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  v_spec uuid; v_solo uuid; v_center uuid; v_day date; v_n int; v_avail int; v_out text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (p, 'p@test.local', '{"full_name":"Client"}'), (d, 'd@test.local', '{"full_name":"Solo Specialist"}'),
    (d2, 'd2@test.local', '{"full_name":"Group Specialist"}'), (c, 'c@test.local', '{"full_name":"Center"}');
  select id into v_spec from public.specialties where name = 'القلب';
  v_day := private.algeria_now()::date + 8;
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  v_center := public.onboard_clinic(p_clinic_name => 'مركز النور', p_wilaya_id => 16::smallint,
    p_latitude => 36.75, p_longitude => 3.06, p_terms_version => '1', p_privacy_version => '1');
  v_out := v_out || 'center created without phone OK' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role','authenticated')::text, true);
  perform public.onboard_doctor(v_spec, 16::smallint, '1', '1');
  begin perform public.create_solo_practice(null::double precision, null::double precision);
  exception when others then v_out := v_out || 'solo w/o location -> ' || sqlerrm || E'\n'; end;
  v_solo := public.create_solo_practice(36.7, 3.1);
  begin perform public.create_solo_practice(36.7, 3.1);
  exception when others then v_out := v_out || 'second solo -> ' || sqlerrm || E'\n'; end;
  insert into public.schedules (clinic_id, doctor_id, day_of_week, start_time, end_time, appointment_duration_minutes)
  values (v_solo, d, extract(dow from v_day)::int, '09:00', '12:00', 30);

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role','authenticated')::text, true);
  begin perform public.create_solo_practice(36.7, 3.1);
  exception when others then v_out := v_out || 'center creating solo -> ' || sqlerrm || E'\n'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  perform public.onboard_patient('1', '1');
  select count(*) filter (where available) into v_avail from public.get_available_slots(v_solo, d, v_day);
  v_out := v_out || 'available slots at solo practice=' || v_avail || ' (expect 6)' || E'\n';
  perform public.create_booking(d, v_solo, v_day, '09:00');
  v_out := v_out || 'client booked solo specialist OK' || E'\n';

  perform set_config('request.jwt.claims', json_build_object('sub', d2, 'role','authenticated')::text, true);
  perform public.onboard_doctor(v_spec, 16::smallint, '1', '1');
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
  select count(*) into v_n from public.get_available_slots(v_solo, d2, v_day);
  v_out := v_out || 'other doctor at solo practice slots=' || v_n || ' (expect 0)' || E'\n';

  execute 'reset role';
  raise exception E'RESULTS (rolled back):\n%', v_out;
end $$;
