import { Camera, CheckCircle2, ChevronRight, Mountain, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
import type { Priority } from '../types';

const categories = ['IT / Technology','General Maintenance','Electrical','Plumbing','HVAC / Climate','Carpentry / Structural','Grounds / Landscaping','Cleaning / Sanitation','Other'];
const priorities: Priority[] = ['Low','Medium','High','Urgent'];

export function PublicRequest() {
  const [form, setForm] = useState({ name:'', email:'', phone:'', category:'', location:'', title:'', description:'', priority:'' as Priority | '' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');

  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const ticketId = 'BR-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    try {
      if (!form.priority) throw new Error('Choose a priority.');
      if (files.some(file => file.size > 5 * 1024 * 1024)) throw new Error('Each attachment must be 5 MB or smaller.');
      const photoUrls: string[] = [];

      if (!demoMode && supabase) {
        for (const [index, file] of files.slice(0, 5).entries()) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${ticketId}/${index + 1}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from('maintenance-photos').upload(path, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
          photoUrls.push(data.publicUrl);
        }

        const { error: insertError } = await supabase.from('maintenance_requests').insert({
          ticket_id: ticketId,
          timestamp: new Date().toISOString(),
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          category: form.category,
          location: form.location,
          title: form.title,
          description: form.description,
          priority: form.priority,
          original_priority: form.priority,
          priority_overridden: false,
          status: 'Open',
          photos: photoUrls,
          tech_note_seen: true,
          tech_marked_done: false
        });
        if (insertError) throw insertError;
      }
      setTicket(ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setBusy(false);
    }
  }

  if (ticket) return (
    <main className="request-page">
      <section className="request-success glass">
        <div className="success-orb"><CheckCircle2 /></div>
        <span className="eyebrow">Request received</span>
        <h1>We’re on it.</h1>
        <p>Your work order has been created and routed to the facilities team.</p>
        <div className="ticket-number">{ticket}</div>
        <button onClick={() => { setTicket(''); setForm({ name:'',email:'',phone:'',category:'',location:'',title:'',description:'',priority:'' }); setFiles([]); }}>Submit another request</button>
      </section>
    </main>
  );

  return (
    <main className="request-page">
      <header className="request-brand">
        <div className="request-brand-lockup"><Mountain size={23}/><span>BLUE RIDGE<small>FACILITIES</small></span></div>
        <div className="request-secure"><ShieldCheck size={14}/> Secure facility services</div>
      </header>

      <section className="request-hero glass">
        <div>
          <span className="eyebrow">ART OF LIVING RETREAT CENTER · BOONE, NC</span>
          <h1>Property care,<br/><em>beautifully managed.</em></h1>
          <p>Tell us what needs attention. We’ll route your request to the right facilities professional and keep the team aligned through resolution.</p>
        </div>
        <div className="request-monogram">BR</div>
      </section>

      <form className="request-form" onSubmit={submit}>
        <section className="form-glass glass">
          <div className="form-section-head"><span>01</span><div><h2>Your details</h2><p>How the facilities team can reach you.</p></div></div>
          <div className="form-grid two-col">
            <label>Full name<input required value={form.name} onChange={e => set('name',e.target.value)} placeholder="Your full name"/></label>
            <label>Email<input required type="email" value={form.email} onChange={e => set('email',e.target.value)} placeholder="you@example.com"/></label>
          </div>
          <label>Phone <small>optional</small><input value={form.phone} onChange={e => set('phone',e.target.value)} placeholder="(828) 555-0123"/></label>
        </section>

        <section className="form-glass glass">
          <div className="form-section-head"><span>02</span><div><h2>Work order</h2><p>Give us enough context to route and prioritize it correctly.</p></div></div>
          <div className="form-grid two-col">
            <label>Category<select required value={form.category} onChange={e => set('category',e.target.value)}><option value="">Select category</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Location<input required value={form.location} onChange={e => set('location',e.target.value)} placeholder="Cedar Lodge · Room 12"/></label>
          </div>
          <label>Issue title<input required value={form.title} onChange={e => set('title',e.target.value)} placeholder="AC blowing warm air"/></label>
          <label>Description<textarea required value={form.description} onChange={e => set('description',e.target.value)} placeholder="Describe what you’re seeing, when it started, and any immediate impact."/></label>

          <fieldset className="priority-field"><legend>Priority</legend><div className="priority-picker">
            {priorities.map(p => <button type="button" key={p} className={form.priority===p ? `selected ${p.toLowerCase()}` : p.toLowerCase()} onClick={() => set('priority',p)}><i />{p}</button>)}
          </div></fieldset>

          <label className="upload-field"><input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0,5))}/><Camera size={22}/><strong>Add photos</strong><span>{files.length ? `${files.length} selected` : 'Up to 5 images · 5 MB each'}</span></label>
        </section>

        {error && <div className="request-error">{error}</div>}
        <button className="request-submit" disabled={busy}>{busy ? 'Creating work order…' : <>Create work order <ChevronRight size={18}/></>}</button>
      </form>
    </main>
  );
}
