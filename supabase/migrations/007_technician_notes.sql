-- Blue Ridge Preservation Maintenance
-- Allow assigned technicians to edit technician notes while work is active.
-- Apply AFTER 006_server_email_notifications.sql.

begin;

create or replace function public.guard_blue_ridge_work_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $guard_technician_notes$
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

  -- Admins may manage work orders. Final closure is only allowed after
  -- technician completion has submitted the work for approval.
  if p.role = 'admin' then
    if new.status = 'Resolved'
       and old.status is distinct from 'Resolved'
       and old.status <> 'Pending Tiffany'
    then
      raise exception 'Work order must be submitted for admin approval before it can be closed';
    end if;

    return new;
  end if;

  -- Technicians may only update work orders assigned to their exact profile.
  if old.technician is distinct from p.full_name then
    raise exception 'Technician is not assigned to this work order';
  end if;

  -- Core request, assignment, admin, and routing fields remain immutable to technicians.
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

  -- Technician notes are editable only before the work is submitted for approval.
  if new.tech_note is distinct from old.tech_note then
    if old.status in ('Pending Tiffany','Resolved')
       or coalesce(old.tech_marked_done,false) = true
    then
      raise exception 'Technician notes are locked after work is submitted for approval';
    end if;

    if char_length(coalesce(new.tech_note,'')) > 2000 then
      raise exception 'Technician note must be 2000 characters or fewer';
    end if;
  end if;

  -- Technicians may only mark note visibility as unseen so admins can notice an update.
  if new.tech_note_seen is distinct from old.tech_note_seen
     and coalesce(new.tech_note_seen,false) <> false
  then
    raise exception 'Technicians cannot mark technician notes as reviewed';
  end if;

  -- The only status transition available to a technician is submission for admin approval.
  if new.status is distinct from old.status then
    if new.status <> 'Pending Tiffany' then
      raise exception 'Technicians may only submit completed work for admin verification';
    end if;

    if coalesce(new.tech_marked_done,false) <> true then
      raise exception 'Mark Work Done requires tech_marked_done=true';
    end if;
  end if;

  -- tech_marked_done may only move from false to true as part of the completion transition.
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
$guard_technician_notes$;

commit;
