import { Camera, CheckCircle2, ChevronRight, MapPin, Mountain, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
import type { Priority } from '../types';

const categories = ['IT / Technology','General Maintenance','Electrical','Plumbing','HVAC / Climate','Carpentry / Structural','Grounds / Landscaping','Cleaning / Sanitation','Other'];
const priorities: Priority[] = ['Low','Medium','High','Urgent'];
const emptyForm = { name:'', email:'', phone:'', category:'', location:'', title:'', description:'', priority:'' as Priority | '' };

export function PublicRequest() {
  const [form,setForm] = useState(emptyForm);
  const [files,setFiles] = useState<File[]>([]);
  const [busy,setBusy] = useState(false);
  const [ticket,setTicket] = useState('');
  const [error,setError] = useState('');
  const set = (key:keyof typeof form,value:string) => setForm(v => ({...v,[key]:value}));

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const ticketId = 'BR-' + crypto.randomUUID().slice(0,8).toUpperCase();
    try {
      if (!form.priority) throw new Error('Please choose a priority.');
      if (files.some(f => f.size > 5*1024*1024)) throw new Error('Each attachment must be 5 MB or smaller.');
      const photoUrls:string[] = [];
      if (!demoMode && supabase) {
        for (const [index,file] of files.slice(0,5).entries()) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
          const path = `${ticketId}/${index+1}-${safeName}`;
          const { error:uploadError } = await supabase.storage.from('maintenance-photos').upload(path,file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
          photoUrls.push(data.publicUrl);
        }
        const { error:insertError } = await supabase.from('maintenance_requests').insert({
          ticket_id:ticketId,timestamp:new Date().toISOString(),name:form.name,email:form.email,
          phone:form.phone||null,category:form.category,location:form.location,title:form.title,
          description:form.description,priority:form.priority,original_priority:form.priority,
          priority_overridden:false,status:'Open',photos:photoUrls,tech_note_seen:true,tech_marked_done:false
        });
        if (insertError) throw insertError;
      }
      setTicket(ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally { setBusy(false); }
  }

  if (ticket) return (
    <main className="maintenance-page">
      <section className="maintenance-success">
        <div className="maintenance-success-icon"><CheckCircle2 size={28}/></div>
        <span className="maintenance-eyebrow">REQUEST RECEIVED</span>
        <h1>Thank you.</h1>
        <p>Your maintenance request has been created successfully.</p>
        <div className="maintenance-ticket">{ticket}</div>
        <button onClick={() => { setTicket(''); setForm(emptyForm); setFiles([]); }}>Submit another request</button>
      </section>
    </main>
  );

  return (
    <main className="maintenance-page">
      <header className="maintenance-header">
        <div className="maintenance-brand">
          <span className="maintenance-logo"><Mountain size={20}/></span>
          <div>
            <strong>Blue Ridge Preservation Maintenance</strong>
            <small>Art of Living Retreat Center · Boone, NC</small>
          </div>
        </div>
        <div className="maintenance-secure"><ShieldCheck size={14}/> Secure request portal</div>
      </header>

      <section className="maintenance-intro">
        <span className="maintenance-eyebrow">FACILITY SERVICES</span>
        <h1>Maintenance Request</h1>
        <p>Tell us what needs attention. Provide the location and details below, and our facilities team will take it from there.</p>
      </section>

      <form className="maintenance-card" onSubmit={submit}>
        <section className="maintenance-section">
          <div className="maintenance-section-heading"><span>01</span><div><h2>Contact information</h2><p>How we can reach you if we need more details.</p></div></div>
          <div className="maintenance-grid two-col">
            <label>Full name<input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Your full name"/></label>
            <label>Email<input required type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@example.com"/></label>
          </div>
          <label>Phone <small>Optional</small><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="(828) 555-0123" inputMode="tel"/></label>
        </section>

        <section className="maintenance-section">
          <div className="maintenance-section-heading"><span>02</span><div><h2>Request details</h2><p>Tell us what happened and where we should go.</p></div></div>
          <div className="maintenance-grid two-col">
            <label>Category<select required value={form.category} onChange={e=>set('category',e.target.value)}><option value="">Select category</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
            <label>Location<div className="maintenance-icon-field"><MapPin size={15}/><input required value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Cedar Lodge · Room 12"/></div></label>
          </div>
          <label>Issue title<input required value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Briefly describe the issue"/></label>
          <label>Description<textarea required value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What happened? When did it start? Is anyone impacted?"/></label>
        </section>

        <section className="maintenance-section maintenance-final-section">
          <div className="maintenance-grid priority-upload-grid">
            <fieldset className="maintenance-priority"><legend>Priority</legend><div>
              {priorities.map(p=><button type="button" key={p} className={form.priority===p?`selected ${p.toLowerCase()}`:p.toLowerCase()} onClick={()=>set('priority',p)}><i/>{p}</button>)}
            </div></fieldset>
            <label className="maintenance-upload">
              <input type="file" accept="image/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,5))}/>
              <Camera size={18}/>
              <span><strong>{files.length?`${files.length} photo${files.length>1?'s':''} selected`:'Add photos'}</strong><small>Optional · up to 5 images</small></span>
            </label>
          </div>
        </section>

        {error && <div className="maintenance-error">{error}</div>}
        <button className="maintenance-submit" disabled={busy}><span>{busy?'Submitting…':'Submit maintenance request'}</span><ChevronRight size={18}/></button>
        <div className="maintenance-privacy"><ShieldCheck size={13}/>Your request is securely recorded and visible only to authorized facilities staff.</div>
      </form>
    </main>
  );
}
