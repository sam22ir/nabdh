-- The old signature (no location) is disabled rather than dropped; remove it
-- with `drop function public.onboard_clinic(text, smallint, text, text, text, text);`
-- when convenient. The new overload requires a location and makes phone optional.
create or replace function public.onboard_clinic(
  p_clinic_name text, p_wilaya_id smallint, p_phone text,
  p_terms_version text, p_privacy_version text, p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'deprecated: use onboard_clinic with latitude and longitude';
end;
$$;
revoke all on function public.onboard_clinic(text, smallint, text, text, text, text) from public, anon, authenticated;

create function public.onboard_clinic(
  p_clinic_name text,
  p_wilaya_id smallint,
  p_latitude double precision,
  p_longitude double precision,
  p_terms_version text,
  p_privacy_version text,
  p_phone text default null,
  p_address text default null,
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
  if p_latitude is null or p_longitude is null then
    raise exception 'location_required';
  end if;
  v_uid := private.create_profile(
    'clinic', coalesce(p_full_name, p_clinic_name), p_phone, p_terms_version, p_privacy_version
  );
  insert into public.clinics (owner_id, name, wilaya_id, latitude, longitude, phone, address)
  values (v_uid, btrim(p_clinic_name), p_wilaya_id, p_latitude, p_longitude,
          nullif(btrim(p_phone), ''), nullif(btrim(p_address), ''))
  returning id into v_clinic;
  insert into public.clinic_settings (user_id, clinic_id) values (v_uid, v_clinic);
  return v_clinic;
end;
$$;

revoke all on function public.onboard_clinic(text, smallint, double precision, double precision, text, text, text, text, text) from public, anon;
grant execute on function public.onboard_clinic(text, smallint, double precision, double precision, text, text, text, text, text) to authenticated;
