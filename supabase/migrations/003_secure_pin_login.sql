-- Blue Ridge Preservation Maintenance
-- Secure 4-digit staff PIN authentication layer.
-- Apply AFTER 002_production_auth.sql.
-- PINs are bcrypt-hashed in Postgres and never exposed to the browser.

begin;

create extension if not exists pgcrypto;

create table if not exists public.staff_pin_access (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin','technician')),
  pin_hash text not null,
  active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_staff_pin_access_name_role
  on public.staff_pin_access (lower(display_name), role);

alter table public.staff_pin_access enable row level security;

-- This table is server-only. Browsers may not read PIN hashes.
revoke all on public.staff_pin_access from anon;
revoke all on public.staff_pin_access from authenticated;

-- From this point forward, profile roles come from the configured staff PIN
-- record rather than from any hard-coded email address.
create or replace function public.handle_blue_ridge_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
  access_role text;
  access_name text;
begin
  select spa.role, spa.display_name
  into access_role, access_name
  from public.staff_pin_access spa
  where spa.auth_user_id = new.id
  limit 1;

  insert into public.profiles (
    id,email,full_name,role,can_resolve,updated_at
  )
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(
      access_name,
      nullif(new.raw_user_meta_data->>'full_name',''),
      split_part(coalesce(new.email,'User'),'@',1)
    ),
    coalesce(access_role,'technician'),
    coalesce(access_role = 'admin' and lower(access_name) = 'tiffany', false),
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
$;

-- Configure or rotate a staff PIN from SQL Editor.
-- This function is intentionally not callable by anon/authenticated users.
create or replace function public.configure_staff_pin(
  p_email text,
  p_display_name text,
  p_role text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user uuid;
begin
  if p_role not in ('admin','technician') then
    raise exception 'Role must be admin or technician';
  end if;

  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must contain exactly 4 digits';
  end if;

  select id
  into target_user
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  if target_user is null then
    raise exception 'No Supabase Auth user exists for %', p_email;
  end if;

  insert into public.staff_pin_access (
    auth_user_id,
    display_name,
    role,
    pin_hash,
    active,
    failed_attempts,
    locked_until,
    updated_at
  )
  values (
    target_user,
    btrim(p_display_name),
    p_role,
    crypt(p_pin, gen_salt('bf', 12)),
    true,
    0,
    null,
    now()
  )
  on conflict (auth_user_id) do update set
    display_name = excluded.display_name,
    role = excluded.role,
    pin_hash = excluded.pin_hash,
    active = true,
    failed_attempts = 0,
    locked_until = null,
    updated_at = now();

  update public.profiles
  set
    full_name = btrim(p_display_name),
    role = p_role,
    can_resolve = (
      p_role = 'admin'
      and lower(btrim(p_display_name)) = 'tiffany'
    ),
    updated_at = now()
  where id = target_user;
end;
$;

revoke all on function public.configure_staff_pin(text,text,text,text) from public;
revoke all on function public.configure_staff_pin(text,text,text,text) from anon;
revoke all on function public.configure_staff_pin(text,text,text,text) from authenticated;

-- Server-side verifier. Only the service role used by the Edge Function may call it.
create or replace function public.verify_staff_pin(
  p_display_name text,
  p_role text,
  p_pin text
)
returns table(auth_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.staff_pin_access;
begin
  if p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select *
  into row_data
  from public.staff_pin_access
  where lower(display_name) = lower(btrim(p_display_name))
    and role = p_role
    and active = true
  for update;

  if row_data.auth_user_id is null then
    perform pg_sleep(0.35);
    return;
  end if;

  if row_data.locked_until is not null
     and row_data.locked_until > now()
  then
    return;
  end if;

  if crypt(p_pin, row_data.pin_hash) <> row_data.pin_hash then
    update public.staff_pin_access
    set
      failed_attempts = failed_attempts + 1,
      locked_until = case
        when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else locked_until
      end,
      updated_at = now()
    where staff_pin_access.auth_user_id = row_data.auth_user_id;

    return;
  end if;

  update public.staff_pin_access
  set
    failed_attempts = 0,
    locked_until = null,
    updated_at = now()
  where staff_pin_access.auth_user_id = row_data.auth_user_id;

  auth_user_id := row_data.auth_user_id;
  return next;
end;
$$;

revoke all on function public.verify_staff_pin(text,text,text) from public;
revoke all on function public.verify_staff_pin(text,text,text) from anon;
revoke all on function public.verify_staff_pin(text,text,text) from authenticated;
grant execute on function public.verify_staff_pin(text,text,text) to service_role;

commit;
