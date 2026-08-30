import {
  Camera, CheckCircle2, ChevronRight, ClipboardList, Mail, MapPin, Mountain,
  Phone, ShieldCheck, Sparkles, UserRound
} from 'lucide-react';
import { useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
import type { Priority } from '../types';

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
      <div className="ref-header-brand"><Mountain size={34}/><strong>Blue Ridge Preservation Maintenance</strong></div>
      <div className="ref-header-secure"><ShieldCheck size={13}/>Secure facility services</div>
    </header>

    <header className="ref-mobile-header">
      <div className="ref-mobile-brand"><Mountain size={25}/><strong>Blue Ridge Preservation Maintenance</strong></div>
      <div className="ref-mobile-secure"><ShieldCheck size={12}/>Secure</div>
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
          <label>Full name <b className="required-mark">*</b><div className="ref-field"><UserRound size={15}/><input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Your full name"/></div></label>
          <label>Email address <b className="required-mark">*</b><div className="ref-field"><Mail size={15}/><input required type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@example.com"/></div></label>
        </div>
        <label>Phone <small>(optional)</small><div className="ref-field"><Phone size={15}/><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="(828) 555-0123"/></div></label>
      </section>

      <section className="ref-section">
        <div className="ref-section-title"><span><ClipboardList size={17}/></span><strong>REQUEST DETAILS</strong></div>
        <div className="ref-grid two">
          <label>Category<select required value={form.category} onChange={e=>set('category',e.target.value)}><option value="">Select service category</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Location<div className="ref-field"><MapPin size={15}/><input required value={form.location} onChange={e=>set('location',e.target.value)} placeholder="New River 111"/></div></label>
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
