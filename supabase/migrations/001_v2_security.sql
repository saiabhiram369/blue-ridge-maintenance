-- Blue Ridge Work Orders V2 security and audit foundation
-- Review in Supabase SQL editor before applying to production.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'technician' check (role in ('admin','technician')),
  can_resolve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_order_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.work_order_activity enable row level security;
alter table public.maintenance_requests enable row level security;

create or replace function public.current_profile()
returns public.profiles
language sql stable security definer
set search_path = public
as $$
  select p from public.profiles p where p.id = auth.uid();
$$;

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "public submit maintenance request" on public.maintenance_requests;
create policy "public submit maintenance request"
on public.maintenance_requests for insert to anon
with check (
  status = 'Open'
  and technician is null
  and supervisor is null
  and admin_note is null
  and tech_note is null
);

drop policy if exists "authenticated read permitted work orders" on public.maintenance_requests;
create policy "authenticated read permitted work orders"
on public.maintenance_requests for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or technician = (select p.full_name from public.profiles p where p.id = auth.uid())
);

drop policy if exists "authenticated update permitted work orders" on public.maintenance_requests;
create policy "authenticated update permitted work orders"
on public.maintenance_requests for update to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or technician = (select p.full_name from public.profiles p where p.id = auth.uid())
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or technician = (select p.full_name from public.profiles p where p.id = auth.uid())
);

create or replace function public.guard_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then
    raise exception 'Authentication required';
  end if;

  if p.role = 'admin' then
    if new.status = 'Resolved' and old.status is distinct from 'Resolved' and not p.can_resolve then
      raise exception 'This account is not authorized to resolve work orders';
    end if;
    return new;
  end if;

  if old.technician is distinct from p.full_name then
    raise exception 'Technician is not assigned to this work order';
  end if;

  if new.ticket_id is distinct from old.ticket_id
    or new.name is distinct from old.name
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.category is distinct from old.category
    or new.location is distinct from old.location
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.priority is distinct from old.priority
    or new.original_priority is distinct from old.original_priority
    or new.priority_overridden is distinct from old.priority_overridden
    or new.supervisor is distinct from old.supervisor
    or new.technician is distinct from old.technician
    or new.admin_note is distinct from old.admin_note
  then
    raise exception 'Technicians may only update progress fields on assigned work orders';
  end if;

  if new.status is distinct from old.status and new.status <> 'Pending Tiffany' then
    raise exception 'Technicians may only move work orders to Pending Tiffany';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_work_order_update on public.maintenance_requests;
create trigger trg_guard_work_order_update
before update on public.maintenance_requests
for each row execute function public.guard_work_order_update();

create or replace function public.log_work_order_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_order_activity(ticket_id,actor_id,event_type,note)
    values (new.ticket_id,auth.uid(),'created','Work order created');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.work_order_activity(ticket_id,actor_id,event_type,note,metadata)
      values (new.ticket_id,auth.uid(),'status_changed','Status changed',jsonb_build_object('from',old.status,'to',new.status));
    end if;
    if new.technician is distinct from old.technician then
      insert into public.work_order_activity(ticket_id,actor_id,event_type,note,metadata)
      values (new.ticket_id,auth.uid(),'assignment_changed','Technician assignment changed',jsonb_build_object('from',old.technician,'to',new.technician));
    end if;
    if new.tech_note is distinct from old.tech_note and new.tech_note is not null then
      insert into public.work_order_activity(ticket_id,actor_id,event_type,note)
      values (new.ticket_id,auth.uid(),'technician_note',new.tech_note);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_work_order_activity on public.maintenance_requests;
create trigger trg_log_work_order_activity
after insert or update on public.maintenance_requests
for each row execute function public.log_work_order_activity();

drop policy if exists "authenticated read activity" on public.work_order_activity;
create policy "authenticated read activity"
on public.work_order_activity for select to authenticated
using (
  exists (
    select 1 from public.maintenance_requests mr
    where mr.ticket_id = work_order_activity.ticket_id
      and (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        or mr.technician = (select p.full_name from public.profiles p where p.id = auth.uid())
      )
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,email,full_name,role)
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,'User'),'@',1)),
    coalesce(new.raw_user_meta_data->>'role','technician')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- After creating your real admin accounts, designate resolver(s), for example:
-- update public.profiles set role='admin', can_resolve=true where email='tiffany@yourdomain.org';

-- Optional storage hardening. Requires bucket maintenance-photos to already exist.
drop policy if exists "public upload maintenance photos" on storage.objects;
create policy "public upload maintenance photos"
on storage.objects for insert to anon
with check (bucket_id = 'maintenance-photos');

drop policy if exists "authenticated read maintenance photos" on storage.objects;
create policy "authenticated read maintenance photos"
on storage.objects for select to authenticated
using (bucket_id = 'maintenance-photos');
