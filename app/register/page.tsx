'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Step = 'details' | 'otp' | 'password';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '14px 16px', borderRadius: 12,
  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
  color: 'var(--input-text)', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
};

const btnStyle = (active = true): React.CSSProperties => ({
  width: '100%', padding: '15px', borderRadius: 12,
  border: '1px solid rgba(6,182,212,0.35)',
  background: active ? 'linear-gradient(135deg, #06B6D4, #0EA5E9)' : 'rgba(6,182,212,0.3)',
  color: 'white', fontSize: 16, fontWeight: 700,
  cursor: active ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
});

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function PatientRegister() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');

  // Step 1 — details
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 — OTP
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const otpRefs                  = useRef<Array<HTMLInputElement | null>>([]);
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef             = useRef<RecaptchaVerifier | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Step 3 — password
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');

  // Shared
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  /* ── Resend countdown ────────────────────────────────────────────────── */
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  /* ── Step indicator ──────────────────────────────────────────────────── */
  const steps: { id: Step; label: string }[] = [
    { id: 'details',  label: 'Details'  },
    { id: 'otp',      label: 'Verify'   },
    { id: 'password', label: 'Password' },
  ];
  const stepIdx = steps.findIndex(s => s.id === step);

  /* ── Setup reCAPTCHA ─────────────────────────────────────────────────── */
  const setupRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => { /* verified */ },
      });
    }
    return recaptchaRef.current;
  };

  /* ── Step 1: Send OTP ────────────────────────────────────────────────── */
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    const phoneClean = phone.replace(/\s/g, '');
    if (!/^\+?\d{10,13}$/.test(phoneClean)) {
      setError('Enter a valid phone number with country code (e.g. +91 9876543210)');
      return;
    }
    setLoading(true);
    try {
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(firebaseAuth, phoneClean, verifier);
      setConfirmResult(result);
      setPhone(phoneClean);
      setStep('otp');
      setResendTimer(60);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to send OTP';
      setError(msg.includes('invalid-phone') ? 'Invalid phone number format.' : msg);
      recaptchaRef.current = null; // reset for retry
    }
    setLoading(false);
  };

  /* ── Step 2: Verify OTP ──────────────────────────────────────────────── */
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      await confirmResult!.confirm(code);
      setStep('password');
    } catch {
      setError('Invalid or expired code. Please try again.');
    }
    setLoading(false);
  };

  /* ── OTP input helpers ───────────────────────────────────────────────── */
  const handleOtpChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  /* ── Step 3: Create account ──────────────────────────────────────────── */
  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, password, role: 'patient' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); setLoading(false); return; }
      // Store token using same keys as AuthProvider
      localStorage.setItem('opd_token', data.token);
      localStorage.setItem('opd_user', JSON.stringify(data.user));
      router.replace('/patient/dashboard');
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const resendOtp = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    try {
      recaptchaRef.current = null;
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(firebaseAuth, phone, verifier);
      setConfirmResult(result);
      setResendTimer(60);
    } catch {
      setError('Failed to resend OTP. Please go back and try again.');
    }
    setLoading(false);
  };

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--auth-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: isMobile ? '16px' : '24px',
    }}>
      {/* Invisible reCAPTCHA mount point */}
      <div id="recaptcha-container" />

      <div style={{ position: 'fixed', top: isMobile ? 14 : 24, right: isMobile ? 14 : 24, zIndex: 20 }}>
        <ThemeToggle />
      </div>

      {/* Back */}
      <Link href="/login" style={{
        position: 'fixed', top: isMobile ? 14 : 24, left: isMobile ? 14 : 24,
        color: 'var(--text-muted)', fontSize: isMobile ? 13 : 14, textDecoration: 'none',
        background: 'var(--theme-toggle-bg)', border: '1px solid var(--theme-toggle-border)',
        borderRadius: 10, padding: isMobile ? '7px 12px' : '8px 14px',
      }}>
        ← Back
      </Link>

      <div style={{ width: '100%', maxWidth: 440, marginTop: isMobile ? 34 : 0 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #06B6D4, #0EA5E9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 16px',
          }}>🧑‍⚕️</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Patient Registration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Verify your phone to create an account</p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 0 }}>
          {steps.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? '1' : 'initial' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                    background: done ? '#06B6D4' : active ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${done || active ? '#06B6D4' : 'rgba(255,255,255,0.1)'}`,
                    color: done ? 'white' : active ? '#06B6D4' : '#6B7280',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 11, color: active ? '#06B6D4' : '#6B7280', fontWeight: active ? 700 : 400 }}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? '#06B6D4' : 'rgba(255,255,255,0.08)', margin: '0 8px', marginBottom: 20 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: 24, padding: '32px 28px',
          backdropFilter: 'blur(20px)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>

          {/* ── Step 1: Name + Phone ── */}
          {step === 'details' && (
            <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, letterSpacing: '0.06em' }}>FULL NAME</label>
                <input type="text" placeholder="e.g. Arjun Sharma" value={name} onChange={e => setName(e.target.value)} required style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, letterSpacing: '0.06em' }}>PHONE NUMBER</label>
                <input type="tel" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} required style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
                <p style={{ fontSize: 11, color: '#4B5563', marginTop: 6 }}>Include country code — e.g. +91 for India</p>
              </div>
              {error && <ErrorBox msg={error} />}
              <button type="submit" disabled={loading} style={btnStyle(!loading)}>
                {loading ? 'Sending OTP…' : 'Send OTP →'}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📲</div>
                <p style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 1.6 }}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: '#F9FAFB' }}>{phone}</strong>
                </p>
              </div>

              {/* OTP boxes */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    style={{
                      width: 48, height: 56, textAlign: 'center', fontSize: 24, fontWeight: 800,
                      borderRadius: 12, border: `2px solid ${digit ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.12)'}`,
                      background: 'rgba(255,255,255,0.06)', color: '#F9FAFB', outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.8)'; }}
                    onBlur={e => { e.target.style.borderColor = digit ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.12)'; }}
                  />
                ))}
              </div>

              {error && <ErrorBox msg={error} />}

              <button type="submit" disabled={loading || otp.join('').length !== 6} style={btnStyle(!loading && otp.join('').length === 6)}>
                {loading ? 'Verifying…' : 'Verify OTP →'}
              </button>

              {/* Resend */}
              <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                Didn&apos;t receive it?{' '}
                {resendTimer > 0 ? (
                  <span style={{ color: '#4B5563' }}>Resend in {resendTimer}s</span>
                ) : (
                  <button type="button" onClick={resendOtp} disabled={loading} style={{ background: 'none', border: 'none', color: '#06B6D4', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    Resend OTP
                  </button>
                )}
              </p>
              <button type="button" onClick={() => setStep('details')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>
                ← Change number
              </button>
            </form>
          )}

          {/* ── Step 3: Set Password ── */}
          {step === 'password' && (
            <form onSubmit={createAccount} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
                <p style={{ color: '#9CA3AF', fontSize: 14 }}>Phone verified! Set a password for your account.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, letterSpacing: '0.06em' }}>PASSWORD</label>
                <input type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, letterSpacing: '0.06em' }}>CONFIRM PASSWORD</label>
                <input type="password" placeholder="Re-enter password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{
                  ...inputStyle,
                  borderColor: confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'; }} />
                {confirm && confirm !== password && (
                  <p style={{ fontSize: 12, color: '#FCA5A5', marginTop: 5 }}>Passwords do not match</p>
                )}
              </div>

              {/* Summary */}
              <div style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#9CA3AF' }}>
                <div><strong style={{ color: '#06B6D4' }}>Name: </strong>{name}</div>
                <div><strong style={{ color: '#06B6D4' }}>Phone: </strong>{phone} ✅ Verified</div>
              </div>

              {error && <ErrorBox msg={error} />}
              <button type="submit" disabled={loading || password !== confirm} style={btnStyle(!loading && password === confirm && password.length >= 6)}>
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#4B5563' }}>
          Already registered?{' '}
          <Link href="/login/patient" style={{ color: '#06B6D4', textDecoration: 'none', fontWeight: 600 }}>
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 10, padding: '11px 14px', color: '#FCA5A5', fontSize: 13,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      ⚠️ {msg}
    </div>
  );
}
