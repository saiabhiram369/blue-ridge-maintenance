import { Activity, CalendarDays, CheckCircle2, Clock3, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkOrder } from '../types';

interface Props {
  orders: WorkOrder[];
}

type RangeMode = 'week' | 'month';

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0,0,0,0);
  return next;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function AdminInsights({ orders }: Props) {
  const [range, setRange] = useState<RangeMode>('week');
  const today = new Date();

  const analytics = useMemo(() => {
    const start = range === 'week'
      ? startOfWeek(today)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const end = range === 'week'
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
      : new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const scoped = orders.filter(order => {
      const date = toDate(order.timestamp);
      return !!date && date >= start && date < end;
    });

    const resolved = scoped.filter(order => order.status === 'Resolved').length;
    const pending = scoped.filter(order => order.status === 'Pending Tiffany').length;
    const completionRate = scoped.length ? Math.round((resolved / scoped.length) * 100) : 0;

    const buckets = range === 'week'
      ? Array.from({ length:7 }, (_, index) => {
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          return {
            key: date.toISOString(),
            label: date.toLocaleDateString(undefined,{weekday:'short'}),
            count: scoped.filter(order => {
              const created = toDate(order.timestamp);
              return !!created && sameDay(created,date);
            }).length
          };
        })
      : Array.from({ length:4 }, (_, index) => {
          const from = new Date(start);
          from.setDate(1 + index * 7);
          const to = new Date(start);
          to.setDate(1 + (index + 1) * 7);
          return {
            key: String(index),
            label: `W${index + 1}`,
            count: scoped.filter(order => {
              const created = toDate(order.timestamp);
              return !!created && created >= from && created < to;
            }).length
          };
        });

    const max = Math.max(1, ...buckets.map(item => item.count));

    const priorities = ['Urgent','High','Medium','Low'].map(priority => ({
      priority,
      count: scoped.filter(order => order.priority === priority).length
    }));
    const pMax = Math.max(1, ...priorities.map(item => item.count));

    return { scoped, resolved, pending, completionRate, buckets, max, priorities, pMax };
  }, [orders, range]);

  const calendar = useMemo(() => {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const mondayIndex = (first.getDay() + 6) % 7;
    const cells: Array<{ date: Date | null; created:number; closed:number }> = [];

    for (let index = 0; index < mondayIndex; index++) {
      cells.push({ date:null, created:0, closed:0 });
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const date = new Date(today.getFullYear(), today.getMonth(), day);
      const created = orders.filter(order => {
        const createdAt = toDate(order.timestamp);
        return !!createdAt && sameDay(createdAt,date);
      }).length;
      const closed = orders.filter(order => {
        if (order.status !== 'Resolved') return false;
        const closedAt = toDate(order.updated_at || order.timestamp);
        return !!closedAt && sameDay(closedAt,date);
      }).length;
      cells.push({ date, created, closed });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date:null, created:0, closed:0 });
    }

    return cells;
  }, [orders]);

  return (
    <section className="insights-shell">
      <div className="analytics-card perspective-card">
        <div className="insights-card-head">
          <div>
            <span className="insights-kicker"><Activity size={14}/> PERFORMANCE</span>
            <h2>Operations analytics</h2>
            <p>Live workload and completion trends from work-order activity.</p>
          </div>
          <div className="range-toggle">
            <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>Week</button>
            <button className={range === 'month' ? 'active' : ''} onClick={() => setRange('month')}>Month</button>
          </div>
        </div>

        <div className="analytics-summary">
          <div>
            <span><TrendingUp size={14}/> Created</span>
            <strong>{analytics.scoped.length}</strong>
          </div>
          <div>
            <span><CheckCircle2 size={14}/> Completed</span>
            <strong>{analytics.resolved}</strong>
          </div>
          <div>
            <span><Clock3 size={14}/> Pending Tiffany</span>
            <strong>{analytics.pending}</strong>
          </div>
          <div>
            <span>Completion rate</span>
            <strong>{analytics.completionRate}%</strong>
          </div>
        </div>

        <div className="analytics-chart-wrap">
          <div className="analytics-chart">
            {analytics.buckets.map(item => (
              <div className="chart-column" key={item.key}>
                <div className="chart-value">{item.count}</div>
                <div className="chart-track">
                  <i style={{ height:`${Math.max(8,(item.count / analytics.max) * 100)}%` }} />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="priority-mix">
            <span className="mini-heading">Priority mix</span>
            {analytics.priorities.map(item => (
              <div className="priority-line" key={item.priority}>
                <span>{item.priority}</span>
                <div><i className={item.priority.toLowerCase()} style={{ width:`${Math.max(5,(item.count / analytics.pMax) * 100)}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-glow analytics-glow-a"/>
        <div className="analytics-glow analytics-glow-b"/>
      </div>

      <div className="calendar-card perspective-card">
        <div className="insights-card-head compact">
          <div>
            <span className="insights-kicker"><CalendarDays size={14}/> SCHEDULE</span>
            <h2>{today.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2>
          </div>
          <span className="calendar-legend"><i/> created <b/> closed</span>
        </div>

        <div className="calendar-weekdays">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {calendar.map((cell,index) => (
            <div
              className={[
                'calendar-day',
                cell.date && sameDay(cell.date,today) ? 'today' : '',
                cell.created || cell.closed ? 'has-work' : ''
              ].join(' ')}
              key={index}
            >
              {cell.date && (
                <>
                  <strong>{cell.date.getDate()}</strong>
                  <div className="calendar-dots">
                    {cell.created > 0 && <span title={`${cell.created} created`}>{cell.created}</span>}
                    {cell.closed > 0 && <b title={`${cell.closed} closed`}>{cell.closed}</b>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="calendar-footer">
          <span><i/> {orders.filter(order => order.status === 'Pending Tiffany').length} awaiting verification</span>
          <span><b/> {orders.filter(order => order.status === 'Resolved').length} closed total</span>
        </div>
      </div>
    </section>
  );
}
