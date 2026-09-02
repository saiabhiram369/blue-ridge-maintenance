-- Blue Ridge Preservation Maintenance
-- Restore server-side email workflow support + new-request admin notifications.
-- Apply AFTER 005_admin_notifications_fallback_approval.sql.

begin;

-- Extend notification queue to include newly submitted requests.
alter table public.admin_notifications
  drop constraint if exists admin_notifications_event_type_check;

alter table public.admin_notifications
  add constraint admin_notifications_event_type_check
  check (event_type in ('new_request','technician_completed','needs_assignment'));

-- Delivery log prevents accidental duplicate email sends for the same workflow event.
create table if not exists public.email_notification_log (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  event_type text not null
    check (event_type in ('new_request','technician_completed','requester_resolved')),
  delivered_at timestamptz not null default now(),
  provider text not null default 'emailjs',
  unique (ticket_id,event_type)
);

alter table public.email_notification_log enable row level security;
revoke all on public.email_notification_log from public;
revoke all on public.email_notification_log from anon;
revoke all on public.email_notification_log from authenticated;

-- New request => admin bell notification.
-- Technician completion => admin approval notification.
-- Resolution => close active admin notifications.
create or replace function public.queue_blue_ridge_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $notification_trigger$
begin
  if tg_op = 'INSERT' then
    insert into public.admin_notifications(
      ticket_id,event_type,title,message,technician
    )
    select
      new.ticket_id,
      'new_request',
      'New maintenance request',
      coalesce(new.name,'Requester')
        || ' submitted a '
        || coalesce(new.priority,'')
        || ' priority request for '
        || coalesce(new.location,'the facility')
        || '.',
      null
    where not exists (
      select 1
      from public.admin_notifications n
      where n.ticket_id = new.ticket_id
        and n.event_type = 'new_request'
        and n.closed_at is null
    );

    return new;
  end if;

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
after insert or update
on public.maintenance_requests
for each row
execute function public.queue_blue_ridge_admin_notification();

commit;
