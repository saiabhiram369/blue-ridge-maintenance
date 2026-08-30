import {
  CalendarDays, CheckCircle2, Circle, ImagePlus, Mail, MapPin, Phone,
  UserRoundPlus, X
} from 'lucide-react';
import type { WorkOrder, WorkOrderStatus } from '../types';

interface Props {
  order: WorkOrder | null;
  onClose: () => void;
  onStatusChange: (status: WorkOrderStatus) => void;
  onTechnicianChange: (technician: string) => void;
  onAddInternalNote: () => void;
  isAdmin: boolean;
  canResolve: boolean;
}

const adminStatuses: WorkOrderStatus[] = ['Open', 'In Progress', 'On Hold', 'Pending Tiffany', 'Resolved'];

export function WorkOrderInspector({
  order, onClose, onStatusChange, onTechnicianChange, onAddInternalNote, isAdmin, canResolve
}: Props) {
  if (!order) return (
    <aside className="inspector admin-inspector inspector-empty">
      <div><span className="empty-orb"/><h3>Select a work order</h3><p>Details, assignment, photos and activity will appear here.</p></div>
    </aside>
  );

  const statusOptions: WorkOrderStatus[] = isAdmin
    ? adminStatuses.filter(status => status !== 'Resolved' || canResolve || order.status === 'Resolved')
    : Array.from(new Set<WorkOrderStatus>([order.status, 'Pending Tiffany']));

  const timeline = [
    ['Created', true, new Date(order.timestamp).toLocaleString(), order.name],
    ['Assigned to ' + (order.technician || 'technician'), !!order.technician, order.technician ? 'Assignment confirmed' : 'Awaiting assignment', order.supervisor || 'Operations'],
    ['In Progress', ['In Progress','Pending Tiffany','Resolved'].includes(order.status), order.status === 'Open' ? 'Pending' : 'Work started', order.technician || 'Technician'],
    ['Pending Approval', ['Pending Tiffany','Resolved'].includes(order.status), order.tech_marked_done ? 'Ready for approval' : 'Pending', 'Operations']
  ] as const;

  const photos = (order.photos || []).filter(Boolean).slice(0,2);

  return (
    <aside className="inspector admin-inspector">
      <div className="admin-inspector-titlebar">
        <div>
          <strong>{order.ticket_id}</strong>
          <h2>{order.title}</h2>
          <p><MapPin size={14}/>{order.location}</p>
        </div>
        <button onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>

      <div className="inspector-pills">
        <span className={`pill priority ${order.priority.toLowerCase()}`}>{order.priority}</span>
        <span className={`pill status ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span>
      </div>

      <div className="admin-inspector-meta">
        <div>
          <span>Requested by</span>
          <strong>{order.name}</strong>
        </div>
        <div>
          <span>Requested on</span>
          <strong><CalendarDays size={13}/>{new Date(order.timestamp).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</strong>
        </div>
        <div>
          <span>Assigned to</span>
          <div className="assignment-control">
            <UserRoundPlus size={15}/>
            <select
              value={order.technician || ''}
              onChange={e => onTechnicianChange(e.target.value)}
              disabled={!isAdmin}
            >
              <option value="">Unassigned</option>
              <option>Ethan</option>
              <option>Eric</option>
              <option>Marcus Hill</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div>
          <span>Due date</span>
          <strong><CalendarDays size={13}/>Not set</strong>
        </div>
      </div>

      <div className="inspector-section">
        <label>DESCRIPTION</label>
        <p className="description-copy">{order.description}</p>
      </div>

      <div className="inspector-section">
        <label>PHOTOS ({photos.length})</label>
        <div className="admin-photo-grid">
          {photos.map((src,index)=><img key={src+index} src={src} alt={`Work order photo ${index+1}`}/>)}
          {!photos.length && <div className="admin-photo-placeholder">No photos</div>}
          <button type="button"><ImagePlus size={18}/><span>Add photos</span></button>
        </div>
      </div>

      <div className="inspector-section">
        <label>ACTIVITY TIMELINE</label>
        <div className="timeline admin-activity">
          {timeline.map(([label,done,detail,actor],index)=>(
            <div className={done ? 'timeline-item done' : 'timeline-item'} key={String(label)}>
              <div className="timeline-glyph">{done ? <CheckCircle2 size={16}/> : <Circle size={16}/>}</div>
              <div><strong>{label}</strong><span>{detail}</span><small>by {actor}</small></div>
              {index < timeline.length-1 && <i/>}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-inspector-actions">
        <select value={order.status} onChange={e=>onStatusChange(e.target.value as WorkOrderStatus)}>
          {statusOptions.map(status=><option key={status}>{status}</option>)}
        </select>

        <button className="admin-change-status" onClick={() => {
          if (canResolve && order.status !== 'Resolved') onStatusChange('Resolved');
        }}>
          <span>{order.status === 'Resolved' ? 'Resolved' : 'Change Status'}</span>
          <span>⌄</span>
        </button>

        <button className="admin-note-button" onClick={onAddInternalNote}>Add Internal Note</button>
      </div>

      <div className="admin-contact-actions" aria-hidden="true">
        <Phone size={14}/><Mail size={14}/>
      </div>
    </aside>
  );
}
