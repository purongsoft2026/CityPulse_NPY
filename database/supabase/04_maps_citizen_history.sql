alter table public.maps_reports
  add column if not exists citizen_user_id uuid references auth.users(id) on delete set null,
  add column if not exists audit_context jsonb;

create index if not exists maps_reports_citizen_history_idx
  on public.maps_reports (citizen_user_id, created_at desc, id desc)
  where citizen_user_id is not null;

create table if not exists public.maps_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null,
  status text not null,
  citizen_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  context jsonb,
  occurred_at timestamptz not null default now()
);
alter table public.maps_report_events enable row level security;
revoke all on public.maps_report_events from public, anon, authenticated;
grant select, insert on public.maps_report_events to service_role;
grant usage on sequence public.maps_report_events_id_seq to service_role;

create or replace function public.maps_record_report_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.maps_report_events (report_id, status, citizen_user_id, event_type, context)
    values (
      new.id, new.status, new.citizen_user_id,
      case when tg_op = 'INSERT' then 'submitted' else 'status_changed' end,
      case when tg_op = 'INSERT' then new.audit_context end
    );
    if tg_op = 'INSERT' and new.audit_context is not null then
      update public.maps_reports set audit_context = null where id = new.id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.maps_record_report_event() from public, anon, authenticated;
grant execute on function public.maps_record_report_event() to service_role;

create trigger maps_report_event_after_change
after insert or update of status on public.maps_reports
for each row execute function public.maps_record_report_event();
