import {
  Armchair, ChevronRight, DoorOpen, Droplets, Lightbulb, Snowflake, Wifi, Wrench
} from 'lucide-react';
import type { WorkOrder } from '../types';

interface Props {
  orders: WorkOrder[];
  selectedId?: string;
  onSelect: (order: WorkOrder) => void;
}

function iconFor(category: string) {
  if (category.includes('HVAC')) return Snowflake;
  if (category.includes('Plumbing')) return Droplets;
  if (category.includes('IT')) return Wifi;
  if (category.includes('Electrical')) return Lightbulb;
  if (category.toLowerCase().includes('door')) return DoorOpen;
  if (category.toLowerCase().includes('furniture')) return Armchair;
  return Wrench;
}

function ago(timestamp: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WorkOrderQueue({ orders, selectedId, onSelect }: Props) {
  return (
    <section className="queue-panel admin-queue-panel">
      <div className="section-head admin-section-head">
        <div>
          <h2>Work Order Queue</h2>
          <span>{orders.length} results</span>
        </div>
        <button className="soft-btn">Priority first</button>
      </div>

      <div className="admin-table-head" aria-hidden="true">
        <span>Work order</span>
        <span>ID / age</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Assigned to</span>
        <span />
      </div>

      <div className="order-list admin-order-list">
        {orders.map(order => {
          const Icon = iconFor(order.category);
          return (
            <button
              key={order.ticket_id}
              className={`order-row admin-order-row ${selectedId === order.ticket_id ? 'selected' : ''}`}
              onClick={() => onSelect(order)}
            >
              <div className="order-icon"><Icon size={21} strokeWidth={1.7} /></div>
              <div className="order-primary">
                <strong>{order.title}</strong>
                <span>{order.location}</span>
              </div>
              <div className="order-id">
                <strong>{order.ticket_id}</strong>
                <span>{ago(order.timestamp)}</span>
              </div>
              <span className={`pill priority ${order.priority.toLowerCase()}`}><i />{order.priority}</span>
              <span className={`pill status ${order.status.toLowerCase().replaceAll(' ', '-')}`}><i />{order.status}</span>
              <div className="assignee">
                <span className="avatar avatar-fallback">{(order.technician || '?').slice(0, 1)}</span>
                <div>
                  <strong>{order.technician || 'Unassigned'}</strong>
                  <span>{order.technician ? 'Technician' : 'Needs assignment'}</span>
                </div>
              </div>
              <ChevronRight className="row-arrow" size={18} />
            </button>
          );
        })}

        {!orders.length && (
          <div className="empty-state">No work orders match the current filters.</div>
        )}
      </div>
    </section>
  );
}
