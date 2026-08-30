import {
  CheckCircle2, Circle, Mail, MapPin, Phone, UserRoundPlus, X
} from 'lucide-react';
import type { WorkOrder, WorkOrderStatus } from '../types';

interface Props {
  order: WorkOrder | null;
  onClose: () => void;
  onStatusChange: (status: WorkOrderStatus) => void;
  onTechnicianChange: (technician: string) => void;
  isAdmin: boolean;
  canResolve: boolean;
}

const adminStatuses: WorkOrderStatus[] = ['Open', 'In Progress', 'On Hold', 'Pending Tiffany', 'Resolved'];

export function WorkOrderInspector({
  order, onClose, onStatusChange, onTechnicianChange, isAdmin, canResolve
}: Props) {
  if (!order) return (
    <aside className="inspector glass inspector-empty">
      <div><span className="empty-orb" /><h3>Select a work order</h3><p>Details, assignment, notes and status history will appear here.</p></div>
    </aside>
  );

  const statusOptions: WorkOrderStatus[] = isAdmin
    ? adminStatuses.filter(status => status !== 'Resolved' || canResolve || order.status === 'Resolved')
    : Array.from(new Set<WorkOrderStatus>([order.status, 'Pending Tiffany']));

  const timeline = [
    ['Order Created', true, new Date(order.timestamp).toLocaleString()],
    ['In Progress', ['In Progress','Pending Tiffany','Resolved'].includes(order.status), order.technician || 'Awaiting assignment'],
    ['Pending Approval', ['Pending Tiffany','Resolved'].includes(order.status), order.tech_marked_done ? 'Technician marked complete' : 'Awaiting completion'],
    ['Resolved', order.status === 'Resolved', order.status === 'Resolved' ? 'Closed by operations' : 'Pending']
  ] as const;

  return (
    <aside className="inspector glass">
      <div className="inspector-top">
        <div><small>WORK ORDER</small><strong>{order.ticket_id}</strong></div>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      <div className="inspector-pills">
        <span className={`pill priority ${order.priority.toLowerCase()}`}><i />{order.priority} Priority</span>
        <span className={`pill status ${order.status.toLowerCase().replaceAll(' ', '-')}`}><i />{order.status}</span>
      </div>

      <h2>{order.title}</h2>
      <p className="inspector-location"><MapPin size={14} />{order.location}</p>

      <div className="inspector-section">
        <label>REQUESTED BY</label>
        <div className="person-line">
          <span className="avatar avatar-fallback">{order.name.slice(0, 1)}</span>
          <div><strong>{order.name}</strong><span>Requester</span></div>
          <div className="person-actions"><button title="Phone"><Phone size={15} /></button><button title="Email"><Mail size={15} /></button></div>
        </div>
      </div>

      <div className="inspector-section">
        <label>ASSIGNED TECHNICIAN</label>
        <div className="assignment-control">
          <UserRoundPlus size={16} />
          <select
            value={order.technician || ''}
            onChange={e => onTechnicianChange(e.target.value)}
            disabled={!isAdmin}
            title={isAdmin ? 'Assign technician' : 'Only administrators can reassign work orders'}
          >
            <option value="">Unassigned</option>
            <option>Ethan</option>
            <option>Eric</option>
            <option>Marcus Hill</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <div className="inspector-section">
        <label>DESCRIPTION</label>
        <p className="description-copy">{order.description}</p>
        {order.tech_note && <div className="tech-note"><strong>Latest technician note</strong><span>{order.tech_note}</span></div>}
      </div>

      <div className="inspector-section">
        <label>PROGRESS TIMELINE</label>
        <div className="timeline">
          {timeline.map(([label, done, detail], index) => (
            <div className={done ? 'timeline-item done' : 'timeline-item'} key={label}>
              <div className="timeline-glyph">{done ? <CheckCircle2 size={17} /> : <Circle size={17} />}</div>
              <div><strong>{label}</strong><span>{detail}</span></div>
              {index < timeline.length - 1 && <i />}
            </div>
          ))}
        </div>
      </div>

      <div className="inspector-actions">
        <select value={order.status} onChange={e => onStatusChange(e.target.value as WorkOrderStatus)}>
          {statusOptions.map(status => <option key={status}>{status}</option>)}
        </select>
        {isAdmin && (
          <button
            className="resolve-btn"
            onClick={() => onStatusChange('Resolved')}
            disabled={!canResolve || order.status === 'Resolved'}
            title={canResolve ? 'Resolve work order' : 'Your account is not authorized to resolve work orders'}
          >
            <CheckCircle2 size={16} /> Resolve
          </button>
        )}
      </div>
    </aside>
  );
}
