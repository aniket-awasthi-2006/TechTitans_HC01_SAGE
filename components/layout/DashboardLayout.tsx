'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  requiredRole?: 'patient' | 'reception' | 'doctor';
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  requiredRole,
}: DashboardLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && user && requiredRole && user.role !== requiredRole) {
      const redirectMap: Record<string, string> = {
        reception: '/reception/dashboard',
        doctor: '/doctor/dashboard',
        patient: '/patient/dashboard',
      };
      router.push(redirectMap[user.role] || '/login');
    }
  }, [user, isLoading, requiredRole, router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: '3px solid rgba(99,102,241,0.2)',
              borderTopColor: '#6366F1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading MediQueue...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Topbar title={title} subtitle={subtitle} />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
