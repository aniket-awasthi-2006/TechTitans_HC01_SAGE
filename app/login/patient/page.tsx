'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';

export default function PatientLogin() {
  const { login } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setLoading(true);
    // Pass phone instead of email — login() accepts (identifier, password)
    const result = await login(phone.trim(), password, 'phone');
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: isMobile ? '12px 14px' : '14px 16px', borderRadius: isMobile ? 10 : 12,
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--input-text)', fontSize: isMobile ? 14 : 15, outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--auth-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: isMobile ? '16px' : '24px',
    }}>
      {/* Back link */}
      <Link href="/login" style={{
        position: 'fixed', top: isMobile ? 14 : 24, left: isMobile ? 14 : 24,
        display: 'flex', alignItems: 'center', gap: 6,
        color: 'var(--text-muted)', fontSize: isMobile ? 13 : 14, textDecoration: 'none',
        background: 'var(--theme-toggle-bg)', border: '1px solid var(--theme-toggle-border)',
        borderRadius: 10, padding: isMobile ? '7px 12px' : '8px 14px', transition: 'all 0.2s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#06B6D4'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
      >
        ← Back
      </Link>

      <div style={{ width: '100%', maxWidth: 420, marginTop: isMobile ? 34 : 0 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 40 }}>
          <div style={{
            width: isMobile ? 60 : 72, height: isMobile ? 60 : 72, borderRadius: isMobile ? 16 : 20,
            background: 'linear-gradient(135deg, #06B6D4, #0EA5E9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 28 : 36, margin: `0 auto ${isMobile ? 14 : 20}px`,
            boxShadow: '0 12px 40px rgba(6,182,212,0.35)',
          }}>🙋</div>
          <h1 style={{ fontSize: isMobile ? 26 : 30, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Patient Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            Sign in with your registered phone number
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--auth-card-bg)', border: '1px solid var(--auth-card-border)',
          borderRadius: isMobile ? 18 : 24, padding: isMobile ? '22px 18px' : '36px 32px',
          backdropFilter: 'blur(20px)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20 }}>
            {/* Phone */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                PHONE NUMBER
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: isMobile ? 14 : 15, color: 'var(--text-muted)', pointerEvents: 'none',
                }}>📱</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  required
                  style={{ ...inputStyle, paddingLeft: isMobile ? 38 : 42 }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.6)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '12px 16px',
                color: '#FCA5A5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: isMobile ? '13px' : '15px', borderRadius: isMobile ? 10 : 12,
                border: '1px solid rgba(6,182,212,0.35)',
                background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06B6D4, #0EA5E9)',
                color: 'white', fontSize: isMobile ? 15 : 16, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: isMobile ? 18 : 24, fontSize: isMobile ? 13 : 14, color: 'var(--text-muted)' }}>
            New patient?{' '}
            <Link href="/register" style={{ color: '#06B6D4', textDecoration: 'none', fontWeight: 600 }}>
              Register with phone OTP
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
