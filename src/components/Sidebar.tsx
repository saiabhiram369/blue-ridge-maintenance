import {
  BarChart3, Building2, CalendarDays, ClipboardList, LayoutDashboard,
  LogOut, Menu, Mountain, Users, X
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
      <button className="mobile-menu admin-mobile-menu" onClick={onToggle} aria-label="Toggle navigation">
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <span className="admin-brand-icon"><Mountain size={24} /></span>
          <div>
            <strong>Blue Ridge</strong>
            <small>Preservation Maintenance</small>
          </div>
        </div>

        <nav className="sidebar-nav admin-nav">
          {nav.map(([Icon, label], index) => (
            <button
              key={label}
              className={index === 0 ? 'active' : ''}
              title={index ? 'Coming in V2' : label}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-team-card">
          <div className="admin-team-head">
            <span>Team capacity</span>
            <small>This week</small>
          </div>
          <div className="admin-team-value">
            <strong>72%</strong>
            <span>utilized</span>
          </div>
          <div className="admin-capacity-bar"><i /></div>
          <div className="admin-capacity-meta">
            <span>Available 20%</span>
            <span>Offline 8%</span>
          </div>
        </div>

        <div className="sidebar-user admin-sidebar-user">
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
