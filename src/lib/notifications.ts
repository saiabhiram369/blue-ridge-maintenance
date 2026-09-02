import emailjs from '@emailjs/browser';
import type { WorkOrder } from '../types';

const EJS_PUBLIC_KEY = 'ATOjvujTTzM_lQ2DZ';
const EJS_SERVICE_ID = 'service_rz1xa06';
const EJS_TPL_UPDATE = 'template_brv56is';

const ADMIN_RECIPIENTS = [
  { email: 'abhiram@artoflivingretreat.org', name: 'Abhiram' },
  { email: 'tiffany@artoflivingretreat.org', name: 'Tiffany' },
  { email: 'catherine@artoflivingretreat.org', name: 'Catherine' },
  { email: 'corey@artoflivingretreat.org', name: 'Corey' }
] as const;

async function sendUpdateEmail(
  toEmail: string,
  toName: string,
  order: WorkOrder,
  status: string,
  adminNote: string
) {
  return emailjs.send(
    EJS_SERVICE_ID,
    EJS_TPL_UPDATE,
    {
      to_email: toEmail,
      to_name: toName,
      ticket_id: order.ticket_id,
      title: order.title,
      status,
      admin_note: adminNote
    },
    { publicKey: EJS_PUBLIC_KEY }
  );
}

export async function notifyAdminsNewRequest(order: WorkOrder) {
  const note = [
    'A new maintenance request has been submitted.',
    `Requester: ${order.name || '—'}`,
    `Email: ${order.email || '—'}`,
    `Location: ${order.location || '—'}`,
    `Category: ${order.category || '—'}`,
    `Priority: ${order.priority || '—'}`,
    '',
    order.description || ''
  ].join('\n');

  return Promise.all(
    ADMIN_RECIPIENTS.map(recipient =>
      sendUpdateEmail(
        recipient.email,
        recipient.name,
        order,
        'New Maintenance Request',
        note
      )
    )
  );
}

export async function notifyAdminsTechnicianDone(order: WorkOrder) {
  const note = [
    `${order.technician || 'Technician'} marked this work order as complete.`,
    `Location: ${order.location || '—'}`,
    `Priority: ${order.priority || '—'}`,
    `Requester: ${order.name || '—'}`,
    '',
    'This work order is pending admin verification and closure.'
  ].join('\n');

  return Promise.all(
    ADMIN_RECIPIENTS.map(recipient =>
      sendUpdateEmail(
        recipient.email,
        recipient.name,
        order,
        'Pending Admin Approval',
        note
      )
    )
  );
}

export async function notifyRequesterResolved(order: WorkOrder) {
  if (!order.email) return;

  return sendUpdateEmail(
    order.email,
    order.name,
    order,
    'Resolved',
    'Your maintenance request has been completed and verified by our facilities team. ' +
      'The work order is now closed. If you continue to experience the issue, please submit a new maintenance request.'
  );
}
