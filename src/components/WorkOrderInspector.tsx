import {
  CalendarDays, CheckCircle2, Circle, MapPin, UserRoundPlus, X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
import type { WorkOrder, WorkOrderStatus } from '../types';

interface Props {
  order: WorkOrder | null;
  onClose: () => void;
  onStatusChange: (status: WorkOrderStatus) => void;
  onTechnicianChange: (technician: string) => void;
  onAddInternalNote: () => void;
  onMarkWorkDone: () => void;
  isAdmin: boolean;
  isTechnician: boolean;
  canResolve: boolean;
}

const adminStatuses: WorkOrderStatus[] = ['Open', 'In Progress', 'On Hold', 'Pending Tiffany', 'Resolved'];

export function WorkOrderInspector({
  order,
  onClose,
  onStatusChange,
  onTechnicianChange,
  onAddInternalNote,
  onMarkWorkDone,
  isAdmin,
  isTechnician,
  canResolve
}: Props) {
  const [techNoteDraft, setTechNoteDraft] = useState(order?.tech_note || '');
  const [savingTechNote, setSavingTechNote] = useState(false);
  const [techNoteMessage, setTechNoteMessage] = useState('');

  useEffect(() => {
    setTechNoteDraft(order?.tech_note || '');
    setTechNoteMessage('');
  }, [order?.ticket_id, order?.tech_note]);

  if (!order) return (
    <aside className="inspector admin-inspector inspector-empty">
      <div>
        <span className="empty-orb"/>
        <h3>Select a work order</h3>
        <p>Details, assignment, photos and activity will appear here.</p>
      </div>
    </aside>
  );

  const ticketId = order.ticket_id;
  const statusOptions = adminStatuses.filter(status =>
    status !== 'Resolved'
    || order.status === 'Resolved'
    || (canResolve && order.status === 'Pending Tiffany')
  );

  const timeline = [
    ['Created', true, new Date(order.timestamp).toLocaleString(), order.name],
    ['Assigned to ' + (order.technician || 'technician'), !!order.technician, order.technician ? 'Assignment confirmed' : 'Awaiting assignment', order.supervisor || 'Operations'],
    ['In Progress', ['In Progress','Pending Tiffany','Resolved'].includes(order.status), order.status === 'Open' ? 'Pending' : 'Work started', order.technician || 'Technician'],
    ['Pending admin approval', ['Pending Tiffany','Resolved'].includes(order.status), order.tech_marked_done ? 'Technician marked work complete' : 'Awaiting technician completion', order.technician || 'Technician'],
    ['Resolved / Closed', order.status === 'Resolved', order.status === 'Resolved' ? 'Verified and closed' : 'Awaiting admin verification', 'Admin']
  ] as const;

  const photos = (order.photos || []).filter(Boolean).slice(0,2);
  const awaitingTiffany = order.status === 'Pending Tiffany' || !!order.tech_marked_done;
  const resolved = order.status === 'Resolved';

  async function saveTechnicianNote() {
    if (!isTechnician || resolved || savingTechNote) return;

    const note = techNoteDraft.trim();
    setSavingTechNote(true);
    setTechNoteMessage('');

    if (demoMode) {
      setTechNoteMessage('Demo: technician note saved and admin notified.');
      setSavingTechNote(false);
      return;
    }

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        tech_note: note || null,
        tech_note_seen: false,
        updated_at: new Date().toISOString()
      })
      .eq('ticket_id', ticketId);

    if (error) {
      setTechNoteMessage(error.message);
    } else {
      setTechNoteMessage(note
        ? 'Technician note saved. The admin team has been notified.'
        : 'Technician note cleared.');
    }

    setSavingTechNote(false);
  }

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
          <strong>
            <CalendarDays size={13}/>
            {new Date(order.timestamp).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
          </strong>
        </div>
        <div>
          <span>Assigned to</span>
          {isAdmin ? (
            <div className="assignment-control">
              <UserRoundPlus size={15}/>
              <select
                value={order.technician || ''}
                onChange={e => onTechnicianChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                <option>Abhiram</option>
                <option>Ethan</option>
                <option>Eric</option>
              </select>
            </div>
          ) : (
            <strong>{order.technician || 'Unassigned'}</strong>
          )}
        </div>
        <div>
          <span>Final approval</span>
          <strong>{resolved ? 'Verified by admin' : 'Tiffany primary · admin fallback'}</strong>
        </div>
      </div>

      <div className="inspector-section">
        <label>DESCRIPTION</label>
        <p className="description-copy">{order.description}</p>
      </div>

      <div className="inspector-section">
        <label>PHOTOS ({photos.length})</label>
        <div className="admin-photo-grid tech-readonly-photos">
          {photos.map((src,index)=><img key={src+index} src={src} alt={`Work order photo ${index+1}`}/>)}
          {!photos.length && <div className="admin-photo-placeholder">No photos</div>}
        </div>
      </div>

      {(isTechnician || !!order.tech_note) && (
        <div className="inspector-section">
          <label>TECHNICIAN NOTES</label>

          {isTechnician && !resolved ? (
            <>
              <textarea
                value={techNoteDraft}
                onChange={e => setTechNoteDraft(e.target.value)}
                disabled={savingTechNote}
                maxLength={2000}
                placeholder="Add what happened, troubleshooting details, parts needed or ordered, work performed, and follow-up information for the admin team."
                style={{
                  width:'100%',
                  minHeight:120,
                  resize:'vertical',
                  boxSizing:'border-box',
                  border:'1px solid rgba(15,23,42,.14)',
                  borderRadius:14,
                  padding:'12px 14px',
                  font:'inherit',
                  lineHeight:1.5,
                  background:'#fff',
                  color:'inherit',
                  outline:'none'
                }}
              />

              <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:10,flexWrap:'wrap'}}>
                <small style={{opacity:.66}}>
                  {order.status === 'On Hold'
                    ? 'Keep this note updated while parts or follow-up work are pending.'
                    : order.status === 'Pending Tiffany'
                      ? 'You can continue updating this note while the admin reviews the work.'
                      : `${techNoteDraft.length}/2000 characters`}
                </small>

                <button
                  type="button"
                  className="admin-note-button"
                  onClick={saveTechnicianNote}
                  disabled={savingTechNote}
                >
                  {savingTechNote ? 'Saving…' : 'Save Technician Note'}
                </button>
              </div>

              {techNoteMessage && (
                <div style={{marginTop:10,fontSize:13,fontWeight:600}} role="status">
                  {techNoteMessage}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="description-copy">{order.tech_note || 'No technician notes were added.'}</p>
              {isTechnician && resolved && (
                <small style={{opacity:.66}}>This work order has been closed by an admin, so the technician log is read-only.</small>
              )}
            </>
          )}
        </div>
      )}

      <div className="inspector-section">
        <label>ACTIVITY TIMELINE</label>
        <div className="timeline admin-activity">
          {timeline.map(([label,done,detail,actor],index)=>(
            <div className={done ? 'timeline-item done' : 'timeline-item'} key={String(label)}>
              <div className="timeline-glyph">{done ? <CheckCircle2 size={16}/> : <Circle size={16}/>}</div>
              <div>
                <strong>{label}</strong>
                <span>{detail}</span>
                <small>by {actor}</small>
              </div>
              {index < timeline.length-1 && <i/>}
            </div>
          ))}
        </div>
      </div>

      {isTechnician && (
        <div className="tech-workflow-actions">
          {resolved ? (
            <div className="tech-workflow-message resolved">
              <CheckCircle2 size={18}/>
              <div>
                <strong>Work order closed</strong>
                <span>An authorized admin verified the work and closed this request.</span>
              </div>
            </div>
          ) : awaitingTiffany ? (
            <div className="tech-workflow-message waiting">
              <CheckCircle2 size={18}/>
              <div>
                <strong>Work submitted for review</strong>
                <span>You can continue updating technician notes while the admin reviews the work. The admin may close it or put it on hold for parts or additional work.</span>
              </div>
            </div>
          ) : (
            <>
              <p className="tech-action-help">
                Keep the technician note updated with what happened, parts needed, work performed, and follow-up details. When the work is ready for admin review, mark it done.
              </p>
              <button className="tech-mark-done-button" onClick={onMarkWorkDone}>
                <CheckCircle2 size={18}/>
                Mark Work Done
              </button>
            </>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="admin-inspector-actions">
          <select value={order.status} onChange={e=>onStatusChange(e.target.value as WorkOrderStatus)}>
            {statusOptions.map(status=><option key={status}>{status}</option>)}
          </select>

          {canResolve && order.status === 'Pending Tiffany' && !resolved && (
            <button className="admin-change-status" onClick={() => onStatusChange('Resolved')}>
              <span>Verify & Close Work Order</span>
              <CheckCircle2 size={17}/>
            </button>
          )}

          <button className="admin-note-button" onClick={onAddInternalNote}>Add Internal Note</button>
        </div>
      )}
    </aside>
  );
}
