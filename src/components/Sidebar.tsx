import {
  BarChart3, Building2, ClipboardList, FileText, LayoutDashboard,
  LogOut, Menu, Settings, Users, X
} from 'lucide-react';
import type { Profile } from '../types';

export type AdminSection =
  | 'dashboard'
  | 'work-orders'
  | 'technicians'
  | 'facilities'
  | 'analytics'
  | 'reports'
  | 'settings';

interface Props {
  profile: Profile | null;
  mobileOpen: boolean;
  activeSection: AdminSection;
  onToggle: () => void;
  onNavigate: (section: AdminSection) => void;
  onLogout: () => void;
}

const adminNav = [
  [LayoutDashboard, 'Dashboard', 'dashboard'],
  [ClipboardList, 'Work Orders', 'work-orders'],
  [Users, 'Technicians', 'technicians'],
  [Building2, 'Facilities', 'facilities'],
  [BarChart3, 'Analytics', 'analytics'],
  [FileText, 'Reports', 'reports'],
  [Settings, 'Settings', 'settings']
] as const;

const techNav = [
  [ClipboardList, 'My Work Orders', 'work-orders']
] as const;

export function Sidebar({
  profile, mobileOpen, activeSection, onToggle, onNavigate, onLogout
}: Props) {
  const nav = profile?.role === 'technician' ? techNav : adminNav;

  return (
    <>
      <button className="mobile-menu admin-mobile-menu" onClick={onToggle} aria-label="Toggle navigation">
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-brand admin-brand-text">
          <div>
            <strong>Blue Ridge</strong>
            <small>Preservation Maintenance</small>
          </div>
        </div>

        <nav className="sidebar-nav admin-nav">
          {nav.map(([Icon, label, section]) => (
            <button
              key={label}
              className={activeSection === section ? 'active' : ''}
              title={label}
              onClick={() => {
                onNavigate(section);
                if (mobileOpen) onToggle();
              }}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

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
