-- Blue Ridge Preservation Maintenance
-- Production security migration for the EXISTING maintenance_requests table.
-- This does not delete or recreate existing work orders.
-- Apply in Supabase SQL Editor as one transaction.

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 1. AUTHORIZED USER PROFILES
-- ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'technician'
    check (role in ('admin','technician')),
  can_resolve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper functions are SECURITY DEFINER so RLS policies do not recursively
-- query the profiles policy itself.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_profile_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_profile_can_resolve()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.can_resolve,false)
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_profile_role() from public;
revoke all on function public.current_profile_name() from public;
revoke all on function public.current_profile_can_resolve() from public;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_name() to authenticated;
grant execute on function public.current_profile_can_resolve() to authenticated;

-- Remove any existing profile policies before defining the production ones.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

create policy "profiles read own or admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_profile_role() = 'admin'
);

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- Deterministic account provisioning.
-- Known management accounts become admins.
-- Tiffany is the only resolver.
create or replace function public.handle_blue_ridge_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email,''));
  resolved_role text;
  resolved_can_resolve boolean;
  resolved_name text;
begin
  resolved_role :=
    case
      when normalized_email in (
        'abhiram@artoflivingretreat.org',
        'tiffany@artoflivingretreat.org',
        'catherine@artoflivingretreat.org',
        'corey@artoflivingretreat.org'
      ) then 'admin'
      else 'technician'
    end;

  resolved_can_resolve :=
    normalized_email = 'tiffany@artoflivingretreat.org';

  resolved_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    split_part(coalesce(new.email,'User'),'@',1)
  );

  insert into public.profiles (
    id,email,full_name,role,can_resolve,updated_at
  )
  values (
    new.id,
    coalesce(new.email,''),
    resolved_name,
    resolved_role,
    resolved_can_resolve,
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    can_resolve = excluded.can_resolve,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_blue_ridge_auth_user_created on auth.users;
create trigger on_blue_ridge_auth_user_created
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.handle_blue_ridge_auth_user();

-- Backfill profiles for any Auth users that already exist.
insert into public.profiles (
  id,email,full_name,role,can_resolve
)
select
  u.id,
  coalesce(u.email,''),
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    split_part(coalesce(u.email,'User'),'@',1)
  ),
  case
    when lower(coalesce(u.email,'')) in (
      'abhiram@artoflivingretreat.org',
      'tiffany@artoflivingretreat.org',
      'catherine@artoflivingretreat.org',
      'corey@artoflivingretreat.org'
    ) then 'admin'
    else 'technician'
  end,
  lower(coalesce(u.email,'')) = 'tiffany@artoflivingretreat.org'
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  can_resolve = excluded.can_resolve,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────
-- 2. WORK ORDER ACTIVITY / AUDIT HISTORY
-- ─────────────────────────────────────────────────────────────

create table if not exists public.work_order_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.work_order_activity enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='work_order_activity'
  loop
    execute format(
      'drop policy if exists %I on public.work_order_activity',
      p.policyname
    );
  end loop;
end $$;

create policy "activity read permitted work orders"
on public.work_order_activity
for select
to authenticated
using (
  public.current_profile_role() = 'admin'
  or exists (
    select 1
    from public.maintenance_requests mr
    where mr.ticket_id = work_order_activity.ticket_id
      and mr.technician = public.current_profile_name()
  )
);

revoke all on public.work_order_activity from anon;
revoke all on public.work_order_activity from authenticated;
grant select on public.work_order_activity to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. MAINTENANCE REQUEST RLS
-- ─────────────────────────────────────────────────────────────

alter table public.maintenance_requests enable row level security;

-- Remove ALL old policies on this table so no legacy permissive policy
-- becomes active after RLS is enabled.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='maintenance_requests'
  loop
    execute format(
      'drop policy if exists %I on public.maintenance_requests',
      p.policyname
    );
  end loop;
end $$;

-- Public request form: allow CREATE only.
-- The checks mirror the current React PublicRequest payload.
create policy "public submit maintenance request"
on public.maintenance_requests
for insert
to anon, authenticated
with check (
  status = 'Open'
  and technician is null
  and supervisor is null
  and admin_note is null
  and tech_note is null
  and updated_by is null
  and override_message is null
  and coalesce(priority_overridden,false) = false
  and coalesce(tech_marked_done,false) = false
  and coalesce(tech_note_seen,true) = true
  and original_priority = priority
  and nullif(btrim(coalesce(name,'')),'') is not null
  and nullif(btrim(coalesce(email,'')),'') is not null
  and nullif(btrim(coalesce(category,'')),'') is not null
  and nullif(btrim(coalesce(location,'')),'') is not null
  and nullif(btrim(coalesce(title,'')),'') is not null
  and nullif(btrim(coalesce(description,'')),'') is not null
  and priority in ('Low','Medium','High','Urgent')
);

-- Admins see all work orders.
-- Technicians see only work orders assigned to their exact profile full_name.
create policy "authenticated read permitted work orders"
on public.maintenance_requests
for select
to authenticated
using (
  public.current_profile_role() = 'admin'
  or technician = public.current_profile_name()
);

-- Update row scope. Detailed field restrictions are enforced by trigger below.
create policy "authenticated update permitted work orders"
on public.maintenance_requests
for update
to authenticated
using (
  public.current_profile_role() = 'admin'
  or technician = public.current_profile_name()
)
with check (
  public.current_profile_role() = 'admin'
  or technician = public.current_profile_name()
);

-- Explicit table privileges.
revoke all on public.maintenance_requests from anon;
revoke all on public.maintenance_requests from authenticated;

grant insert on public.maintenance_requests to anon;
grant insert, select, update on public.maintenance_requests to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. ENFORCE ADMIN / TECHNICIAN WORKFLOW
-- ─────────────────────────────────────────────────────────────

create or replace function public.guard_blue_ridge_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select *
  into p
  from public.profiles
  where id = auth.uid();

  if p.id is null then
    raise exception 'Authentication required';
  end if;

  -- Admin permissions.
  if p.role = 'admin' then
    if new.status = 'Resolved'
       and old.status is distinct from 'Resolved'
       and not p.can_resolve
    then
      raise exception 'Only Tiffany is authorized to resolve and close work orders';
    end if;

    return new;
  end if;

  -- Technician must already be assigned to this exact work order.
  if old.technician is distinct from p.full_name then
    raise exception 'Technician is not assigned to this work order';
  end if;

  -- Technician may not change request, assignment, priority, admin fields,
  -- requester details, or closure state.
  if new.id is distinct from old.id
    or new.ticket_id is distinct from old.ticket_id
    or new.timestamp is distinct from old.timestamp
    or new.name is distinct from old.name
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.category is distinct from old.category
    or new.location is distinct from old.location
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.priority is distinct from old.priority
    or new.admin_note is distinct from old.admin_note
    or new.supervisor is distinct from old.supervisor
    or new.technician is distinct from old.technician
    or new.photos is distinct from old.photos
    or new.original_priority is distinct from old.original_priority
    or new.priority_overridden is distinct from old.priority_overridden
    or new.override_message is distinct from old.override_message
    or new.tech_note is distinct from old.tech_note
  then
    raise exception 'Technicians may only mark assigned work as done';
  end if;

  -- A technician can only move an unfinished ticket to Pending Tiffany.
  if new.status is distinct from old.status then
    if new.status <> 'Pending Tiffany' then
      raise exception 'Technicians may only move work orders to Pending Tiffany';
    end if;

    if coalesce(new.tech_marked_done,false) <> true then
      raise exception 'Mark Work Done requires tech_marked_done=true';
    end if;
  end if;

  -- Technicians cannot clear their completed flag once set.
  if old.tech_marked_done = true
     and coalesce(new.tech_marked_done,false) = false
  then
    raise exception 'Technicians cannot reopen completed work';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_blue_ridge_work_order_update
on public.maintenance_requests;

create trigger trg_guard_blue_ridge_work_order_update
before update
on public.maintenance_requests
for each row
execute function public.guard_blue_ridge_work_order_update();

-- ─────────────────────────────────────────────────────────────
-- 5. ACTIVITY LOGGING
-- ─────────────────────────────────────────────────────────────

create or replace function public.log_blue_ridge_work_order_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_activity (
      ticket_id,actor_id,event_type,note
    )
    values (
      new.ticket_id,auth.uid(),'created','Work order created'
    );

  elsif tg_op = 'UPDATE' then

    if new.status is distinct from old.status then
      insert into public.work_order_activity (
        ticket_id,actor_id,event_type,note,metadata
      )
      values (
        new.ticket_id,
        auth.uid(),
        'status_changed',
        'Status changed',
        jsonb_build_object(
          'from',old.status,
          'to',new.status
        )
      );
    end if;

    if new.technician is distinct from old.technician then
      insert into public.work_order_activity (
        ticket_id,actor_id,event_type,note,metadata
      )
      values (
        new.ticket_id,
        auth.uid(),
        'assignment_changed',
        'Technician assignment changed',
        jsonb_build_object(
          'from',old.technician,
          'to',new.technician
        )
      );
    end if;

    if new.admin_note is distinct from old.admin_note
       and new.admin_note is not null
    then
      insert into public.work_order_activity (
        ticket_id,actor_id,event_type,note
      )
      values (
        new.ticket_id,
        auth.uid(),
        'admin_note',
        new.admin_note
      );
    end if;

    if new.tech_marked_done is distinct from old.tech_marked_done
       and new.tech_marked_done = true
    then
      insert into public.work_order_activity (
        ticket_id,actor_id,event_type,note
      )
      values (
        new.ticket_id,
        auth.uid(),
        'technician_completed',
        'Technician marked work done'
      );
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_blue_ridge_work_order_activity
on public.maintenance_requests;

create trigger trg_log_blue_ridge_work_order_activity
after insert or update
on public.maintenance_requests
for each row
execute function public.log_blue_ridge_work_order_activity();

-- ─────────────────────────────────────────────────────────────
-- 6. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────

create index if not exists idx_maintenance_requests_status
  on public.maintenance_requests(status);

create index if not exists idx_maintenance_requests_technician
  on public.maintenance_requests(technician);

create index if not exists idx_maintenance_requests_timestamp
  on public.maintenance_requests(timestamp desc);

create index if not exists idx_work_order_activity_ticket
  on public.work_order_activity(ticket_id,created_at desc);

commit;
