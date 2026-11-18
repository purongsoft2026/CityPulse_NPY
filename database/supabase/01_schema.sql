-- ============================================================================
-- CityPulse Civic Platform — Supabase (PostgreSQL) Schema
-- Maps all 11 LocalDB collections + Google Drive API image references
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
do $$ begin
  create type complaint_status as enum ('pending', 'inprogress', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type complaint_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type poll_category as enum ('safety', 'traffic', 'environment', 'pedestrian');
exception when duplicate_object then null; end $$;

do $$ begin
  create type poll_vote_choice as enum ('agree', 'disagree');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comment_role as enum ('citizen', 'officer');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. CITIZENS & OFFICERS (Replaces: citypulse-citizen-accounts + officer-auth)
--    Passwords are managed by Supabase Auth (auth.users); never stored here.
-- ----------------------------------------------------------------------------
create table if not exists public.citizens (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text not null unique,
  phone text,
  home_province text not null default 'กรุงเทพมหานคร',
  avatar_pose text not null default 'default',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.officers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null,              -- e.g. 'super_admin', 'commander', 'officer'
  department_id text not null default 'all',
  badge_code text not null unique,
  avatar_pose text not null default '/images/mascot.png',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. COMPLAINTS (Replaces: complaint-map-data)
--    Images stored on Google Drive -> store File ID + accessible URL here.
-- ----------------------------------------------------------------------------
create table if not exists public.complaints (
  id text primary key default ('complaint-' || replace(gen_random_uuid()::text, '-', '')),
  title text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) between 1 and 3000),
  category_id text not null,
  status complaint_status not null default 'pending',
  priority complaint_priority not null default 'medium',

  -- Coordinates [lng, lat]
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),

  -- Reporter info
  reporter_name text not null default 'ไม่ระบุชื่อ',
  phone text,
  is_anonymous boolean not null default false,
  reporter_member_id uuid references public.citizens(id) on delete set null,

  -- Google Drive API Image Fields (Before & After Resolution)
  image_url text,                      -- e.g. '/api/drive/image/<fileId>' or Drive share URL
  image_drive_file_id text,            -- Google Drive file.id (used to delete/update file)
  image_name text,
  resolved_image_url text,             -- Resolution proof image URL
  resolved_image_drive_file_id text,   -- Google Drive file.id for resolution photo

  -- Routing & Location
  province text not null default 'กรุงเทพมหานคร',
  district text,
  department_id text not null default 'dept-public-works',
  assigned_officer text,

  -- Counters & Timestamps
  upvotes integer not null default 0 check (upvotes >= 0),
  created_at_label text,               -- Optional Thai display label e.g. '8 ก.ย. 2026'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_complaints_status on public.complaints(status);
create index if not exists idx_complaints_category on public.complaints(category_id);
create index if not exists idx_complaints_province on public.complaints(province);
create index if not exists idx_complaints_department on public.complaints(department_id);
create index if not exists idx_complaints_reporter on public.complaints(reporter_member_id);
create index if not exists idx_complaints_created_at on public.complaints(created_at desc);
create index if not exists idx_complaints_coords on public.complaints(lng, lat);

-- ----------------------------------------------------------------------------
-- 4. COMPLAINT TIMELINE (Nested `timeline` array in ComplaintReport)
-- ----------------------------------------------------------------------------
create table if not exists public.complaint_timeline (
  id text primary key default ('tl-' || replace(gen_random_uuid()::text, '-', '')),
  complaint_id text not null references public.complaints(id) on delete cascade,
  event_date text not null,
  event_time text not null,
  title text not null,
  description text not null,
  status complaint_status not null,
  officer text,
  icon text not null default 'inbox',
  created_at timestamptz not null default now()
);

create index if not exists idx_timeline_complaint on public.complaint_timeline(complaint_id, created_at asc);

-- ----------------------------------------------------------------------------
-- 5. COMPLAINT COMMENTS (Replaces: nested `comments` + civic-user-comments)
-- ----------------------------------------------------------------------------
create table if not exists public.complaint_comments (
  id text primary key default ('cmt-' || replace(gen_random_uuid()::text, '-', '')),
  complaint_id text not null references public.complaints(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author text not null,
  text text not null check (char_length(text) between 1 and 1500),
  role comment_role not null default 'citizen',
  created_at_label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_complaint on public.complaint_comments(complaint_id, created_at asc);
create index if not exists idx_comments_author on public.complaint_comments(author_id);

-- ----------------------------------------------------------------------------
-- 6. COMPLAINT UPVOTES (Replaces: complaint-user-upvotes)
-- ----------------------------------------------------------------------------
create table if not exists public.complaint_upvotes (
  complaint_id text not null references public.complaints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (complaint_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 7. CIVIC POLLS & POLL VOTES (Replaces: civic-community-polls, civic-user-poll-votes)
-- ----------------------------------------------------------------------------
create table if not exists public.civic_polls (
  id text primary key default ('poll-' || replace(gen_random_uuid()::text, '-', '')),
  title text not null check (char_length(title) between 1 and 250),
  description text not null,
  location_name text not null,
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  category poll_category not null,
  agree_count integer not null default 0 check (agree_count >= 0),
  disagree_count integer not null default 0 check (disagree_count >= 0),
  total_votes integer not null default 0 check (total_votes >= 0),
  proposal_by text not null,
  end_date text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poll_votes (
  poll_id text not null references public.civic_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote poll_vote_choice not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 8. DAILY CHECK-INS (Replaces: civic-user-checkins)
-- ----------------------------------------------------------------------------
create table if not exists public.citizen_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);

-- ----------------------------------------------------------------------------
-- 9. SYSTEM SETTINGS & USER PREFERENCES
--    (Replaces: citypulse-system-settings, complaint-map-theme, complaint-map-style)
-- ----------------------------------------------------------------------------
create table if not exists public.system_settings (
  id text primary key default 'global',
  platform_name text not null default 'CityPulse',
  default_map_style text not null default 'voyager',
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'ระบบกำลังบำรุงรักษาฐานข้อมูลชั่วคราว ขออภัยในความไม่สะดวก',
  allow_anonymous_reports boolean not null default true,
  auto_assign_department boolean not null default true,
  enable_air4thai_layer boolean not null default true,
  sla_default_hours integer not null default 48 check (sla_default_hours > 0),
  max_upload_size_mb integer not null default 5 check (max_upload_size_mb between 1 and 50),
  xp_rewards jsonb not null default '{
    "DAILY_CHECKIN": 15,
    "UPVOTE": 5,
    "COMMENT": 10,
    "POLL_VOTE": 20,
    "REPORT": 50,
    "PHOTO_BONUS": 25,
    "RESOLVED_BONUS": 100
  }'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  map_style text not null default 'voyager',
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. TRIGGERS: updated_at & Automatic Counter Synchronization
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_complaints_updated_at on public.complaints;
create trigger trg_complaints_updated_at
  before update on public.complaints
  for each row execute function public.set_updated_at();

drop trigger if exists trg_citizens_updated_at on public.citizens;
create trigger trg_citizens_updated_at
  before update on public.citizens
  for each row execute function public.set_updated_at();

drop trigger if exists trg_polls_updated_at on public.civic_polls;
create trigger trg_polls_updated_at
  before update on public.civic_polls
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.system_settings;
create trigger trg_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

-- Keep complaints.upvotes in sync with complaint_upvotes
create or replace function public.sync_complaint_upvote_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.complaints set upvotes = upvotes + 1 where id = new.complaint_id;
  elsif (tg_op = 'DELETE') then
    update public.complaints set upvotes = greatest(0, upvotes - 1) where id = old.complaint_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_complaint_upvotes on public.complaint_upvotes;
create trigger trg_sync_complaint_upvotes
  after insert or delete on public.complaint_upvotes
  for each row execute function public.sync_complaint_upvote_count();

-- Keep civic_polls counts in sync with poll_votes
create or replace function public.sync_poll_vote_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.civic_polls
      set agree_count = agree_count + case when new.vote = 'agree' then 1 else 0 end,
          disagree_count = disagree_count + case when new.vote = 'disagree' then 1 else 0 end,
          total_votes = total_votes + 1
      where id = new.poll_id;
  elsif (tg_op = 'DELETE') then
    update public.civic_polls
      set agree_count = greatest(0, agree_count - case when old.vote = 'agree' then 1 else 0 end),
          disagree_count = greatest(0, disagree_count - case when old.vote = 'disagree' then 1 else 0 end),
          total_votes = greatest(0, total_votes - 1)
      where id = old.poll_id;
  elsif (tg_op = 'UPDATE' and old.vote <> new.vote) then
    update public.civic_polls
      set agree_count = greatest(0, agree_count + case when new.vote = 'agree' then 1 else -1 end),
          disagree_count = greatest(0, disagree_count + case when new.vote = 'disagree' then 1 else -1 end)
      where id = new.poll_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_poll_votes on public.poll_votes;
create trigger trg_sync_poll_votes
  after insert or update or delete on public.poll_votes
  for each row execute function public.sync_poll_vote_counts();

