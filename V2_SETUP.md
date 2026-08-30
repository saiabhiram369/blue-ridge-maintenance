# Blue Ridge V2 setup

The branch **v2/glass-work-order-platform** is a parallel rebuild. Do not merge it to production until the checklist below is complete.

## 1. Vercel environment variables

Set these on the V2 preview deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Without them, protected routes automatically render demo data. You can also force demo mode with `/admin?demo=1`.

## 2. Apply the Supabase migration

Review and run:

`supabase/migrations/001_v2_security.sql`

This creates:
- authenticated profiles
- admin/technician roles
- resolver permission
- work-order activity log
- RLS policies
- server-side update guard
- audit triggers

## 3. Create Supabase Auth users

Create accounts for administrators and technicians in Supabase Authentication. Then update their profiles:

```sql
update public.profiles
set role = 'admin', can_resolve = true
where email = 'YOUR_RESOLVER_EMAIL';

update public.profiles
set role = 'admin'
where email in ('ADMIN_EMAIL_1','ADMIN_EMAIL_2');

update public.profiles
set role = 'technician'
where email in ('TECH_EMAIL_1','TECH_EMAIL_2');
```

## 4. Routes

- `/` — public work-order request
- `/request` — public work-order request
- `/admin` — protected operations command center
- `/tech` — protected operations command center; technician RLS limits rows to assigned work
- `/app` — protected operations command center

## 5. Current compatibility

V2 still reads and writes the existing `maintenance_requests` table, so current tickets are preserved.

## Before merge

- Validate RLS in Supabase with one admin and one technician test account.
- Confirm public photo upload policy matches your privacy requirements.
- Replace any public photo bucket with signed URLs if maintenance photos may contain sensitive information.
- Configure server-side email notifications (recommended next milestone).
- Run `npm run build` and mobile/desktop acceptance testing.
