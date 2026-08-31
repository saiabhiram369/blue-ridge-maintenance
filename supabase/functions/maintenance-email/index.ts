import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

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

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function layout(title: string, body: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8f6f2;padding:32px;color:#252d3a">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e1ddd6;border-radius:16px;overflow:hidden">
      <div style="padding:24px 28px;background:#252d3a;color:#ffffff">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Blue Ridge Preservation Maintenance</div>
        <h1 style="font-size:24px;margin:8px 0 0">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:28px;line-height:1.6">${body}</div>
      <div style="padding:18px 28px;background:#f8f6f2;color:#6b7280;font-size:12px">
        Automated maintenance notification
      </div>
    </div>
  </div>`;
}

async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${responseText || 'delivery failed'}`);
  }

  return responseText;
}

async function sendToAdmins(
  event: 'new_request' | 'technician_completed',
  order: Record<string, any>
) {
  const recipients = adminEmails();

  if (recipients.length === 0) {
    throw new Error(
      'ADMIN_NOTIFICATION_EMAILS is not configured in Supabase Edge Function secrets.'
    );
  }

  if (event === 'new_request') {
    const subject = `New maintenance request · ${order.ticket_id} · ${order.priority || 'Priority'}`;
    const html = layout(
      'New maintenance request',
      `
        <p>A new maintenance request has been submitted.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#6b7280">Ticket</td><td><strong>${escapeHtml(order.ticket_id)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Requester</td><td>${escapeHtml(order.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Location</td><td>${escapeHtml(order.location)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Category</td><td>${escapeHtml(order.category)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Priority</td><td><strong>${escapeHtml(order.priority)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Issue</td><td>${escapeHtml(order.title)}</td></tr>
        </table>
        <p style="margin-top:20px"><strong>Description</strong><br/>${escapeHtml(order.description)}</p>
      `
    );

    await sendEmail({
      to: recipients,
      subject,
      html,
      text:
        `New maintenance request ${order.ticket_id}\n` +
        `Requester: ${order.name || ''}\n` +
        `Location: ${order.location || ''}\n` +
        `Category: ${order.category || ''}\n` +
        `Priority: ${order.priority || ''}\n` +
        `Issue: ${order.title || ''}\n\n` +
        (order.description || '')
    });

    return { recipients: recipients.length };
  }

  const subject = `Ready for admin verification · ${order.ticket_id}`;
  const html = layout(
    'Work ready for verification',
    `
      <p><strong>${escapeHtml(order.technician || 'Technician')}</strong> marked this work order complete.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b7280">Ticket</td><td><strong>${escapeHtml(order.ticket_id)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Location</td><td>${escapeHtml(order.location)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Priority</td><td>${escapeHtml(order.priority)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Requester</td><td>${escapeHtml(order.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Issue</td><td>${escapeHtml(order.title)}</td></tr>
      </table>
      <p style="margin-top:20px">
        Tiffany is the primary reviewer. If she is unavailable, another authorized admin may verify and close the work order.
      </p>
    `
  );

  await sendEmail({
    to: recipients,
    subject,
    html,
    text:
      `${order.technician || 'Technician'} marked ${order.ticket_id} complete.\n` +
      `Location: ${order.location || ''}\n` +
      `Priority: ${order.priority || ''}\n` +
      `Requester: ${order.name || ''}\n\n` +
      'Tiffany is the primary reviewer. Another authorized admin may verify and close if needed.'
  });

  return { recipients: recipients.length };
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
        provider: 'resend'
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
        provider: 'resend'
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

    await sendEmail({
      to: order.email,
      subject: `Maintenance request completed · ${order.ticket_id}`,
      html: layout(
        'Maintenance request completed',
        `
          <p>Hello ${escapeHtml(order.name)},</p>
          <p>Your maintenance request has been completed and verified by our facilities team.</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280">Ticket</td><td><strong>${escapeHtml(order.ticket_id)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Issue</td><td>${escapeHtml(order.title)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Status</td><td><strong>Resolved</strong></td></tr>
          </table>
          <p style="margin-top:20px">The work order is now closed. If the issue continues, please submit a new maintenance request.</p>
        `
      ),
      text:
        `Hello ${order.name || ''},\n\n` +
        `Your maintenance request ${order.ticket_id} has been completed and verified.\n` +
        `Issue: ${order.title || ''}\nStatus: Resolved\n\n` +
        'If the issue continues, please submit a new maintenance request.'
    });

    await service.from('email_notification_log').insert({
      ticket_id: ticketId,
      event_type: event,
      provider: 'resend'
    });

    return json({ ok: true, recipients: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email notification failed.';
    return json({ error: message }, 500);
  }
});
