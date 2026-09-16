-- Blue Ridge Preservation Maintenance
-- Ongoing technician notes + admin hold/parts workflow.
-- Apply AFTER 006_server_email_notifications.sql.
-- This migration is safe to apply whether or not 007_technician_notes.sql was already applied.

begin;

-- Allow a dedicated admin notification type for technician note updates.
alter table public.admin_notifications
  drop constraint if exists admin_notifications_event_type_check;

alter table public.admin_notifications
  add constraint admin_notifications_event_type_check
  check (event_type in (
    'new_request',
    'technician_completed',
    'technician_note_updated',
    'needs_assignment'
  ));

-- Technicians may keep updating their note for the entire active lifecycle.
-- Notes become read-only only after final resolution.
-- If an admin sends a completed ticket back to active work / On Hold,
-- reset tech_marked_done so the technician can later submit it for review again.
create or replace function public.guard_blue_ridge_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $guard_technician_note_hold_workflow$
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

  if p.role = 'admin' then
    if new.status = 'Resolved'
       and old.status is distinct from 'Resolved'
       and old.status <> 'Pending Tiffany'
    then
      raise exception 'Work order must be submitted for admin approval before it can be closed';
    end if;

    -- A ticket moved out of Pending Tiffany is active again.
    -- This is the parts / additional-work workflow.
    if old.status = 'Pending Tiffany'
       and new.status in ('Open','In Progress','On Hold')
    then
      new.tech_marked_done := false;
    end if;

    return new;
  end if;

  if old.technician is distinct from p.full_name then
    raise exception 'Technician is not assigned to this work order';
  end if;

  -- Technicians may update only their note / note attention state,
  -- or submit the assigned work for admin review.
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
  then
    raise exception 'Technicians may only update their technician note or mark assigned work as done';
  end if;

  if new.tech_note is distinct from old.tech_note then
    if old.status = 'Resolved' then
      raise exception 'Technician notes are read-only after the work order is resolved';
    end if;

    if char_length(coalesce(new.tech_note,'')) > 2000 then
      raise exception 'Technician note must be 2000 characters or fewer';
    end if;
  end if;

  -- Saving a technician note marks it as needing admin attention.
  if new.tech_note_seen is distinct from old.tech_note_seen
     and coalesce(new.tech_note_seen,false) <> false
  then
    raise exception 'Technicians cannot mark technician notes as reviewed';
  end if;

  -- A technician can only move a ticket to Pending Tiffany.
  if new.status is distinct from old.status then
    if new.status <> 'Pending Tiffany' then
      raise exception 'Technicians may only submit completed work for admin verification';
    end if;

    if coalesce(new.tech_marked_done,false) <> true then
      raise exception 'Mark Work Done requires tech_marked_done=true';
    end if;
  end if;

  if new.tech_marked_done is distinct from old.tech_marked_done then
    if coalesce(new.tech_marked_done,false) <> true
       or new.status <> 'Pending Tiffany'
    then
      raise exception 'Technicians may only mark assigned work as done';
    end if;
  end if;

  if old.tech_marked_done = true
     and coalesce(new.tech_marked_done,false) = false
  then
    raise exception 'Technicians cannot reopen completed work';
  end if;

  return new;
end;
$guard_technician_note_hold_workflow$;

-- Extend the persistent notification workflow.
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

  -- Every technician-note change creates a fresh unread admin notification.
  -- Close the previous note-update notification first so each new update gets a new id.
  if new.tech_note is distinct from old.tech_note then
    update public.admin_notifications
    set closed_at = now()
    where ticket_id = new.ticket_id
      and event_type = 'technician_note_updated'
      and closed_at is null;

    insert into public.admin_notifications(
      ticket_id,event_type,title,message,technician
    )
    values (
      new.ticket_id,
      'technician_note_updated',
      'Technician note updated',
      coalesce(new.technician,'Technician')
        || case
          when nullif(btrim(coalesce(new.tech_note,'')),'') is null
            then ' cleared the technician note.'
          else ' updated the technician note: '
            || left(regexp_replace(new.tech_note, E'[\\n\\r\\t]+', ' ', 'g'), 260)
        end,
      new.technician
    );

    insert into public.work_order_activity(
      ticket_id,actor_id,event_type,note,metadata
    )
    values (
      new.ticket_id,
      auth.uid(),
      'technician_note_updated',
      nullif(btrim(coalesce(new.tech_note,'')),''),
      jsonb_build_object('technician',new.technician,'status',new.status)
    );
  end if;

  -- Technician completion => admin approval notification.
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
        || ' marked this work order ready for review. Tiffany can close it or place it on hold if parts or additional work are needed.',
      new.technician
    where not exists (
      select 1
      from public.admin_notifications n
      where n.ticket_id = new.ticket_id
        and n.event_type = 'technician_completed'
        and n.closed_at is null
    );
  end if;

  -- Admin sent the ticket back to active work / On Hold.
  -- Close the prior completion notification and permit a future completion email.
  if old.status = 'Pending Tiffany'
     and new.status in ('Open','In Progress','On Hold')
  then
    update public.admin_notifications
    set closed_at = now()
    where ticket_id = new.ticket_id
      and event_type = 'technician_completed'
      and closed_at is null;

    update public.admin_notifications
    set closed_at = now()
    where ticket_id = new.ticket_id
      and event_type = 'technician_note_updated'
      and closed_at is null;

    delete from public.email_notification_log
    where ticket_id = new.ticket_id
      and event_type = 'technician_completed';
  end if;

  -- Final resolution closes every active admin notification for this ticket.
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

-- Keep the trigger on both INSERT and UPDATE.
drop trigger if exists trg_queue_blue_ridge_admin_notification
on public.maintenance_requests;

create trigger trg_queue_blue_ridge_admin_notification
after insert or update
on public.maintenance_requests
for each row
execute function public.queue_blue_ridge_admin_notification();

commit;
