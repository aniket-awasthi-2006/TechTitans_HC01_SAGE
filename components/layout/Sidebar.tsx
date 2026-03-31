'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  LayoutDashboard, Stethoscope, ClipboardList, Clock, FolderOpen,
  Building2, LogOut, Users,
} from 'lucide-react';

const navItems = {
  reception: [
    { href: '/reception/dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
    { href: '/reception/doctors',   label: 'Doctors',     Icon: Stethoscope },
  ],
  doctor: [
    { href: '/doctor/dashboard', label: 'My Queue', Icon: ClipboardList },
    { href: '/doctor/history',   label: 'History',  Icon: Clock },
  ],
  patient: [
    { href: '/patient/dashboard', label: 'My Status', Icon: Building2 },
    { href: '/patient/history',   label: 'History',   Icon: FolderOpen },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const items = navItems[user.role as keyof typeof navItems] || [];

  const roleColors = {
    reception: '#6366F1',
    doctor:    '#06B6D4',
    patient:   '#22C55E',
  };

  const roleLabels = {
    reception: 'Reception',
    doctor:    'Doctor',
    patient:   'Patient',
  };

  const accent = roleColors[user.role as keyof typeof roleColors] || '#6366F1';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.png" alt="MediQueue Logo" width={46} height={46} style={{ borderRadius: 12 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>MediQueue</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Queue Management</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{
          background: `${accent}15`, border: `1px solid ${accent}30`,
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `${accent}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: accent,
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F9FAFB' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: accent, fontWeight: 500 }}>
              {roleLabels[user.role as keyof typeof roleLabels]}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 8px 12px' }}>
          Navigation
        </div>
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-nav-item ${pathname === href ? 'active' : ''}`}
            style={{ marginBottom: 4 }}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom — Sign out */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={logout}
          className="sidebar-nav-item"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444' }}
        >
          <LogOut size={18} strokeWidth={2} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
