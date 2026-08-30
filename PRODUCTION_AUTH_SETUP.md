# Production Authentication Setup

The React application now uses Supabase Auth for /admin and /tech. The old browser-side PIN list is removed from the secure branch.

## One-time Supabase steps

1. In the Supabase project, open SQL Editor.
2. Apply supabase/migrations/001_v2_security.sql if it has not already been applied.
3. Apply supabase/migrations/002_production_auth.sql.
4. In Authentication → Users, create the authorized facilities accounts.

Known admin accounts:

- abhiram@artoflivingretreat.org
- tiffany@artoflivingretreat.org
- catherine@artoflivingretreat.org
- corey@artoflivingretreat.org

Only Tiffany receives can_resolve=true.

For technician accounts, set the user's Full name metadata to the exact technician assignment value stored in maintenance_requests.technician, for example Ethan or Eric. This is what allows RLS to restrict technicians to their assigned work orders.

## Expected behavior

- /admin: authenticated admins can read all work orders.
- /tech: authenticated technicians can read only work orders assigned to their profile full_name.
- Technicians can only move assigned work orders to Pending Tiffany.
- Only Tiffany can resolve/close.
- Public users can still submit maintenance requests from /.