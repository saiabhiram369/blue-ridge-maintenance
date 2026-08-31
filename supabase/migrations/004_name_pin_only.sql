-- Blue Ridge Preservation Maintenance
-- Name + PIN only staff provisioning.
-- Apply AFTER 003_secure_pin_login.sql.
-- Staff never need an email/password. Internal Supabase identities are created
-- automatically by the pin-login Edge Function after a successful PIN check.

begin;

create extension if not exists pgcrypto;

create table if not exists public.staff_pin_directory (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null check (role in ('admin','technician')),
  pin_hash text not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_staff_pin_directory_name_role
  on public.staff_pin_directory (lower(display_name), role);

alter table public.staff_pin_directory enable row level security;

revoke all on public.staff_pin_directory from public;
revoke all on public.staff_pin_directory from anon;
revoke all on public.staff_pin_directory from authenticated;

-- Configure/rotate a PIN using only display name + role + 4-digit code.
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
    crypt(p_pin, gen_salt('bf', 12)),
    true,
    0,
    null,
    now()
  )
  on conflict (lower(display_name), role)
  do update set
    pin_hash = excluded.pin_hash,
    active = true,
    failed_attempts = 0,
    locked_until = null,
    updated_at = now();
end;
$configure_name_pin$;

revoke all on function public.configure_staff_pin(text,text,text) from public;
revoke all on function public.configure_staff_pin(text,text,text) from anon;
revoke all on function public.configure_staff_pin(text,text,text) from authenticated;

-- Verify a staff PIN. Only service_role may execute this function.
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

  if crypt(p_pin, row_data.pin_hash) <> row_data.pin_hash then
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

-- Edge Function uses this after it creates the hidden internal Supabase identity.
create or replace function public.attach_staff_auth_identity(
  p_staff_id uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $attach_identity$
declare
  staff_record public.staff_pin_directory;
begin
  select *
  into staff_record
  from public.staff_pin_directory
  where id = p_staff_id;

  if staff_record.id is null then
    raise exception 'Staff PIN record not found';
  end if;

  update public.staff_pin_directory
  set
    auth_user_id = p_auth_user_id,
    updated_at = now()
  where id = p_staff_id;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    can_resolve,
    updated_at
  )
  values (
    p_auth_user_id,
    'internal-' || p_staff_id::text || '@pin.blueridge.invalid',
    staff_record.display_name,
    staff_record.role,
    (
      staff_record.role = 'admin'
      and lower(staff_record.display_name) = 'tiffany'
    ),
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    can_resolve = excluded.can_resolve,
    updated_at = now();
end;
$attach_identity$;

revoke all on function public.attach_staff_auth_identity(uuid,uuid) from public;
revoke all on function public.attach_staff_auth_identity(uuid,uuid) from anon;
revoke all on function public.attach_staff_auth_identity(uuid,uuid) from authenticated;
grant execute on function public.attach_staff_auth_identity(uuid,uuid) to service_role;

commit;
