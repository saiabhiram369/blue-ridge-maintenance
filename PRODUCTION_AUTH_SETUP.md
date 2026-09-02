# Production Authentication Setup

The application uses Supabase Auth underneath, but staff see only a **name + private 4-digit PIN** login.

## Security model

- PINs are bcrypt-hashed in Postgres.
- PIN hashes are never readable by the browser.
- The browser never receives or stores an email/password credential.
- Five failed PIN attempts lock that staff PIN for 15 minutes.
- Successful PIN verification is handled by the `pin-login` Supabase Edge Function.
- The Edge Function creates a short-lived Supabase Auth session invisibly.
- Row Level Security then decides what that staff member can read or change.

## Already applied

- `supabase/migrations/002_production_auth.sql`

## Apply next

1. Run `supabase/migrations/003_secure_pin_login.sql` in Supabase SQL Editor.
2. Create the authorized users in Supabase Authentication.
3. Deploy the Edge Function at `supabase/functions/pin-login/index.ts`.
4. Configure one unique 4-digit PIN for each staff account using `public.configure_staff_pin(...)`.
5. Test the preview branch before promoting it to production.

## Role behavior

Admin portal:
- Abhiram
- Tiffany
- Catherine
- Corey

Technician portal:
- Ethan
- Eric

Only Tiffany receives final resolve/close authority through `can_resolve=true`.

Technicians must have a profile `full_name` exactly matching the value stored in `maintenance_requests.technician`.

## PIN configuration example

Use your real Supabase Auth email and a NEW private 4-digit code:

```sql
select public.configure_staff_pin(
  'staff-email@example.org',
  'Display Name',
  'admin',
  '1234'
);
```

For a technician, use `technician` as the role.

Do not reuse any PIN that was previously embedded in client-side code.
