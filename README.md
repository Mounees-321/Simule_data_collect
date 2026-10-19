# Tamil Self-Report Agent Study — Data Collection System (v2)

A free-tier data collection system for a final-year project replicating
"LLM Agents Grounded in Self-Reports" (Park et al.) for a Tamil-speaking
population.

## v3.1 frontend

- Mobile-first layout, large tap targets, sticky Back/Next bar, bilingual (Tamil / English) labels, Noto Sans Tamil font.
- Interview: microphone test with live level meter, big record button with level meter and time bar (15 s minimum marked, auto-stop at 60 s), each take uploads the moment it stops (3 automatic retries, then a Retry button), warning before closing the tab mid-recording, screen stays awake while recording, batch dots and break screens.
- Surveys and games: answers save on every Next with a clear error if saving fails; keys 1 to 9 pick an option and Enter continues; game amounts are validated whole numbers.
- Offline banner on every page; dashboard shows overall progress, an "Up next" button and refreshes when the tab regains focus.
- Sign-up validates usernames (English letters, numbers, _ . - only) because usernames become internal login addresses.
- Test checklist before real use: sign up on a phone, run the mic test, record one answer, close the tab and log back in, confirm the row appears in `interview_recordings` and the file in the `interview-audio` bucket.

## v3 updates

- **Question bank rebuilt from `scripts/questions.json`** (single source of truth): 50 interview prompts, 42 GSS items, 44 BFI items, 5 behavioral games (6 rows incl. the Game 5 "why"). Edit the JSON, run `python3 scripts/build_seed.py`, and paste `supabase/seed.sql` into the Supabase SQL editor. Re-running is safe: questions update in place, old ones are deactivated, nothing is deleted.
- **Interview = 5 batches x 10 questions**, each answer 15 to 60 seconds. Stop is disabled until 15 s; recording auto-stops at 60 s; playback and re-record before saving; a break screen appears between batches.
- **Demographics = D1 to D8** (collected once, stored in `participants.demographics`). Together with the 42 GSS items that is the 50-item GSS.
- **Conditional items**: SATJOB and RICHWORK are shown only to people whose `work_status` is employed or self-employed. Dashboard totals respect this.
- **Games**: amounts are whole-number inputs in range (also a slider); Game 5 stores `A` or `B` plus a free-text reason. Analysis coding: Game 5 `B` = cooperative (1), `A` = self-interested (0). Normalized game scores = amount / `normalize_by` (stored in each question's `options`).
- **Prompts**: interview prompts live in `prompt_tamil` (Tanglish). GSS, BFI and games are English in `prompt_english` until Tamil translations are added; the UI shows whichever exists.
- BFI items ending in `_r` in `question_key` are reverse-scored.
- `scripts/build_gss_pdf.py` regenerates the GSS questions PDF.
- Copy `.env.local.example` to `.env.local` and fill it in. Never commit or share `.env.local`.

## What's new in v2 vs. the first version

- **Real accounts.** Participants sign up with a username + password and can
  log out and log back in to continue later — nothing has to be finished in
  one sitting. (Under the hood this uses Supabase Auth; a username is mapped
  to a fake local email address so participants never see or need a real
  email.)
- **Normalized question bank.** All questions — interview prompts, GSS,
  BFI, economic games, behavioral games — live in two shared tables,
  `instruments` (the sections) and `questions` (one row per question, each
  tagged with its `instrument_id`). Every participant's answer references a
  question by **foreign key** (`responses.question_id` /
  `interview_recordings.question_id`), so the question bank is a single
  source of truth shared across all participants, not duplicated per person.
- **Five sections**, matching the paper's instruments: Audio interview, GSS,
  BFI (personality), Economic games, Behavioral games. Each is its own
  "instrument" row and can be resumed independently.
- **Resumable everywhere.** A dashboard shows progress per section
  (`done / total`), and each section (survey or interview) resumes at the
  first unanswered question, not from the start.
- **~30 minutes of audio per participant**, spread across ~15 predefined
  interview questions rather than one long recording — keeps files small
  (WebM/Opus) and gives natural resume points.

## Stack (unchanged, still free)

- **Supabase** (Postgres + Auth + Storage) — free tier
- **Next.js**, deployable free on **Vercel**

---

## Setup

### A. Create the Supabase project
1. https://supabase.com → New project (free tier).
2. SQL editor → run `supabase/schema.sql` (tables, RLS, storage bucket).
3. SQL editor → run `supabase/seed.sql` (instruments + starter questions).
4. **Authentication → Providers → Email → turn OFF "Confirm email."**
   Usernames are mapped to fake `@tamilstudy.local` addresses that can't
   receive a real confirmation email, so sign-up would otherwise get stuck.
5. Copy your Project URL + anon key from Settings → API.

### B. Configure and run the app
```bash
cd tamil-agent-study-v2
cp .env.local.example .env.local
# paste your Supabase URL + anon key
npm install
npm run dev
```

### C. Deploy free
Push to GitHub → import into Vercel (free tier) → add the two env vars →
deploy.

---

## How data is organized

```
participants          — one row per account (id = auth.users.id), username,
                         consent, demographics JSON, onboarding flags
instruments            — the 5 sections (interview, gss, bfi, econ_games,
                         behavioral_games)
questions               — every question, tagged with instrument_id, type,
                         Tamil/English prompt, options
responses               — participant_id + question_id (FK) + answer_value
                         → survey/game answers
interview_recordings    — participant_id + question_id (FK) + storage_path
                         + duration + transcript (filled in later by an
                         offline STT pass)
```

Row Level Security is scoped to `auth.uid()`, so each participant can only
read/write their own rows and their own audio files — verified both at the
database level and in Storage (audio must be uploaded under
`{participant_id}/{question_id}.webm`).

## Editing the question bank

Everything is data, not code — add, disable, or reorder questions by editing
rows in the `questions` table (via the Supabase dashboard or more `INSERT`
statements following the pattern in `supabase/seed.sql`). Supported `type`
values and their `options` shape:

| type | options shape | used for |
|---|---|---|
| `likert5` | `["label1", ..., "label5"]` | GSS/BFI-style agreement scales |
| `single_choice` | `["opt1", "opt2", ...]` | categorical items |
| `numeric` | `null` | hours worked, age, etc. |
| `slider` | `{min,max,step,unit,left_label,right_label}` | economic game allocations |
| `binary_choice` | `{left:{tamil,english,value}, right:{...}}` | forced-choice game decisions |
| `audio` | `null` | interview prompts (recorded, not typed) |

## ⚠️ Copyright reminder (same as v1)

GSS and BFI-44 item wordings are copyrighted instruments — the seeded
`gss`/`bfi` questions are placeholders showing the data shape only. Replace
them with a licensed/openly-published Tamil translation, or your own
construct-matched items, before real data collection, and note whichever you
used in your project writeup.

## Storage budget note

~30 minutes of Opus-compressed speech per participant is roughly 12–18 MB.
Supabase's free 1 GB Storage tier comfortably holds audio for 50+
participants at that length — a good fit for a class project.

## Next step (not part of this app)

Offline batch scripts for: transcribing stored audio (free/open Tamil STT),
generating expert reflections, and building/evaluating the generative
agents themselves. Keep these as separate scripts using the Supabase
**service role key**, run outside the live participant-facing app.
