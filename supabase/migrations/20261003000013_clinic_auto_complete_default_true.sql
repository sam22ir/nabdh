-- Past in-room appointments complete automatically unless a center turns it off
-- (same default as the previous backend).
alter table public.clinic_settings alter column auto_complete_appointments set default true;
