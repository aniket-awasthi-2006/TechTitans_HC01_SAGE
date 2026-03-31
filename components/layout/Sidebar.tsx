'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

const navItems = {
  reception: [
    { href: '/reception/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/reception/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { href: '/display', label: 'Display Panel', icon: '📺' },
  ],
  doctor: [
    { href: '/doctor/dashboard', label: 'My Queue', icon: '📋' },
    { href: '/doctor/history', label: 'History', icon: '🕐' },
  ],
  patient: [
    { href: '/patient/dashboard', label: 'My Status', icon: '🏥' },
    { href: '/patient/history', label: 'History', icon: '📂' },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const items = navItems[user.role] || [];

  const roleColors = {
    reception: '#6366F1',
    doctor: '#06B6D4',
    patient: '#22C55E',
  };

  const roleLabels = {
    reception: 'Reception',
    doctor: 'Doctor',
    patient: 'Patient',
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
            }}
          >
            🏥
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB' }}>MediQueue</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Queue Management</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '16px 20px' }}>
        <div
          style={{
            background: `${roleColors[user.role]}15`,
            border: `1px solid ${roleColors[user.role]}30`,
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `${roleColors[user.role]}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: roleColors[user.role],
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F9FAFB' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: roleColors[user.role], fontWeight: 500 }}>
              {roleLabels[user.role]}
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 8px 12px' }}>
          Navigation
        </div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-nav-item ${pathname === item.href ? 'active' : ''}`}
            style={{ marginBottom: 4 }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Link
          href="/display"
          target="_blank"
          className="sidebar-nav-item"
          style={{ marginBottom: 4 }}
        >
          <span style={{ fontSize: 18 }}>📺</span>
          <span>Open Display Board</span>
        </Link>
        <button
          onClick={logout}
          className="sidebar-nav-item"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444' }}
        >
          <span style={{ fontSize: 18 }}>⎋</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
