import {
  Bell, CalendarDays, CheckCircle2, ClipboardCheck, RefreshCw,
  Search, SlidersHorizontal, Timer, Wrench
} from 'lucide-react';
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

function readLegacyProfile(): Profile | null {
  try {
    const raw = localStorage.getItem('br_legacy_profile');
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

function OperationsApp() {
  const initialLegacyProfile = readLegacyProfile();
  const [authReady, setAuthReady] = useState(demoMode || !!initialLegacyProfile);
  const [authenticated, setAuthenticated] = useState(demoMode || !!initialLegacyProfile);
  const [profile, setProfile] = useState<Profile | null>(
    demoMode
      ? { id:'demo', email:'tiffany@blueridge.local', full_name:'Tiffany Walsh', role:'admin', can_resolve:true }
      : initialLegacyProfile
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
    if (demoMode || readLegacyProfile()) return;

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
    const haystack = [
      order.ticket_id, order.title, order.location, order.name, order.technician
    ].join(' ').toLowerCase();

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
    setOrders(list => list.map(order =>
      order.ticket_id === updated.ticket_id ? updated : order
    ));

    if (!demoMode && supabase) {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({ ...patch, updated_at:updated.updated_at })
        .eq('ticket_id', selected.ticket_id);

      if (error) {
        setNotice(error.message);
        setSelected(before);
        setOrders(list => list.map(order =>
          order.ticket_id === before.ticket_id ? before : order
        ));
      }
    }
  }

  function addInternalNote() {
    if (!selected) return;
    const note = window.prompt('Add internal note', selected.admin_note || '');
    if (note === null) return;
    patchSelected({ admin_note: note.trim() || null });
  }

  async function logout() {
    localStorage.removeItem('br_legacy_profile');
    if (!demoMode) await supabase.auth.signOut();
    setProfile(null);
    setAuthenticated(false);
  }

  if (!authReady) {
    return (
      <div className="boot-screen">
        <div className="boot-orb"/>
        <span>Preparing operations workspace…</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <LoginScreen
        onAuthenticated={() => {
          setProfile(readLegacyProfile());
          setAuthenticated(true);
          setAuthReady(true);
        }}
      />
    );
  }

  const isAdmin = profile?.role === 'admin';
  const canResolve = !!profile?.can_resolve;
  const firstName = profile?.full_name?.split(' ')[0] || 'Team';
  const greeting = new Date().getHours() < 12
    ? 'Good morning'
    : new Date().getHours() < 18
      ? 'Good afternoon'
      : 'Good evening';

  return (
    <div className="app-shell">
      <Sidebar
        profile={profile}
        mobileOpen={mobileOpen}
        onToggle={() => setMobileOpen(value => !value)}
        onLogout={logout}
      />

      <main className="workspace admin-workspace">
        <header className="admin-dashboard-header">
          <div>
            <h1>{greeting}, {firstName}</h1>
            <p>Facilities Operations</p>
          </div>

          <div className="admin-header-actions">
            <button className="admin-header-icon" aria-label="Notifications">
              <Bell size={19}/>
              <i/>
            </button>
            <div className="admin-user-chip">
              <span>{profile?.full_name?.split(' ').map(v => v[0]).slice(0,2).join('') || 'TW'}</span>
            </div>
          </div>
        </header>

        <section className="kpi-grid admin-kpi-grid">
          <KpiCard
            label="OPEN"
            value={counts.open}
            helper="+4 today"
            icon={ClipboardCheck}
            tone="blue"
          />
          <KpiCard
            label="IN PROGRESS"
            value={counts.progress}
            helper="+2 today"
            icon={RefreshCw}
            tone="amber"
          />
          <KpiCard
            label="PENDING APPROVAL"
            value={counts.pending}
            helper="+1 today"
            icon={Timer}
            tone="gold"
          />
          <KpiCard
            label="COMPLETED"
            value={counts.complete}
            helper="+12 today"
            icon={CheckCircle2}
            tone="green"
          />
        </section>

        <section className="admin-filterbar">
          <div className="searchbox">
            <Search size={18}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search work orders..."
            />
          </div>

          <label className="filter">
            <SlidersHorizontal size={15}/>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Status: All</option>
              <option>Open</option>
              <option>In Progress</option>
              <option>On Hold</option>
              <option>Pending Tiffany</option>
              <option>Resolved</option>
            </select>
          </label>

          <label className="filter">
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="">Priority: All</option>
              <option>Urgent</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>

          <div className="date-chip">
            <CalendarDays size={16}/>
            {new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
          </div>

          <button className="admin-refresh-button" onClick={loadOrders} title="Refresh">
            <RefreshCw className={busy ? 'spinning' : ''} size={17}/>
          </button>
        </section>

        {notice && <div className="system-notice">{notice}</div>}

        <section className="operations-grid admin-operations-grid">
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
            onAddInternalNote={addInternalNote}
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
