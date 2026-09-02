import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));

  useEffect(() => {
    setPage(current => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [orders.length, pageSize]);

  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return orders.slice(start, start + pageSize);
  }, [orders, page, pageSize]);

  const startRow = orders.length ? (page - 1) * pageSize + 1 : 0;
  const endRow = Math.min(page * pageSize, orders.length);

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
        {visible.map(order => (
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
        <span>Showing {startRow} to {endRow} of {orders.length} results</span>

        <div className="pager-controls">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}
          >
            <ChevronLeft size={14}/>
          </button>

          <span className="pager-page">Page {page} of {totalPages}</span>

          <button
            type="button"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => setPage(value => Math.min(totalPages, value + 1))}
          >
            <ChevronRight size={14}/>
          </button>
        </div>

        <select
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          aria-label="Rows per page"
        >
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
        </select>
      </div>
    </section>
  );
}
