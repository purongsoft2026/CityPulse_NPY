create table if not exists public.maps_agency_referrals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.maps_reports(id) on delete cascade,
  agency text not null check (char_length(agency) between 1 and 180),
  email text check (char_length(email) <= 254),
  note text not null default '' check (char_length(note) <= 1500),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists maps_agency_referrals_report_idx
  on public.maps_agency_referrals (report_id, created_at desc);
alter table public.maps_agency_referrals enable row level security;
revoke all on public.maps_agency_referrals from public, anon, authenticated;
grant select, insert, update on public.maps_agency_referrals to service_role;
