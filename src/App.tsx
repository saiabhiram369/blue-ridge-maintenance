import { Bell, CalendarDays, ClipboardCheck, RefreshCw, Search, SlidersHorizontal, Timer, Wrench } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KpiCard } from './components/KpiCard';
import { LoginScreen } from './components/LoginScreen';
import { PublicRequest } from './components/PublicRequest';
import { Sidebar } from './components/Sidebar';
import { WorkOrderInspector } from './components/WorkOrderInspector';
import { WorkOrderQueue } from './components/WorkOrderQueue';
import { demoOrders } from './data/demo';
import { demoMode, supabase } from './lib/supabase';
import type { Profile, WorkOrder, WorkOrderStatus } from './types';

const protectedPaths = ['/admin','/tech','/app'];
const isProtected = protectedPaths.some(path => window.location.pathname.toLowerCase().startsWith(path));

function OperationsApp() {
  const [authReady, setAuthReady] = useState(demoMode);
  const [authenticated, setAuthenticated] = useState(demoMode);
  const [profile, setProfile] = useState<Profile | null>(
    demoMode ? { id:'demo', email:'demo@blueridge.local', full_name:'Bianca Roberts', role:'admin', can_resolve:true } : null
  );
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const hydrateProfile = useCallback(async () => {
    if (demoMode || !supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); return; }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,can_resolve')
      .eq('id', user.id)
      .maybeSingle();

    if (error) setNotice(error.message);
    setProfile(data || {
      id:user.id,
      email:user.email || '',
      full_name:user.email?.split('@')[0] || 'User',
      role:'technician',
      can_resolve:false
    });
  }, []);

  useEffect(() => {
    if (demoMode || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setAuthReady(true);
      if (data.session) hydrateProfile();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
      setAuthReady(true);
      if (session) hydrateProfile();
      else setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, [hydrateProfile]);

  const loadOrders = useCallback(async () => {
    setBusy(true);
    setNotice('');
    try {
      let next: WorkOrder[];
      if (demoMode || !supabase) {
        next = demoOrders;
      } else {
        const { data, error } = await supabase
          .from('maintenance_requests')
          .select('*')
          .order('timestamp', { ascending:false });
        if (error) throw error;
        next = (data || []) as WorkOrder[];
      }

      setOrders(next);
      setSelected(current =>
        current
          ? next.find(order => order.ticket_id === current.ticket_id) || next[0] || null
          : next[0] || null
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not load work orders.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated && (demoMode || profile)) loadOrders();
  }, [authenticated, profile, loadOrders]);

  const filtered = useMemo(() => orders.filter(order => {
    const haystack = [order.ticket_id,order.title,order.location,order.name,order.technician]
      .join(' ')
      .toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (!status || order.status === status)
      && (!priority || order.priority === priority);
  }), [orders, search, status, priority]);

  const counts = useMemo(() => ({
    open: orders.filter(order => order.status === 'Open').length,
    progress: orders.filter(order => order.status === 'In Progress').length,
    pending: orders.filter(order => order.status === 'Pending Tiffany').length,
    complete: orders.filter(order => order.status === 'Resolved').length
  }), [orders]);

  async function patchSelected(patch: Partial<WorkOrder>) {
    if (!selected) return;
    const before = selected;
    const updated = { ...selected, ...patch, updated_at:new Date().toISOString() };

    setSelected(updated);
    setOrders(list => list.map(order => order.ticket_id === updated.ticket_id ? updated : order));

    if (!demoMode && supabase) {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({ ...patch, updated_at:updated.updated_at })
        .eq('ticket_id', selected.ticket_id);

      if (error) {
        setNotice(error.message);
        setSelected(before);
        setOrders(list => list.map(order => order.ticket_id === before.ticket_id ? before : order));
      }
    }
  }

  async function logout() {
    if (!demoMode && supabase) await supabase.auth.signOut();
    setAuthenticated(false);
  }

  if (!authReady) {
    return <div className="boot-screen"><div className="boot-orb"/><span>Preparing operations workspace…</span></div>;
  }
  if (!authenticated) return <LoginScreen onAuthenticated={() => setAuthenticated(true)} />;

  const isAdmin = profile?.role === 'admin';
  const canResolve = !!profile?.can_resolve;

  return (
    <div className="app-shell">
      <div className="ambient ambient-a"/><div className="ambient ambient-b"/><div className="ambient ambient-c"/>
      <Sidebar
        profile={profile}
        mobileOpen={mobileOpen}
        onToggle={() => setMobileOpen(value => !value)}
        onLogout={logout}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="searchbox glass">
            <Search size={18}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search work orders, locations, or technicians…"/>
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-filters">
            <label className="filter glass">
              <SlidersHorizontal size={15}/>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option>Open</option><option>In Progress</option><option>On Hold</option>
                <option>Pending Tiffany</option><option>Resolved</option>
              </select>
            </label>
            <label className="filter glass">
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="">All priorities</option>
                <option>Urgent</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
            </label>
          </div>
          <div className="top-actions">
            <div className="date-chip glass">
              <CalendarDays size={15}/>
              {new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}
            </div>
            <button className="icon-btn glass" aria-label="Notifications"><Bell size={17}/><i/></button>
            <button className="icon-btn glass" onClick={loadOrders} title="Refresh">
              <RefreshCw className={busy ? 'spinning' : ''} size={17}/>
            </button>
          </div>
        </header>

        <section className="page-heading admin-page-heading">
          <div>
            <span className="eyebrow">BLUE RIDGE PRESERVATION MAINTENANCE</span>
            <h1>Facilities Operations</h1>
            <p>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {profile?.full_name?.split(' ')[0] || 'team'}. Prioritize requests, assign technicians, and move work to resolution.</p>
          </div>
          <div className="live-chip"><i/> Live operations</div>
        </section>

        <section className="kpi-grid">
          <KpiCard label="OPEN ORDERS" value={counts.open} helper="Needs triage or assignment" icon={ClipboardCheck} tone="gold"/>
          <KpiCard label="IN PROGRESS" value={counts.progress} helper="Actively being worked" icon={Timer} tone="blue"/>
          <KpiCard label="PENDING APPROVAL" value={counts.pending} helper="Ready for verification" icon={Wrench} tone="amber"/>
          <KpiCard label="COMPLETED" value={counts.complete} helper="Resolved work orders" icon={ClipboardCheck} tone="green"/>
        </section>

        {notice && <div className="system-notice">{notice}</div>}

        <section className="operations-grid">
          <WorkOrderQueue
            orders={filtered}
            selectedId={selected?.ticket_id}
            onSelect={setSelected}
          />
          <WorkOrderInspector
            order={selected}
            onClose={() => setSelected(null)}
            onStatusChange={(next: WorkOrderStatus) => patchSelected({ status: next })}
            onTechnicianChange={(technician: string) => patchSelected({ technician: technician || null })}
            isAdmin={isAdmin}
            canResolve={canResolve}
          />
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return isProtected ? <OperationsApp /> : <PublicRequest />;
}
