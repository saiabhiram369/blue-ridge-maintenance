import {
  BarChart3, Building2, ClipboardList, FileText, LayoutDashboard,
  LogOut, Menu, Mountain, Settings, Users, X
} from 'lucide-react';
import type { Profile } from '../types';

interface Props {
  profile: Profile | null;
  mobileOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const adminNav = [
  [LayoutDashboard, 'Dashboard'],
  [ClipboardList, 'Work Orders'],
  [Users, 'Technicians'],
  [Building2, 'Facilities'],
  [BarChart3, 'Analytics'],
  [FileText, 'Reports'],
  [Settings, 'Settings']
] as const;

const techNav = [
  [ClipboardList, 'My Work Orders']
] as const;

export function Sidebar({ profile, mobileOpen, onToggle, onLogout }: Props) {
  const nav = profile?.role === 'technician' ? techNav : adminNav;

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
              title={label}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-mountain" aria-hidden="true">
          <span/><span/><span/>
        </div>

        <div className="sidebar-user admin-sidebar-user">
          <div className="avatar avatar-fallback">{profile?.full_name?.slice(0, 1) || 'T'}</div>
          <div className="sidebar-user-copy">
            <strong>{profile?.full_name || 'Operations'}</strong>
            <small>{profile?.role === 'technician' ? 'Technician' : 'Admin'}</small>
          </div>
          <button onClick={onLogout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
    </>
  );
}
