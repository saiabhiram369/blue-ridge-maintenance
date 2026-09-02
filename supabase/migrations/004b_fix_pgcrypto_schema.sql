-- Hotfix for Supabase pgcrypto extension schema.
-- Run after 004_name_pin_only.sql if configure_staff_pin reports gen_salt does not exist.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.configure_staff_pin(
  p_display_name text,
  p_role text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $configure_name_pin$
begin
  if p_role not in ('admin','technician') then
    raise exception 'Role must be admin or technician';
  end if;

  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must contain exactly 4 digits';
  end if;

  update public.staff_pin_directory
  set
    pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
    active = true,
    failed_attempts = 0,
    locked_until = null,
    updated_at = now()
  where lower(display_name) = lower(btrim(p_display_name))
    and role = p_role;

  if not found then
    insert into public.staff_pin_directory (
      display_name,
      role,
      pin_hash,
      active,
      failed_attempts,
      locked_until,
      updated_at
    )
    values (
      btrim(p_display_name),
      p_role,
      extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
      true,
      0,
      null,
      now()
    );
  end if;
end;
$configure_name_pin$;

revoke all on function public.configure_staff_pin(text,text,text) from public;
revoke all on function public.configure_staff_pin(text,text,text) from anon;
revoke all on function public.configure_staff_pin(text,text,text) from authenticated;

create or replace function public.verify_staff_pin(
  p_display_name text,
  p_role text,
  p_pin text
)
returns table(
  staff_id uuid,
  auth_user_id uuid,
  display_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $verify_name_pin$
declare
  row_data public.staff_pin_directory;
begin
  if p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select *
  into row_data
  from public.staff_pin_directory
  where lower(staff_pin_directory.display_name) = lower(btrim(p_display_name))
    and staff_pin_directory.role = p_role
    and active = true
  for update;

  if row_data.id is null then
    perform pg_sleep(0.35);
    return;
  end if;

  if row_data.locked_until is not null
     and row_data.locked_until > now()
  then
    return;
  end if;

  if extensions.crypt(p_pin, row_data.pin_hash) <> row_data.pin_hash then
    update public.staff_pin_directory
    set
      failed_attempts = failed_attempts + 1,
      locked_until = case
        when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else locked_until
      end,
      updated_at = now()
    where id = row_data.id;

    return;
  end if;

  update public.staff_pin_directory
  set
    failed_attempts = 0,
    locked_until = null,
    updated_at = now()
  where id = row_data.id;

  staff_id := row_data.id;
  auth_user_id := row_data.auth_user_id;
  display_name := row_data.display_name;
  role := row_data.role;
  return next;
end;
$verify_name_pin$;

revoke all on function public.verify_staff_pin(text,text,text) from public;
revoke all on function public.verify_staff_pin(text,text,text) from anon;
revoke all on function public.verify_staff_pin(text,text,text) from authenticated;
grant execute on function public.verify_staff_pin(text,text,text) to service_role;
