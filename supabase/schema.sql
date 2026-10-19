-- Tamil Self-Report Agent Study — schema v2
-- Adds: real username/password accounts (resumable across sessions),
-- a normalized question bank (instruments + questions), and responses
-- that reference questions by foreign key. Run this in a FRESH Supabase
-- project's SQL editor (or drop the v1 tables first if reusing a project).

-- ============================================================
-- 0. Auth setup note
-- ============================================================
-- Supabase Auth needs an email format. We map a chosen username to
-- "{username}@tamilstudy.local" client-side (see lib/auth.js) so
-- participants only ever see/enter a plain username + password.
-- IMPORTANT: in Supabase Dashboard → Authentication → Providers → Email,
-- turn OFF "Confirm email" (fake local addresses can't receive mail).

-- ============================================================
-- 1. Participants (one row per auth user, same id as auth.users)
-- ============================================================
create table if not exists participants (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now(),
  consented boolean not null default false,
  consented_at timestamptz,
  demographics jsonb,
  demographics_done boolean not null default false
);

-- ============================================================
-- 2. Instruments (the sections: interview, GSS, BFI, econ games, etc.)
-- ============================================================
create table if not exists instruments (
  id bigint generated always as identity primary key,
  slug text unique not null,          -- e.g. 'interview', 'gss', 'bfi', 'econ_games', 'behavioral_games'
  name_tamil text not null,
  name_english text not null,
  kind text not null,                 -- 'audio_interview' | 'survey'
  order_index int not null default 0,
  is_active boolean not null default true
);

-- ============================================================
-- 3. Questions (shared bank; every participant answers against the
--    same rows, joined via foreign key — this is the "separate question
--    section" you asked for, so answers reference a single source of truth)
-- ============================================================
create table if not exists questions (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references instruments(id) on delete cascade,
  question_key text not null,         -- stable slug, e.g. 'trust_general'
  section text,                       -- sub-section label within the instrument
  type text not null,                 -- 'likert5' | 'single_choice' | 'numeric'
                                       -- | 'slider' | 'binary_choice' | 'audio'
  prompt_tamil text,                  -- optional until translated; UI falls back to prompt_english
  prompt_english text,
  options jsonb,                      -- shape depends on `type`, see README
  condition jsonb,                    -- optional {"field":"work_status","in":[...]} checked against participants.demographics
  order_index int not null default 0,
  is_active boolean not null default true,
  unique (instrument_id, question_key)
);

-- ============================================================
-- 4. Responses to survey-type questions (GSS, BFI, econ/behavioral games)
-- ============================================================
create table if not exists responses (
  id bigint generated always as identity primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  question_id bigint not null references questions(id) on delete cascade,
  answer_value text not null,
  answered_at timestamptz not null default now(),
  unique (participant_id, question_id)
);

-- ============================================================
-- 5. Audio interview recordings (questions of type 'audio' in `questions`)
-- ============================================================
create table if not exists interview_recordings (
  id bigint generated always as identity primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  question_id bigint not null references questions(id) on delete cascade,
  storage_path text not null,         -- path inside 'interview-audio' bucket
  duration_seconds numeric,
  transcript text,                    -- filled in later by offline STT pass
  recorded_at timestamptz not null default now(),
  unique (participant_id, question_id)
);

-- ============================================================
-- 6. Storage bucket for audio (private)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('interview-audio', 'interview-audio', false)
on conflict (id) do nothing;

-- ============================================================
-- 7. Row Level Security — now backed by real auth, so we can scope
--    everything to auth.uid() instead of allowing open anon writes.
-- ============================================================
alter table participants enable row level security;
alter table instruments enable row level security;
alter table questions enable row level security;
alter table responses enable row level security;
alter table interview_recordings enable row level security;

-- participants: a user can only see/edit their own row
create policy "own participant row - select" on participants
  for select using (auth.uid() = id);
create policy "own participant row - insert" on participants
  for insert with check (auth.uid() = id);
create policy "own participant row - update" on participants
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- instruments & questions: readable by any signed-in participant,
-- never writable from the client (you manage the question bank via the
-- SQL editor / seed script with the service role)
create policy "instruments readable by signed-in users" on instruments
  for select using (auth.role() = 'authenticated');
create policy "questions readable by signed-in users" on questions
  for select using (auth.role() = 'authenticated');

-- responses: a participant can only read/write their own answers
create policy "own responses - select" on responses
  for select using (auth.uid() = participant_id);
create policy "own responses - insert" on responses
  for insert with check (auth.uid() = participant_id);
create policy "own responses - update" on responses
  for update using (auth.uid() = participant_id) with check (auth.uid() = participant_id);

-- interview_recordings: same pattern
create policy "own recordings - select" on interview_recordings
  for select using (auth.uid() = participant_id);
create policy "own recordings - insert" on interview_recordings
  for insert with check (auth.uid() = participant_id);
create policy "own recordings - update" on interview_recordings
  for update using (auth.uid() = participant_id) with check (auth.uid() = participant_id);

-- ============================================================
-- 8. Storage policies — folder-scoped to the participant's own id, so
--    audio for participant A can never be read/written by participant B.
--    Files must be uploaded as: {participant_id}/{question_id}.webm
-- ============================================================
create policy "own audio - insert" on storage.objects
  for insert with check (
    bucket_id = 'interview-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own audio - select" on storage.objects
  for select using (
    bucket_id = 'interview-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own audio - update" on storage.objects
  for update using (
    bucket_id = 'interview-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
