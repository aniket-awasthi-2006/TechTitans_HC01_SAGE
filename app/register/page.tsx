'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await register({ ...form, role: 'patient' });
    setIsLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success('Account created successfully!');
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0B0F1A' }}>
      {/* Left — Blob */}
      <div
        style={{
          flex: 1,
          background:
            'radial-gradient(ellipse at 70% 50%, rgba(6,182,212,0.4) 0%, transparent 60%), radial-gradient(ellipse at 30% 30%, rgba(99,102,241,0.3) 0%, transparent 55%), #0D1120',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hidden md:flex"
      >
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: 72, marginBottom: 20, animation: 'float 3s ease-in-out infinite' }}>
            🩺
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', marginBottom: 10 }}>
            Join the Queue
          </h2>
          <p style={{ fontSize: 15, color: '#9CA3AF', maxWidth: 280, lineHeight: 1.6 }}>
            Register as a patient to track your OPD queue position in real-time from anywhere.
          </p>
        </div>
      </div>

      {/* Right — Form */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>
              Create Account
            </h1>
            <p style={{ fontSize: 14, color: '#6B7280' }}>Register as a patient</p>
          </div>

          <div className="glass-card" style={{ padding: 32 }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { field: 'name', label: 'Full Name', type: 'text', placeholder: 'Arjun Sharma' },
                { field: 'email', label: 'Email', type: 'email', placeholder: 'arjun@gmail.com' },
                { field: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+91 9876543210' },
                { field: 'password', label: 'Password', type: 'password', placeholder: 'Min 6 characters' },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field}>
                  <label className="form-label">{label}</label>
                  <input
                    type={type}
                    className="input-dark"
                    placeholder={placeholder}
                    value={form[field as keyof typeof form]}
                    onChange={handleChange(field)}
                    required={field !== 'phone'}
                  />
                </div>
              ))}

              <Button type="submit" isLoading={isLoading} style={{ width: '100%', marginTop: 8 }}>
                Create Account
              </Button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
            Already registered?{' '}
            <Link href="/login" style={{ color: '#A5B4FC', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
