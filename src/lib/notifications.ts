import { supabase } from './supabase';
import type { WorkOrder } from '../types';

type NotificationEvent = 'new_request' | 'technician_completed' | 'requester_resolved';

async function invokeMaintenanceEmail(event: NotificationEvent, ticketId: string) {
  const { data, error } = await supabase.functions.invoke('maintenance-email', {
    body: { event, ticketId }
  });

  if (error) {
    throw new Error(error.message || 'Maintenance notification failed.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function notifyAdminsNewRequest(order: WorkOrder) {
  return invokeMaintenanceEmail('new_request', order.ticket_id);
}

export async function notifyAdminsTechnicianDone(order: WorkOrder) {
  return invokeMaintenanceEmail('technician_completed', order.ticket_id);
}

export async function notifyRequesterResolved(order: WorkOrder) {
  if (!order.email) return;

  return invokeMaintenanceEmail('requester_resolved', order.ticket_id);
}
