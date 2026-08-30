-- Blue Ridge V2: production auth role hardening
-- Apply after 001_v2_security.sql.
-- This migration makes account roles deterministic and removes trust in client-supplied role metadata.

insert into public.profiles (id, email, full_name, role, can_resolve)
select
  u.id,
  coalesce(u.email,''),
  coalesce(nullif(u.raw_user_meta_data->>'full_name',''), split_part(coalesce(u.email,'User'),'@',1)),
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email,''));
  resolved_role text;
  resolved_can_resolve boolean;
begin
  resolved_role := case
    when normalized_email in (
      'abhiram@artoflivingretreat.org',
      'tiffany@artoflivingretreat.org',
      'catherine@artoflivingretreat.org',
      'corey@artoflivingretreat.org'
    ) then 'admin'
    else 'technician'
  end;

  resolved_can_resolve := normalized_email = 'tiffany@artoflivingretreat.org';

  insert into public.profiles(id,email,full_name,role,can_resolve)
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name',''),
      split_part(coalesce(new.email,'User'),'@',1)
    ),
    resolved_role,
    resolved_can_resolve
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

update public.profiles
set can_resolve = (
  lower(email) = 'tiffany@artoflivingretreat.org'
)
where lower(email) in (
  'abhiram@artoflivingretreat.org',
  'tiffany@artoflivingretreat.org',
  'catherine@artoflivingretreat.org',
  'corey@artoflivingretreat.org'
);

create index if not exists idx_maintenance_requests_status
  on public.maintenance_requests(status);

create index if not exists idx_maintenance_requests_technician
  on public.maintenance_requests(technician);

create index if not exists idx_maintenance_requests_timestamp
  on public.maintenance_requests(timestamp desc);
