export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type WorkOrderStatus = 'Open' | 'In Progress' | 'On Hold' | 'Pending Tiffany' | 'Resolved';

export interface WorkOrder {
  ticket_id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  priority: Priority;
  status: WorkOrderStatus;
  name: string;
  email?: string | null;
  phone?: string | null;
  technician?: string | null;
  supervisor?: string | null;
  timestamp: string;
  admin_note?: string | null;
  tech_note?: string | null;
  photos?: string[] | null;
  updated_at?: string | null;
  tech_marked_done?: boolean | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'technician';
}
