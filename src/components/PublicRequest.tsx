import {
  Camera, CheckCircle2, ChevronRight, ClipboardList, Mail, MapPin, Menu,
  Phone, ShieldCheck, Sparkles, UserRound
} from 'lucide-react';
import { useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
import type { Priority } from '../types';

const AOL_LOGO = 'data:image/jpeg;base64,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';
const categories = ['IT / Technology','General Maintenance','Electrical','Plumbing','HVAC / Climate','Carpentry / Structural','Grounds / Landscaping','Cleaning / Sanitation','Other'];
const priorities: Priority[] = ['Low','Medium','High','Urgent'];
const emptyForm = {name:'',email:'',phone:'',category:'',location:'',title:'',description:'',priority:'' as Priority|''};

export function PublicRequest(){
  const [form,setForm]=useState(emptyForm);
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [ticket,setTicket]=useState('');
  const [error,setError]=useState('');
  const set=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}));

  async function submit(e:React.FormEvent){
    e.preventDefault(); setBusy(true); setError('');
    const ticketId='BR-'+crypto.randomUUID().slice(0,8).toUpperCase();
    try{
      if(!form.priority) throw new Error('Please choose a priority.');
      if(files.some(f=>f.size>5*1024*1024)) throw new Error('Each attachment must be 5 MB or smaller.');
      const photoUrls:string[]=[];
      if(!demoMode&&supabase){
        for(const [index,file] of files.slice(0,5).entries()){
          const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
          const path=`${ticketId}/${index+1}-${safe}`;
          const {error:uploadError}=await supabase.storage.from('maintenance-photos').upload(path,file);
          if(uploadError) throw uploadError;
          const {data}=supabase.storage.from('maintenance-photos').getPublicUrl(path);
          photoUrls.push(data.publicUrl);
        }
        const {error:insertError}=await supabase.from('maintenance_requests').insert({
          ticket_id:ticketId,timestamp:new Date().toISOString(),name:form.name,email:form.email,
          phone:form.phone||null,category:form.category,location:form.location,title:form.title,
          description:form.description,priority:form.priority,original_priority:form.priority,
          priority_overridden:false,status:'Open',photos:photoUrls,tech_note_seen:true,tech_marked_done:false
        });
        if(insertError) throw insertError;
      }
      setTicket(ticketId);
    }catch(err){setError(err instanceof Error?err.message:'Unable to submit request.')}
    finally{setBusy(false)}
  }

  if(ticket) return <main className="ref-page">
    <div className="ref-mountains" aria-hidden="true"><i/><i/><i/></div>
    <section className="ref-success">
      <div><CheckCircle2 size={30}/></div><span>REQUEST RECEIVED</span><h1>Thank you.</h1>
      <p>Your maintenance request has been created successfully.</p>
      <strong>{ticket}</strong>
      <button onClick={()=>{setTicket('');setForm(emptyForm);setFiles([])}}>Submit another request</button>
    </section>
  </main>;

  return <main className="ref-page">
    <div className="ref-mountains" aria-hidden="true"><i/><i/><i/></div>

    <header className="ref-desktop-header">
      <img src={AOL_LOGO} alt="The Art of Living Retreat Center"/>
      <div className="ref-header-copy">
        <strong>Blue Ridge Preservation Maintenance</strong>
        <span><ShieldCheck size={13}/>Secure facility services</span>
      </div>
    </header>

    <header className="ref-mobile-header">
      <button type="button" aria-label="Menu"><Menu size={22}/></button>
      <img src={AOL_LOGO} alt="The Art of Living Retreat Center"/>
      <span/>
    </header>

    <form className="ref-card" onSubmit={submit}>
      <div className="ref-card-intro">
        <div>
          <span className="ref-kicker">NEW MAINTENANCE REQUEST</span>
          <h1>How can we help?</h1>
          <p>Tell us what needs attention. We’ll route your request to the right team and keep you updated.</p>
        </div>
        <div className="ref-step"><strong>01</strong><small>of 01</small></div>
      </div>

      <section className="ref-section">
        <div className="ref-section-title"><span><UserRound size={17}/></span><strong>CONTACT INFORMATION</strong></div>
        <div className="ref-grid two">
          <label>Full name<div className="ref-field"><UserRound size={15}/><input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Your full name"/></div></label>
          <label>Email address<div className="ref-field"><Mail size={15}/><input required type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@example.com"/></div></label>
        </div>
        <label>Phone <small>(optional)</small><div className="ref-field"><Phone size={15}/><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="(828) 555-0123"/></div></label>
      </section>

      <section className="ref-section">
        <div className="ref-section-title"><span><ClipboardList size={17}/></span><strong>REQUEST DETAILS</strong></div>
        <div className="ref-grid two">
          <label>Category<select required value={form.category} onChange={e=>set('category',e.target.value)}><option value="">Select service category</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Location<div className="ref-field"><MapPin size={15}/><input required value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Cedar Lodge · Room 12"/></div></label>
        </div>
        <label>Issue title<input required value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Describe the issue in a few words"/></label>
        <label>Description<textarea required value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What happened? When did it start? Is anyone impacted?"/></label>
      </section>

      <div className="ref-bottom-grid">
        <fieldset className="ref-priority"><legend>Priority</legend><div>
          {priorities.map(p=><button type="button" key={p} className={form.priority===p?'selected '+p.toLowerCase():p.toLowerCase()} onClick={()=>set('priority',p)}>
            <span><i/>{p}</span><small>{p==='Low'?'Routine':p==='Medium'?'Standard':p==='High'?'Urgent':'Immediate'}</small>
          </button>)}
        </div></fieldset>

        <label className="ref-upload"><input type="file" accept="image/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,5))}/><Camera size={18}/><span><strong>{files.length?files.length+' photo'+(files.length>1?'s':'')+' selected':'Add photos'}</strong><small>Optional · up to 5 · 5MB each</small></span></label>
      </div>

      <div className="ref-routing"><div><Sparkles size={16}/></div><span><small>ROUTING PREVIEW</small><strong>Your request will be routed to the appropriate team.</strong></span><em>Routing begins instantly</em></div>
      {error&&<div className="ref-error">{error}</div>}
      <button className="ref-submit" disabled={busy}><span>{busy?'Submitting…':'Submit maintenance request'}</span><ChevronRight size={18}/></button>
      <div className="ref-privacy"><ShieldCheck size={12}/>Your request is securely recorded and visible only to authorized facilities staff.</div>
    </form>
  </main>;
}
