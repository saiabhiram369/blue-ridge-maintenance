import {
  Camera, CheckCircle2, ChevronRight, Clock3, MapPin, Mountain,
  ShieldCheck, Sparkles, Wrench, Zap
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
import type { Priority } from '../types';

const categories = ['IT / Technology','General Maintenance','Electrical','Plumbing','HVAC / Climate','Carpentry / Structural','Grounds / Landscaping','Cleaning / Sanitation','Other'];
const priorities: Priority[] = ['Low','Medium','High','Urgent'];

export function PublicRequest() {
  const [form, setForm] = useState({
    name:'', email:'', phone:'', category:'', location:'', title:'', description:'',
    priority:'' as Priority | ''
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');

  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));

  const routePreview = useMemo(() => {
    if (!form.category && !form.location && !form.priority) {
      return { team:'Awaiting request details', eta:'Routing begins instantly', tone:'neutral' };
    }

    const team =
      form.category.includes('HVAC') ? 'HVAC / Climate team' :
      form.category.includes('Plumbing') ? 'Plumbing team' :
      form.category.includes('Electrical') ? 'Electrical team' :
      form.category.includes('IT') ? 'Technology team' :
      form.category ? 'Facilities operations' : 'Facilities triage';

    const eta =
      form.priority === 'Urgent' ? 'Immediate escalation' :
      form.priority === 'High' ? 'Priority response' :
      form.priority === 'Medium' ? 'Standard response' :
      form.priority === 'Low' ? 'Scheduled service' :
      'Priority pending';

    return { team, eta, tone: form.priority ? form.priority.toLowerCase() : 'neutral' };
  }, [form.category, form.location, form.priority]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ticketId = 'BR-' + crypto.randomUUID().slice(0, 8).toUpperCase();

    try {
      if (!form.priority) throw new Error('Choose a priority.');
      if (files.some(file => file.size > 5 * 1024 * 1024)) {
        throw new Error('Each attachment must be 5 MB or smaller.');
      }

      const photoUrls: string[] = [];

      if (!demoMode && supabase) {
        for (const [index, file] of files.slice(0, 5).entries()) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${ticketId}/${index + 1}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from('maintenance-photos')
            .upload(path, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('maintenance-photos')
            .getPublicUrl(path);

          photoUrls.push(data.publicUrl);
        }

        const { error: insertError } = await supabase
          .from('maintenance_requests')
          .insert({
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

  if (ticket) {
    return (
      <main className="portal-page">
        <div className="portal-aurora aurora-one" />
        <div className="portal-aurora aurora-two" />
        <section className="portal-success glass">
          <div className="success-halo"><CheckCircle2 size={30}/></div>
          <span className="portal-kicker">WORK ORDER CREATED</span>
          <h1>Consider it handled.</h1>
          <p>Your request is now in the Blue Ridge facilities workflow.</p>
          <div className="portal-ticket">{ticket}</div>
          <button onClick={() => {
            setTicket('');
            setForm({ name:'',email:'',phone:'',category:'',location:'',title:'',description:'',priority:'' });
            setFiles([]);
          }}>
            Create another request
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="portal-page">
      <div className="portal-aurora aurora-one" />
      <div className="portal-aurora aurora-two" />
      <div className="portal-gridlines" />

      <header className="portal-nav">
        <div className="portal-brand">
          <div className="portal-brand-icon"><Mountain size={20}/></div>
          <div><strong>BLUE RIDGE</strong><small>FACILITIES</small></div>
        </div>

        <div className="portal-nav-right">
          <span><i className="online-dot"/> Facilities online</span>
          <span><ShieldCheck size={14}/> Secure request portal</span>
        </div>
      </header>

      <section className="portal-stage">
        <aside className="experience-panel">
          <div className="experience-copy">
            <span className="portal-kicker">ART OF LIVING RETREAT CENTER · BOONE, NC</span>
            <h1>Care for every<br/>space. <em>Precisely.</em></h1>
            <p>
              One premium workflow for every facility issue—from first report to final resolution.
            </p>
          </div>

          <div className="service-visual glass">
            <div className="service-visual-top">
              <span><Sparkles size={14}/> Intelligent routing</span>
              <small>LIVE SERVICE LAYER</small>
            </div>

            <div className="service-orbit">
              <div className="orbit-ring ring-one"/>
              <div className="orbit-ring ring-two"/>
              <div className="orbit-core">
                <span>BR</span>
                <small>FACILITIES</small>
              </div>

              <div className="orbit-chip chip-hvac"><i/> HVAC</div>
              <div className="orbit-chip chip-it"><i/> IT</div>
              <div className="orbit-chip chip-plumbing"><i/> PLUMBING</div>
              <div className="orbit-chip chip-electrical"><i/> ELECTRICAL</div>
            </div>

            <div className="service-metrics">
              <div><Clock3 size={15}/><span><strong>7 min</strong><small>avg. acknowledgement</small></span></div>
              <div><Zap size={15}/><span><strong>24/7</strong><small>urgent escalation</small></span></div>
              <div><Wrench size={15}/><span><strong>On-site</strong><small>facilities team</small></span></div>
            </div>
          </div>
        </aside>

        <form className="composer glass" onSubmit={submit}>
          <div className="composer-glow" />

          <div className="composer-head">
            <div>
              <span className="portal-kicker">NEW WORK ORDER</span>
              <h2>What needs attention?</h2>
              <p>Tell us once. We’ll take it from here.</p>
            </div>
            <div className="composer-step"><span>01</span><small>OF 01</small></div>
          </div>

          <div className="composer-section">
            <div className="composer-section-label">
              <span>CONTACT</span>
              <i/>
            </div>

            <div className="composer-grid two">
              <label>
                Full name
                <input required value={form.name} onChange={e => set('name',e.target.value)} placeholder="Your full name"/>
              </label>
              <label>
                Email
                <input required type="email" value={form.email} onChange={e => set('email',e.target.value)} placeholder="you@example.com"/>
              </label>
            </div>
          </div>

          <div className="composer-section">
            <div className="composer-section-label">
              <span>REQUEST</span>
              <i/>
            </div>

            <div className="composer-grid two">
              <label>
                Category
                <select required value={form.category} onChange={e => set('category',e.target.value)}>
                  <option value="">Select service</option>
                  {categories.map(category => <option key={category}>{category}</option>)}
                </select>
              </label>

              <label>
                Location
                <div className="field-with-icon">
                  <MapPin size={15}/>
                  <input required value={form.location} onChange={e => set('location',e.target.value)} placeholder="Cedar Lodge · Room 12"/>
                </div>
              </label>
            </div>

            <label>
              Issue title
              <input required value={form.title} onChange={e => set('title',e.target.value)} placeholder="Describe the issue in a few words"/>
            </label>

            <label>
              Description
              <textarea required value={form.description} onChange={e => set('description',e.target.value)} placeholder="What happened? When did it start? Is anyone impacted?"/>
            </label>
          </div>

          <div className="composer-bottom-grid">
            <fieldset className="portal-priority">
              <legend>Priority</legend>
              <div>
                {priorities.map(priority => (
                  <button
                    type="button"
                    key={priority}
                    className={form.priority === priority ? `selected ${priority.toLowerCase()}` : priority.toLowerCase()}
                    onClick={() => set('priority',priority)}
                  >
                    <i/>{priority}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="portal-upload">
              <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []).slice(0,5))}/>
              <Camera size={17}/>
              <span><strong>{files.length ? `${files.length} photo${files.length > 1 ? 's' : ''} ready` : 'Add photos'}</strong><small>Optional · up to 5</small></span>
            </label>
          </div>

          <div className={`routing-preview ${routePreview.tone}`}>
            <div className="routing-icon"><Sparkles size={16}/></div>
            <div>
              <small>ROUTING PREVIEW</small>
              <strong>{routePreview.team}</strong>
            </div>
            <span>{routePreview.eta}</span>
          </div>

          {error && <div className="request-error">{error}</div>}

          <button className="composer-submit" disabled={busy}>
            <span>{busy ? 'Creating work order…' : 'Create work order'}</span>
            <ChevronRight size={18}/>
          </button>

          <div className="composer-foot">
            <ShieldCheck size={13}/>
            <span>Your request is securely recorded and visible only to authorized facilities staff.</span>
          </div>
        </form>
      </section>
    </main>
  );
}
