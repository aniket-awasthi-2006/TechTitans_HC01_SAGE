'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    const result = await register({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      role: 'patient',
    });
    setIsLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Account created! Redirecting…');
    }
  };

  const fields = [
    { key: 'name',            label: 'Full Name',       type: 'text',     placeholder: 'Arjun Sharma',      required: true },
    { key: 'email',           label: 'Email Address',   type: 'email',    placeholder: 'arjun@gmail.com',   required: true },
    { key: 'phone',           label: 'Phone Number',    type: 'tel',      placeholder: '+91 9876543210',    required: false },
    { key: 'password',        label: 'Password',        type: 'password', placeholder: 'Min. 6 characters', required: true },
    { key: 'confirmPassword', label: 'Confirm Password',type: 'password', placeholder: 'Re-enter password', required: true },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(6,182,212,0.12) 0%, transparent 50%), #0B0F1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Logo + branding */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
            <Image src="/logo.png" alt="MediQueue Logo" width={68} height={68} style={{ borderRadius: 18 }} />
            <span style={{ fontSize: 26, fontWeight: 900, color: '#F9FAFB', letterSpacing: '-0.02em' }}>MediQueue</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', marginBottom: 6 }}>
            Create Patient Account
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>
            Register to track your OPD queue in real-time
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 24,
          padding: '32px 28px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
            {fields.map(({ key, label, type, placeholder, required }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 6, letterSpacing: '0.05em' }}>
                  {label.toUpperCase()}{required && ' *'}
                </label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required={required}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '13px 15px', borderRadius: 11,
                    background: 'rgba(255,255,255,0.06)',
                    border: errors[key] ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
                    color: '#F9FAFB', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; }}
                  onBlur={e => { e.target.style.borderColor = errors[key] ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'; }}
                />
                {errors[key] && (
                  <p style={{ fontSize: 12, color: '#F87171', marginTop: 4 }}>⚠ {errors[key]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: isLoading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white', fontSize: 15, fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: isLoading ? 'none' : '0 8px 24px rgba(99,102,241,0.45)',
                transition: 'all 0.2s', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {isLoading ? (
                <>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                    animation: 'spin 0.7s linear infinite', display: 'inline-block',
                  }} />
                  Creating account…
                </>
              ) : 'Create Account →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6B7280' }}>
          Already have an account?{' '}
          <Link href="/login/patient" style={{ color: '#A5B4FC', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#374151' }}>
          <Link href="/login" style={{ color: '#4B5563', textDecoration: 'none' }}>
            ← Back to role selection
          </Link>
        </p>
      </div>
    </div>
  );
}
