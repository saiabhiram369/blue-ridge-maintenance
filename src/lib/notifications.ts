import emailjs from '@emailjs/browser';
import type { WorkOrder } from '../types';

const EJS_PUBLIC_KEY = 'ATOjvujTTzM_lQ2DZ';
const EJS_SERVICE_ID = 'service_rz1xa06';
const EJS_TPL_UPDATE = 'template_brv56is';

export async function notifyRequesterResolved(order: WorkOrder) {
  if (!order.email) return;

  return emailjs.send(
    EJS_SERVICE_ID,
    EJS_TPL_UPDATE,
    {
      to_email: order.email,
      to_name: order.name,
      ticket_id: order.ticket_id,
      title: order.title,
      status: 'Resolved',
      admin_note:
        '✅ Your maintenance request has been completed and verified by our facilities team. ' +
        'The work order is now closed. If you continue to experience the issue, please submit a new maintenance request.'
    },
    { publicKey: EJS_PUBLIC_KEY }
  );
}
