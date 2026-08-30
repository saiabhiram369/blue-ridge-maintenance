import {
  BarChart3, Building2, CalendarDays, ClipboardList, LayoutDashboard,
  LogOut, Menu, Users, Wrench, X
} from 'lucide-react';
import type { Profile } from '../types';

interface Props {
  profile: Profile | null;
  mobileOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const nav = [
  [LayoutDashboard, 'Dashboard'],
  [ClipboardList, 'Work Orders'],
  [Building2, 'Properties'],
  [Users, 'Technicians'],
  [CalendarDays, 'Calendar'],
  [BarChart3, 'Analytics']
] as const;

export function Sidebar({ profile, mobileOpen, onToggle, onLogout }: Props) {
  return (
    <>
      <button className="mobile-menu glass" onClick={onToggle} aria-label="Toggle navigation">
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <aside className={`sidebar glass ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>BLUE RIDGE</strong><small>FACILITIES</small></div>
        </div>

        <nav className="sidebar-nav">
          {nav.map(([Icon, label], index) => (
            <button key={label} className={index === 0 ? 'active' : ''} title={index ? 'Coming in V2' : label}>
              <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="team-capacity glass-inset">
          <div className="widget-head"><span>TEAM LOAD</span><small>This week</small></div>
          <div className="capacity">
            <div className="capacity-ring"><strong>72%</strong><small>capacity</small></div>
            <div className="capacity-legend">
              <span><i className="busy" /> Busy <b>72%</b></span>
              <span><i className="available" /> Available <b>20%</b></span>
              <span><i className="offline" /> Offline <b>8%</b></span>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="avatar avatar-fallback">{profile?.full_name?.slice(0, 1) || 'B'}</div>
          <div className="sidebar-user-copy">
            <strong>{profile?.full_name || 'Operations'}</strong>
            <small>{profile?.role === 'technician' ? 'Technician' : 'Operations Manager'}</small>
          </div>
          <button onClick={onLogout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
    </>
  );
}
