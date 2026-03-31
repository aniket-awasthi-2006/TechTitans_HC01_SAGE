'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import Image from 'next/image';

const roles = [
  {
    key: 'patient',
    label: 'Patient',
    icon: '🧑‍⚕️',
    desc: 'Join the queue, track your position & view prescriptions',
    gradient: 'linear-gradient(135deg, #06B6D4, #0EA5E9)',
    shadow: 'rgba(6,182,212,0.35)',
    border: 'rgba(6,182,212,0.3)',
    href: '/login/patient',
  },
  {
    key: 'reception',
    label: 'Receptionist',
    icon: '🏥',
    desc: 'Manage tokens, intake forms & the live OPD queue',
    gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    shadow: 'rgba(99,102,241,0.35)',
    border: 'rgba(99,102,241,0.3)',
    href: '/login/reception',
  },
  {
    key: 'doctor',
    label: 'Doctor',
    icon: '👨‍⚕️',
    desc: 'View your queue, call patients & write prescriptions',
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    shadow: 'rgba(16,185,129,0.35)',
    border: 'rgba(16,185,129,0.3)',
    href: '/login/doctor',
  },
];

export default function LoginPortal() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      const map: Record<string, string> = {
        reception: '/reception/dashboard',
        doctor: '/doctor/dashboard',
        patient: '/patient/dashboard',
      };
      router.replace(map[user.role] || '/login');
    }
  }, [user, isLoading, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%), #0B0F1A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{ margin: '0 auto 20px', width: 96, height: 96 }}>
          <Image src="/logo.png" alt="MediQueue Logo" width={96} height={96} style={{ borderRadius: 24, boxShadow: '0 12px 40px rgba(99,102,241,0.4)' }} />
        </div>
        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 42px)',
            fontWeight: 900,
            color: '#F9FAFB',
            marginBottom: 10,
            letterSpacing: '-0.02em',
          }}
        >
          MediQueue
        </h1>
        <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 380, margin: '0 auto' }}>
          Real-time hospital queue management. Select your role to continue.
        </p>
      </div>

      {/* Role Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
          width: '100%',
          maxWidth: 900,
        }}
      >
        {roles.map((role) => (
          <Link key={role.key} href={role.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: 32,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${role.border}`,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 60px ${role.shadow}`;
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              {/* Glow BG */}
              <div
                style={{
                  position: 'absolute',
                  top: -40,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: role.gradient,
                  opacity: 0.08,
                  filter: 'blur(30px)',
                  pointerEvents: 'none',
                }}
              />

              {/* Icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: role.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  margin: '0 auto 20px',
                  boxShadow: `0 8px 24px ${role.shadow}`,
                }}
              >
                {role.icon}
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>
                {role.label}
              </h2>
              <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 24 }}>
                {role.desc}
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 24px',
                  borderRadius: 30,
                  background: role.gradient,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: `0 4px 16px ${role.shadow}`,
                }}
              >
                Sign in as {role.label} →
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: 40, fontSize: 13, color: '#4B5563', textAlign: 'center' }}>
        New patient?{' '}
        <Link href="/register" style={{ color: '#A5B4FC', textDecoration: 'none', fontWeight: 600 }}>
          Register here
        </Link>
      </p>

      {/* TV Display link */}
      <p style={{ marginTop: 12, fontSize: 12, color: '#374151', textAlign: 'center' }}>
        <Link href="/display" style={{ color: '#4B5563', textDecoration: 'none' }}>
          📺 Open TV Display Panel →
        </Link>
      </p>
    </div>
  );
}
