alter table public.clinics add column is_solo boolean not null default false;
alter table public.clinics alter column phone drop not null;
alter table public.clinics alter column latitude set not null;
alter table public.clinics alter column longitude set not null;
create unique index clinics_one_solo_per_owner on public.clinics (owner_id) where is_solo;
