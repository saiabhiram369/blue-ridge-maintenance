# Email Notifications Setup

The application sends maintenance emails through the Supabase Edge Function
`maintenance-email`. Staff authentication remains name + PIN only.

Email delivery uses **Resend**, not Gmail/EmailJS.

## 1. Database migration

Run:

`supabase/migrations/006_server_email_notifications.sql`

This adds new-request admin bell notifications and the email delivery log.

## 2. Supabase Edge Function secrets

Create these custom secrets in Supabase:

`ADMIN_NOTIFICATION_EMAILS`

Comma-separated admin notification recipients, for example:

`admin1@example.com,admin2@example.com,admin3@example.com`

`RESEND_API_KEY`

Your Resend API key.

`RESEND_FROM_EMAIL`

A sender address on a verified Resend domain, for example:

`Blue Ridge Maintenance <maintenance@example.org>`

These addresses are only for operational notifications. Staff login still uses name + PIN.

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
- Technician marks done: admin approval notification + admin email.
- Admin verifies and closes: requester receives completion email.

The `email_notification_log` table prevents duplicate email delivery for the same ticket/event.
