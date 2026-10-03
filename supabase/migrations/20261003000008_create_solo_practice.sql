-- A specialist who works alone gets a personal center so patients can book them.
create function public.create_solo_practice(
  p_latitude double precision,
  p_longitude double precision,
  p_name text default null,
  p_phone text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_doctor public.doctors%rowtype;
  v_clinic uuid;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'location_required';
  end if;
  select * into v_profile from public.profiles where id = v_uid and is_active;
  if not found or v_profile.role <> 'doctor' then
    raise exception 'forbidden';
  end if;
  select * into v_doctor from public.doctors where id = v_uid;
  if not found or v_doctor.wilaya_id is null then
    raise exception 'wilaya_required';
  end if;
  if exists (select 1 from public.clinics where owner_id = v_uid and is_solo) then
    raise exception 'already_exists';
  end if;

  insert into public.clinics (owner_id, name, wilaya_id, latitude, longitude, phone, address, is_solo)
  values (
    v_uid,
    coalesce(nullif(btrim(p_name), ''), v_profile.full_name),
    v_doctor.wilaya_id, p_latitude, p_longitude,
    nullif(btrim(p_phone), ''), nullif(btrim(p_address), ''), true
  )
  returning id into v_clinic;

  insert into public.clinic_memberships (clinic_id, doctor_id, requested_by, status, accepted_at)
  values (v_clinic, v_uid, 'doctor', 'accepted', now());
  insert into public.clinic_settings (user_id, clinic_id) values (v_uid, v_clinic)
  on conflict (user_id) do nothing;
  return v_clinic;
end;
$$;

revoke all on function public.create_solo_practice(double precision, double precision, text, text, text) from public, anon;
grant execute on function public.create_solo_practice(double precision, double precision, text, text, text) to authenticated;
