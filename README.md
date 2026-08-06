# Project Control Hub — Phase 1

Project + Task control system for IT & Construction teams. This is the Phase 1
scaffold: Authentication, Project CRUD, Task CRUD, My Work.

## Tech stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Auth), Row Level Security enforced at the DB layer
- Hosting target: Vercel

## 1. Create a Supabase project

1. Go to https://supabase.com → New Project.
2. Once created, open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql` (schema + RLS policies)
   - `supabase/migrations/0002_fixes_from_phase1_testing.sql` (locks down `progress_calculated` from manual edits, extends the audit trigger, de-dupes templates, adds a uniqueness guard)
   - `supabase/seed.sql` (optional — 2 starter templates: IT + Construction)
3. Go to **Authentication → Providers** and make sure Email is enabled.
4. Go to **Project Settings → API** and copy the `Project URL` and `anon public` key.

## 2. Configure environment variables

```bash
cp .env.example .env.local
# then fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 3. Create your first Admin user

Supabase Auth creates every new signup as `role = 'member'` by default
(see the `handle_new_user` trigger in the migration). To make yourself Admin:

1. Phase 1 has no public self-signup page — create the first user directly in
   **Supabase Dashboard → Authentication → Users → Add User** (set email +
   password, confirm email).
2. In **SQL Editor**, run:
   ```sql
   update public.users set role = 'admin' where email = 'you@company.com';
   ```
3. Add the other 4 team members the same way (Dashboard → Add User). They'll
   default to `member`.

> A self-signup / invite flow can be added in a later phase if needed.

## 4. Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`.

## 5. Deploy

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add the two env vars from `.env.local` in Vercel → Project Settings → Environment Variables.
4. Deploy.

## What's in Phase 1 vs. later phases

**Included:** Auth (login/forgot/reset password), per-project membership +
RLS, Project CRUD with auto-generated `project_code`, template-based task
generation, Task CRUD with role-based edit rules, My Work view, audit trail
for status/assignee/due-date/budget changes, calculated project progress.

**Deliberately out of scope for Phase 1**: Gantt, Resource Workload/Capacity,
Budget Forecast & Alerts, Executive Dashboard, Weighted Progress,
Notifications, AI Advisor. The schema already has tables reserved for these
(`resource_calendar`, `budgets`, `risks`, `milestones`, `task_dependencies`)
so later phases are additive, not a rewrite.

## Database schema

See `supabase/migrations/0001_init.sql` — fully commented, includes RLS
policies enforcing:
- Admin sees/edits everything.
- Members see only projects they're a member of (`project_members`).
- A task can be edited by: Admin, the task's assignee, or the project's PM.
- Project deletion is Admin-only and soft (`is_archived`), not a hard delete.
