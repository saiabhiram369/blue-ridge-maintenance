-- Blue Ridge Preservation Maintenance
-- Admin completion notifications + fallback admin approval.
-- Apply AFTER 004_name_pin_only.sql.

begin;

create extension if not exists pgcrypto;

-- All admins may perform final verification/closure.
update public.profiles
set can_resolve = (role = 'admin'),
    updated_at = now();

-- Replace the prior "Tiffany only" database guard.
create or replace function public.guard_blue_ridge_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $guard_admin_fallback$
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

  -- Any authenticated admin may manage work orders.
  -- Final closure is allowed only after technician completion submitted it for approval.
  if p.role = 'admin' then
    if new.status = 'Resolved'
       and old.status is distinct from 'Resolved'
       and old.status <> 'Pending Tiffany'
    then
      raise exception 'Work order must be submitted for admin approval before it can be closed';
    end if;

    return new;
  end if;

  -- Technician must already be assigned to this exact work order.
  if old.technician is distinct from p.full_name then
    raise exception 'Technician is not assigned to this work order';
  end if;

  -- Technician may only perform the completion transition.
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

  if new.status is distinct from old.status then
    if new.status <> 'Pending Tiffany' then
      raise exception 'Technicians may only submit completed work for admin verification';
    end if;

    if coalesce(new.tech_marked_done,false) <> true then
      raise exception 'Mark Work Done requires tech_marked_done=true';
    end if;
  end if;

  if old.tech_marked_done = true
     and coalesce(new.tech_marked_done,false) = false
  then
    raise exception 'Technicians cannot reopen completed work';
  end if;

  return new;
end;
$guard_admin_fallback$;

-- Persistent admin notification queue.
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  event_type text not null
    check (event_type in ('technician_completed','needs_assignment')),
  title text not null,
  message text not null,
  technician text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists idx_admin_notifications_open_event
  on public.admin_notifications(ticket_id,event_type)
  where closed_at is null;

create index if not exists idx_admin_notifications_created
  on public.admin_notifications(created_at desc);

create table if not exists public.admin_notification_reads (
  notification_id uuid not null
    references public.admin_notifications(id) on delete cascade,
  admin_id uuid not null
    references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id,admin_id)
);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;

drop policy if exists "admins read notifications" on public.admin_notifications;
drop policy if exists "admins read own notification receipts" on public.admin_notification_reads;
drop policy if exists "admins mark own notifications read" on public.admin_notification_reads;

create policy "admins read notifications"
on public.admin_notifications
for select
to authenticated
using (public.current_profile_role() = 'admin');

create policy "admins read own notification receipts"
on public.admin_notification_reads
for select
to authenticated
using (
  admin_id = auth.uid()
  and public.current_profile_role() = 'admin'
);

create policy "admins mark own notifications read"
on public.admin_notification_reads
for insert
to authenticated
with check (
  admin_id = auth.uid()
  and public.current_profile_role() = 'admin'
);

revoke all on public.admin_notifications from anon;
revoke all on public.admin_notifications from authenticated;
grant select on public.admin_notifications to authenticated;

revoke all on public.admin_notification_reads from anon;
revoke all on public.admin_notification_reads from authenticated;
grant select,insert on public.admin_notification_reads to authenticated;

-- Create/close notification records from work-order transitions.
create or replace function public.queue_blue_ridge_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $notification_trigger$
begin
  if (
    coalesce(new.tech_marked_done,false) = true
    and coalesce(old.tech_marked_done,false) = false
  ) or (
    new.status = 'Pending Tiffany'
    and old.status is distinct from 'Pending Tiffany'
  ) then
    insert into public.admin_notifications(
      ticket_id,event_type,title,message,technician
    )
    select
      new.ticket_id,
      'technician_completed',
      'Work ready for verification',
      coalesce(new.technician,'Technician')
        || ' marked this work order done. Tiffany is the primary reviewer; any admin may verify and close it if needed.',
      new.technician
    where not exists (
      select 1
      from public.admin_notifications n
      where n.ticket_id = new.ticket_id
        and n.event_type = 'technician_completed'
        and n.closed_at is null
    );
  end if;

  if new.status = 'Resolved'
     and old.status is distinct from 'Resolved'
  then
    update public.admin_notifications
    set closed_at = now()
    where ticket_id = new.ticket_id
      and closed_at is null;
  end if;

  return new;
end;
$notification_trigger$;

drop trigger if exists trg_queue_blue_ridge_admin_notification
on public.maintenance_requests;

create trigger trg_queue_blue_ridge_admin_notification
after update
on public.maintenance_requests
for each row
execute function public.queue_blue_ridge_admin_notification();

-- Backfill notifications for work already waiting on admin verification.
insert into public.admin_notifications(
  ticket_id,event_type,title,message,technician
)
select
  mr.ticket_id,
  'technician_completed',
  'Work ready for verification',
  coalesce(mr.technician,'Technician')
    || ' marked this work order done. Tiffany is the primary reviewer; any admin may verify and close it if needed.',
  mr.technician
from public.maintenance_requests mr
where mr.status = 'Pending Tiffany'
  and not exists (
    select 1
    from public.admin_notifications n
    where n.ticket_id = mr.ticket_id
      and n.event_type = 'technician_completed'
      and n.closed_at is null
  );

-- Enable Realtime for live admin bell updates.
do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_notifications'
  ) then
    alter publication supabase_realtime
      add table public.admin_notifications;
  end if;
end;
$realtime$;

commit;
