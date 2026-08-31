import {
  BellRing, Building2, CheckCircle2, ClipboardList, Download, Mail,
  ShieldCheck, SlidersHorizontal, UserRound, Users, Wrench
} from 'lucide-react';
import { useMemo } from 'react';
import type { AdminNotification, WorkOrder } from '../types';

interface TechniciansProps {
  orders: WorkOrder[];
  onOpenTechnician: (name: string) => void;
}

export function TechniciansPanel({ orders, onOpenTechnician }: TechniciansProps) {
  const technicians = useMemo(() => {
    const names = Array.from(new Set(orders.map(order => order.technician).filter(Boolean))) as string[];
    return names.map(name => {
      const assigned = orders.filter(order => order.technician === name);
      return {
        name,
        assigned: assigned.length,
        active: assigned.filter(order => ['Open','In Progress','On Hold'].includes(order.status)).length,
        pending: assigned.filter(order => order.status === 'Pending Admin Approval').length,
        completed: assigned.filter(order => order.status === 'Resolved').length
      };
    });
  }, [orders]);

  return (
    <section className="admin-page-card">
      <div className="section-page-head">
        <div>
          <span><Users size={15}/> TEAM</span>
          <h2>Technicians</h2>
          <p>Current assignments and completion status by technician.</p>
        </div>
      </div>

      <div className="directory-grid">
        {technicians.map(tech => (
          <button className="directory-card" key={tech.name} onClick={() => onOpenTechnician(tech.name)}>
            <div className="directory-icon"><UserRound size={21}/></div>
            <div className="directory-main">
              <strong>{tech.name}</strong>
              <span>{tech.assigned} assigned work orders</span>
            </div>
            <div className="directory-stats">
              <span><b>{tech.active}</b> active</span>
              <span><b>{tech.pending}</b> awaiting admin approval</span>
              <span><b>{tech.completed}</b> completed</span>
            </div>
          </button>
        ))}
        {!technicians.length && <div className="empty-state">No technicians are assigned to work orders yet.</div>}
      </div>
    </section>
  );
}

interface FacilitiesProps {
  orders: WorkOrder[];
  onOpenFacility: (location: string) => void;
}

export function FacilitiesPanel({ orders, onOpenFacility }: FacilitiesProps) {
  const facilities = useMemo(() => {
    const locations = Array.from(new Set(orders.map(order => order.location).filter(Boolean)));
    return locations.map(location => {
      const related = orders.filter(order => order.location === location);
      return {
        location,
        total: related.length,
        open: related.filter(order => order.status !== 'Resolved').length,
        urgent: related.filter(order => order.priority === 'Urgent' && order.status !== 'Resolved').length
      };
    }).sort((a,b) => b.open - a.open);
  }, [orders]);

  return (
    <section className="admin-page-card">
      <div className="section-page-head">
        <div>
          <span><Building2 size={15}/> LOCATIONS</span>
          <h2>Facilities</h2>
          <p>Work-order activity grouped by building, room, or site location.</p>
        </div>
      </div>

      <div className="directory-grid facilities-grid">
        {facilities.map(item => (
          <button className="directory-card" key={item.location} onClick={() => onOpenFacility(item.location)}>
            <div className="directory-icon"><Building2 size={21}/></div>
            <div className="directory-main">
              <strong>{item.location}</strong>
              <span>{item.total} total requests</span>
            </div>
            <div className="directory-stats">
              <span><b>{item.open}</b> open</span>
              <span><b>{item.urgent}</b> urgent</span>
            </div>
          </button>
        ))}
        {!facilities.length && <div className="empty-state">No facility activity is available yet.</div>}
      </div>
    </section>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"','""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ReportsPanel({ orders }: { orders: WorkOrder[] }) {
  function exportAll() {
    const rows = [
      ['Ticket ID','Created','Requester','Email','Category','Location','Priority','Status','Technician','Title'],
      ...orders.map(order => [
        order.ticket_id, order.timestamp, order.name, order.email || '', order.category,
        order.location, order.priority, order.status, order.technician || '', order.title
      ])
    ];
    downloadCsv('blue-ridge-work-orders.csv', rows);
  }

  function exportMonthlySummary() {
    const month = new Date().toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const current = orders.filter(order => {
      const date = new Date(order.timestamp);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const rows = [
      ['Blue Ridge Monthly Maintenance Report', month],
      ['Total created', String(current.length)],
      ['Open', String(current.filter(order => order.status === 'Open').length)],
      ['In Progress', String(current.filter(order => order.status === 'In Progress').length)],
      ['Pending Admin Approval', String(current.filter(order => order.status === 'Pending Admin Approval').length)],
      ['Resolved', String(current.filter(order => order.status === 'Resolved').length)],
      [],
      ['Ticket ID','Location','Priority','Status','Technician','Title'],
      ...current.map(order => [
        order.ticket_id, order.location, order.priority, order.status, order.technician || '', order.title
      ])
    ];
    downloadCsv('blue-ridge-monthly-report.csv', rows);
  }

  return (
    <section className="admin-page-card">
      <div className="section-page-head">
        <div>
          <span><ClipboardList size={15}/> EXPORTS</span>
          <h2>Reports</h2>
          <p>Generate operational extracts from the live work-order data.</p>
        </div>
      </div>

      <div className="report-grid">
        <button className="report-card" onClick={exportMonthlySummary}>
          <div><ClipboardList size={23}/></div>
          <strong>Monthly maintenance report</strong>
          <span>Summary plus this month's work-order details.</span>
          <em><Download size={14}/> Download CSV</em>
        </button>

        <button className="report-card" onClick={exportAll}>
          <div><Download size={23}/></div>
          <strong>All work orders</strong>
          <span>Complete operational export for analysis or archiving.</span>
          <em><Download size={14}/> Download CSV</em>
        </button>
      </div>
    </section>
  );
}

export function SettingsPanel() {
  return (
    <section className="admin-page-card">
      <div className="section-page-head">
        <div>
          <span><SlidersHorizontal size={15}/> SYSTEM</span>
          <h2>Settings</h2>
          <p>Operational controls and security model for Blue Ridge Maintenance.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <ShieldCheck size={21}/>
          <div>
            <strong>Authentication</strong>
            <span>Supabase Auth with role-based access is the production target.</span>
          </div>
        </div>
        <div className="settings-card">
          <CheckCircle2 size={21}/>
          <div>
            <strong>Final closure</strong>
            <span>Tiffany is the primary reviewer. If she is unavailable, any authorized admin may verify and close the work order.</span>
          </div>
        </div>
        <div className="settings-card">
          <BellRing size={21}/>
          <div>
            <strong>Completion notifications</strong>
            <span>All admins receive an in-app notification after technician completion; the requester is notified after final resolution.</span>
          </div>
        </div>
        <div className="settings-card">
          <Mail size={21}/>
          <div>
            <strong>Email delivery</strong>
            <span>EmailJS is currently used for request and completion notifications.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface NotificationProps {
  notifications: AdminNotification[];
  unreadIds: Set<string>;
  orders: WorkOrder[];
  open: boolean;
  onClose: () => void;
  onOpenOrder: (order: WorkOrder) => void;
  onReadNotification: (notificationId: string) => void;
}

export function NotificationPanel({
  notifications,
  unreadIds,
  orders,
  open,
  onClose,
  onOpenOrder,
  onReadNotification
}: NotificationProps) {
  const activeNotifications = notifications.filter(item => !item.closed_at);
  const urgentUnassigned = orders.filter(order =>
    !order.technician
    && ['Urgent','High'].includes(order.priority)
    && order.status !== 'Resolved'
  );

  if (!open) return null;

  return (
    <>
      <button className="notification-scrim" aria-label="Close notifications" onClick={onClose}/>
      <aside className="notification-panel">
        <div className="notification-head">
          <div>
            <span>ADMIN APPROVAL QUEUE</span>
            <h3>Notifications</h3>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        <div className="notification-list">
          {activeNotifications.map(item => {
            const order = orders.find(order => order.ticket_id === item.ticket_id);
            const unread = unreadIds.has(item.id);

            return (
              <button
                className={unread ? 'unread' : ''}
                key={item.id}
                onClick={() => {
                  onReadNotification(item.id);
                  if (order) onOpenOrder(order);
                  onClose();
                }}
              >
                <div className="notification-icon">
                  <CheckCircle2 size={17}/>
                </div>
                <div>
                  <strong>{item.ticket_id} · {item.title}</strong>
                  <span>{item.message}</span>
                  <small>{item.technician ? `Completed by ${item.technician}` : 'Ready for admin review'}</small>
                </div>
                {unread && <i className="notification-unread-dot"/>}
              </button>
            );
          })}

          {urgentUnassigned.map(order => (
            <button
              key={'assignment-' + order.ticket_id}
              onClick={() => {
                onOpenOrder(order);
                onClose();
              }}
            >
              <div className="notification-icon"><Wrench size={17}/></div>
              <div>
                <strong>{order.ticket_id} · {order.title}</strong>
                <span>High-priority work order needs technician assignment.</span>
                <small>{order.location}</small>
              </div>
            </button>
          ))}

          {!activeNotifications.length && !urgentUnassigned.length && (
            <div className="notification-empty">Nothing needs immediate attention.</div>
          )}
        </div>

        <div className="notification-footnote">
          Tiffany is the primary reviewer. Any authorized admin may verify and close completed work if she is unavailable.
        </div>
      </aside>
    </>
  );
}
