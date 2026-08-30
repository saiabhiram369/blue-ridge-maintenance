import { ChevronRight, MapPin } from 'lucide-react';
import type { WorkOrder } from '../types';

interface Props {
  orders: WorkOrder[];
  selectedId?: string;
  onSelect: (order: WorkOrder) => void;
}

function ago(timestamp: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function when(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, {
    month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'
  });
}

export function WorkOrderQueue({ orders, selectedId, onSelect }: Props) {
  return (
    <section className="queue-panel admin-queue-panel">
      <div className="admin-table-head" aria-hidden="true">
        <span>ID</span>
        <span>Title & location</span>
        <span>Requested by</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Assigned to</span>
        <span>Updated</span>
        <span />
      </div>

      <div className="order-list admin-order-list">
        {orders.map(order => (
          <button
            key={order.ticket_id}
            className={`admin-order-row ${selectedId === order.ticket_id ? 'selected' : ''}`}
            onClick={() => onSelect(order)}
          >
            <div className="admin-order-id">{order.ticket_id}</div>

            <div className="order-primary">
              <strong>{order.title}</strong>
              <span><MapPin size={12}/>{order.location}</span>
            </div>

            <div className="admin-requester">
              <strong>{order.name}</strong>
              <span>{when(order.timestamp)}</span>
            </div>

            <span className={`pill priority ${order.priority.toLowerCase()}`}>{order.priority}</span>

            <span className={`pill status ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span>

            <div className="admin-assigned">
              <strong>{order.technician || 'Unassigned'}</strong>
            </div>

            <div className="admin-updated">{ago(order.updated_at || order.timestamp)}</div>

            <ChevronRight className="row-arrow" size={18}/>
          </button>
        ))}

        {!orders.length && <div className="empty-state">No work orders match the current filters.</div>}
      </div>

      <div className="admin-pagination">
        <span>Showing 1 to {Math.min(orders.length, 10)} of {orders.length} results</span>
        <div>
          <button disabled>‹</button>
          <button className="active">1</button>
          <button>2</button>
          <button>3</button>
          <span>…</span>
          <button>6</button>
          <button>›</button>
        </div>
        <select defaultValue="10"><option value="10">10 / page</option><option value="25">25 / page</option></select>
      </div>
    </section>
  );
}
