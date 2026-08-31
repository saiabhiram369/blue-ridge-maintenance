import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const EMAILJS_PUBLIC_KEY = 'ATOjvujTTzM_lQ2DZ';
const EMAILJS_SERVICE_ID = 'service_rz1xa06';
const EMAILJS_TPL_NEW = 'template_sld7lxw';
const EMAILJS_TPL_UPDATE = 'template_brv56is';

type EventType = 'new_request' | 'technician_completed' | 'requester_resolved';

type Payload = {
  event?: EventType;
  ticketId?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function adminEmails() {
  return (Deno.env.get('ADMIN_NOTIFICATION_EMAILS') || '')
    .split(/[;,]/)
    .map(value => value.trim())
    .filter(Boolean);
}

async function sendEmail(templateId: string, params: Record<string, unknown>) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: params
    })
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`EmailJS ${response.status}: ${body || 'delivery failed'}`);
  }

  return body;
}

async function sendToAdmins(
  event: 'new_request' | 'technician_completed',
  order: Record<string, any>
) {
  const recipients = adminEmails();

  if (recipients.length === 0) {
    if (event === 'new_request') {
      await sendEmail(EMAILJS_TPL_NEW, {
        ticket_id: order.ticket_id,
        title: order.title,
        from_name: order.name,
        from_email: order.email,
        category: order.category,
        location: order.location,
        priority: order.priority,
        description: order.description
      });

      return { recipients: 1, mode: 'legacy-template-recipient' };
    }

    throw new Error(
      'ADMIN_NOTIFICATION_EMAILS is not configured in Supabase Edge Function secrets.'
    );
  }

  const status = event === 'new_request'
    ? 'New Maintenance Request'
    : 'Pending Admin Approval';

  const adminNote = event === 'new_request'
    ? [
        `A new maintenance request has been submitted.`,
        `Requester: ${order.name || '—'}`,
        `Location: ${order.location || '—'}`,
        `Category: ${order.category || '—'}`,
        `Priority: ${order.priority || '—'}`,
        '',
        order.description || ''
      ].join('\n')
    : [
        `${order.technician || 'Technician'} marked this work order as complete.`,
        `Location: ${order.location || '—'}`,
        `Priority: ${order.priority || '—'}`,
        `Requester: ${order.name || '—'}`,
        '',
        'Tiffany is the primary reviewer. If she is unavailable, another authorized admin may verify and close the work order.'
      ].join('\n');

  await Promise.all(
    recipients.map(toEmail =>
      sendEmail(EMAILJS_TPL_UPDATE, {
        to_email: toEmail,
        to_name: 'Blue Ridge Admin',
        ticket_id: order.ticket_id,
        title: order.title,
        status,
        admin_note: adminNote
      })
    )
  );

  return { recipients: recipients.length, mode: 'admin-list' };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = (await req.json()) as Payload;
    const event = body.event;
    const ticketId = body.ticketId?.trim();

    if (!event || !ticketId) {
      return json({ error: 'event and ticketId are required.' }, 400);
    }

    if (!['new_request','technician_completed','requester_resolved'].includes(event)) {
      return json({ error: 'Unsupported notification event.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Supabase Edge Function environment is incomplete.');
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: existing } = await service
      .from('email_notification_log')
      .select('id,delivered_at')
      .eq('ticket_id', ticketId)
      .eq('event_type', event)
      .maybeSingle();

    if (existing) {
      return json({
        ok: true,
        duplicate: true,
        deliveredAt: existing.delivered_at
      });
    }

    const { data: order, error: orderError } = await service
      .from('maintenance_requests')
      .select('*')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return json({ error: 'Work order not found.' }, 404);

    if (event === 'new_request') {
      const created = new Date(order.timestamp || 0).getTime();
      if (!created || Date.now() - created > 24 * 60 * 60 * 1000) {
        return json({ error: 'New-request email window has expired.' }, 409);
      }

      const delivery = await sendToAdmins('new_request', order);

      await service.from('email_notification_log').insert({
        ticket_id: ticketId,
        event_type: event,
        provider: 'emailjs'
      });

      return json({ ok: true, ...delivery });
    }

    const authHeader = req.headers.get('Authorization') || '';

    if (!authHeader) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData.user) {
      return json({ error: 'Invalid authenticated session.' }, 401);
    }

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('id,full_name,role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return json({ error: 'Staff profile not found.' }, 403);

    if (event === 'technician_completed') {
      if (!['technician','admin'].includes(profile.role)) {
        return json({ error: 'Not authorized.' }, 403);
      }

      if (
        profile.role === 'technician'
        && order.technician !== profile.full_name
      ) {
        return json({ error: 'This work order is not assigned to this technician.' }, 403);
      }

      if (order.status !== 'Pending Tiffany' || !order.tech_marked_done) {
        return json({ error: 'Work order is not pending admin approval.' }, 409);
      }

      const delivery = await sendToAdmins('technician_completed', order);

      await service.from('email_notification_log').insert({
        ticket_id: ticketId,
        event_type: event,
        provider: 'emailjs'
      });

      return json({ ok: true, ...delivery });
    }

    if (profile.role !== 'admin') {
      return json({ error: 'Only an admin may send a resolution notice.' }, 403);
    }

    if (order.status !== 'Resolved') {
      return json({ error: 'Work order is not resolved.' }, 409);
    }

    if (!order.email) {
      return json({ error: 'Requester email is missing.' }, 409);
    }

    await sendEmail(EMAILJS_TPL_UPDATE, {
      to_email: order.email,
      to_name: order.name,
      ticket_id: order.ticket_id,
      title: order.title,
      status: 'Resolved',
      admin_note:
        'Your maintenance request has been completed and verified by our facilities team. ' +
        'The work order is now closed. If you continue to experience the issue, please submit a new maintenance request.'
    });

    await service.from('email_notification_log').insert({
      ticket_id: ticketId,
      event_type: event,
      provider: 'emailjs'
    });

    return json({ ok: true, recipients: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email notification failed.';
    return json({ error: message }, 500);
  }
});
