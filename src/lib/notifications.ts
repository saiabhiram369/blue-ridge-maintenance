import { supabase } from './supabase';
import type { WorkOrder } from '../types';

type EmailEvent = 'new_request' | 'technician_completed' | 'requester_resolved';

async function invokeEmail(event: EmailEvent, ticketId: string) {
  const { data, error } = await supabase.functions.invoke('maintenance-email', {
    body: { event, ticketId }
  });

  if (error) {
    throw new Error(error.message || 'Email notification failed.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export function notifyAdminsNewRequest(ticketId: string) {
  return invokeEmail('new_request', ticketId);
}

export function notifyAdminsTechnicianDone(order: WorkOrder) {
  return invokeEmail('technician_completed', order.ticket_id);
}

export function notifyRequesterResolved(order: WorkOrder) {
  if (!order.email) return Promise.resolve(null);
  return invokeEmail('requester_resolved', order.ticket_id);
}
