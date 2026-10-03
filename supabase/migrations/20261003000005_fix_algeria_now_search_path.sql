create or replace function private.algeria_now()
returns timestamp
language sql stable
set search_path = ''
as $$ select now() at time zone 'Africa/Algiers' $$;
