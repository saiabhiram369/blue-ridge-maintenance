# Email Notifications Setup

The application sends maintenance emails through the Supabase Edge Function
`maintenance-email`. Staff authentication remains name + PIN only.

## 1. Database migration

Run:

`supabase/migrations/006_server_email_notifications.sql`

This adds new-request admin bell notifications and the email delivery log.

## 2. Admin notification recipients

In Supabase Edge Function secrets, create:

`ADMIN_NOTIFICATION_EMAILS`

Use a comma-separated list, for example:

`admin1@example.com,admin2@example.com,admin3@example.com`

These addresses are used only for operational notifications. They are not used for login.

## 3. Deploy Edge Function

Create/deploy:

`supabase/functions/maintenance-email/index.ts`

Function name:

`maintenance-email`

Set **Verify JWT with legacy secret = OFF**.

The function performs its own authorization:
- new_request can be invoked after a public request is created;
- technician_completed requires an authenticated assigned technician or admin;
- requester_resolved requires an authenticated admin.

## 4. Notification workflow

- New request: admin in-app notification + admin email.
- Technician marks done: admin approval notification + email to configured admins.
- Admin verifies and closes: requester receives completion email.

The `email_notification_log` table prevents duplicate email delivery for the same ticket/event.
