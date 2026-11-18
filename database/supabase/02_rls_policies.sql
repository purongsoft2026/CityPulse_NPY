-- ============================================================================
-- CityPulse Civic Platform — Supabase Row Level Security (RLS) Policies
-- Run AFTER 01_schema.sql in Supabase SQL Editor
-- ============================================================================

-- Helper functions (security definer so they can inspect officers safely)
create or replace function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.officers where id = (select auth.uid())
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.officers
    where id = (select auth.uid()) and is_super_admin = true
  );
$$;

-- Enable RLS on every table
alter table public.citizens enable row level security;
alter table public.officers enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_timeline enable row level security;
alter table public.complaint_comments enable row level security;
alter table public.complaint_upvotes enable row level security;
alter table public.civic_polls enable row level security;
alter table public.poll_votes enable row level security;
alter table public.citizen_checkins enable row level security;
alter table public.system_settings enable row level security;
alter table public.user_preferences enable row level security;

-- ----------------------------------------------------------------------------
-- 1. CITIZENS
-- ----------------------------------------------------------------------------
drop policy if exists "citizens_select_own_or_officer" on public.citizens;
create policy "citizens_select_own_or_officer" on public.citizens
  for select using (
    id = (select auth.uid()) or public.is_officer()
  );

drop policy if exists "citizens_insert_own" on public.citizens;
create policy "citizens_insert_own" on public.citizens
  for insert with check (
    id = (select auth.uid())
  );

drop policy if exists "citizens_update_own" on public.citizens;
create policy "citizens_update_own" on public.citizens
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. OFFICERS
-- ----------------------------------------------------------------------------
drop policy if exists "officers_select_self_or_officer" on public.officers;
create policy "officers_select_self_or_officer" on public.officers
  for select using (
    id = (select auth.uid()) or public.is_officer()
  );

drop policy if exists "officers_manage_super_admin" on public.officers;
create policy "officers_manage_super_admin" on public.officers
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. COMPLAINTS
-- ----------------------------------------------------------------------------
drop policy if exists "complaints_public_read" on public.complaints;
create policy "complaints_public_read" on public.complaints
  for select using (true);

-- Citizens (or anonymous if allowed by system_settings) can insert pending complaints
drop policy if exists "complaints_insert_citizen_or_anon" on public.complaints;
create policy "complaints_insert_citizen_or_anon" on public.complaints
  for insert with check (
    status = 'pending'
    and upvotes = 0
    and (
      ((select auth.uid()) is not null and (reporter_member_id is null or reporter_member_id = (select auth.uid())))
      or (
        (select auth.uid()) is null
        and exists (
          select 1 from public.system_settings
          where id = 'global' and allow_anonymous_reports = true
        )
      )
    )
  );

-- Only officers can update status/priority/department/resolved photo
drop policy if exists "complaints_update_officer" on public.complaints;
create policy "complaints_update_officer" on public.complaints
  for update using (public.is_officer())
  with check (public.is_officer());

drop policy if exists "complaints_delete_super_admin" on public.complaints;
create policy "complaints_delete_super_admin" on public.complaints
  for delete using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 4. COMPLAINT TIMELINE
-- ----------------------------------------------------------------------------
drop policy if exists "timeline_public_read" on public.complaint_timeline;
create policy "timeline_public_read" on public.complaint_timeline
  for select using (true);

drop policy if exists "timeline_officer_write" on public.complaint_timeline;
create policy "timeline_officer_write" on public.complaint_timeline
  for all using (public.is_officer())
  with check (public.is_officer());

-- ----------------------------------------------------------------------------
-- 5. COMPLAINT COMMENTS
-- ----------------------------------------------------------------------------
drop policy if exists "comments_public_read" on public.complaint_comments;
create policy "comments_public_read" on public.complaint_comments
  for select using (true);

drop policy if exists "comments_authenticated_insert" on public.complaint_comments;
create policy "comments_authenticated_insert" on public.complaint_comments
  for insert with check (
    (select auth.uid()) is not null
    and author_id = (select auth.uid())
    and (
      (role = 'citizen')
      or (role = 'officer' and public.is_officer())
    )
  );

drop policy if exists "comments_delete_owner_or_officer" on public.complaint_comments;
create policy "comments_delete_owner_or_officer" on public.complaint_comments
  for delete using (
    author_id = (select auth.uid()) or public.is_officer()
  );

-- ----------------------------------------------------------------------------
-- 6. COMPLAINT UPVOTES
-- ----------------------------------------------------------------------------
drop policy if exists "upvotes_public_read" on public.complaint_upvotes;
create policy "upvotes_public_read" on public.complaint_upvotes
  for select using (true);

drop policy if exists "upvotes_insert_own" on public.complaint_upvotes;
create policy "upvotes_insert_own" on public.complaint_upvotes
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "upvotes_delete_own" on public.complaint_upvotes;
create policy "upvotes_delete_own" on public.complaint_upvotes
  for delete using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. CIVIC POLLS & POLL VOTES
-- ----------------------------------------------------------------------------
drop policy if exists "polls_public_read" on public.civic_polls;
create policy "polls_public_read" on public.civic_polls
  for select using (true);

drop policy if exists "polls_officer_manage" on public.civic_polls;
create policy "polls_officer_manage" on public.civic_polls
  for all using (public.is_officer())
  with check (public.is_officer());

drop policy if exists "poll_votes_select_own" on public.poll_votes;
create policy "poll_votes_select_own" on public.poll_votes
  for select using (user_id = (select auth.uid()) or public.is_officer());

drop policy if exists "poll_votes_insert_own" on public.poll_votes;
create policy "poll_votes_insert_own" on public.poll_votes
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "poll_votes_update_own" on public.poll_votes;
create policy "poll_votes_update_own" on public.poll_votes
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 8. DAILY CHECK-INS
-- ----------------------------------------------------------------------------
drop policy if exists "checkins_own" on public.citizen_checkins;
create policy "checkins_own" on public.citizen_checkins
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 9. SYSTEM SETTINGS & USER PREFERENCES
-- ----------------------------------------------------------------------------
drop policy if exists "settings_public_read" on public.system_settings;
create policy "settings_public_read" on public.system_settings
  for select using (true);

drop policy if exists "settings_admin_write" on public.system_settings;
create policy "settings_admin_write" on public.system_settings
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "user_preferences_own" on public.user_preferences;
create policy "user_preferences_own" on public.user_preferences
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

