'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import toast from 'react-hot-toast';

interface Doctor {
  _id: string;
  name: string;
  email: string;
  specialization?: string;
  createdAt?: string;
}

interface QueueStats {
  doctorId: string;
  waiting: number;
  inProgress: number;
  done: number;
}

export default function ReceptionDoctorsPage() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [stats, setStats] = useState<Record<string, QueueStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [docRes, tokRes] = await Promise.all([
        fetch('/api/users?role=doctor', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/tokens',            { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [docData, tokData] = await Promise.all([docRes.json(), tokRes.json()]);

      const doctorList: Doctor[] = docData.users || [];
      setDoctors(doctorList);

      // Build per-doctor stats from today's tokens
      const tokenList = tokData.tokens || [];
      const map: Record<string, QueueStats> = {};
      doctorList.forEach((d) => {
        map[d._id] = { doctorId: d._id, waiting: 0, inProgress: 0, done: 0 };
      });
      tokenList.forEach((t: { doctorId: { _id: string } | string; status: string }) => {
        const docId = typeof t.doctorId === 'object' ? t.doctorId._id : t.doctorId;
        if (map[docId]) {
          if (t.status === 'waiting')     map[docId].waiting++;
          if (t.status === 'in-progress') map[docId].inProgress++;
          if (t.status === 'done')        map[docId].done++;
        }
      });
      setStats(map);
    } catch {
      toast.error('Failed to load doctors');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialization || '').toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  );

  const specializationColors: Record<string, string> = {
    'General Medicine': '#6366F1',
    Cardiology: '#EF4444',
    Orthopedics: '#F59E0B',
    Pediatrics: '#22C55E',
    Neurology: '#8B5CF6',
    Dermatology: '#EC4899',
    ENT: '#06B6D4',
    Ophthalmology: '#14B8A6',
  };

  const getColor = (spec?: string) =>
    spec ? specializationColors[spec] || '#6366F1' : '#6B7280';

  return (
    <DashboardLayout title="Doctors" subtitle="Live status of all OPD doctors today" requiredRole="reception">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Doctors', value: doctors.length, color: '#6366F1', icon: '👨‍⚕️' },
            { label: 'Currently Busy', value: Object.values(stats).filter(s => s.inProgress > 0).length, color: '#F59E0B', icon: '🩺' },
            { label: 'Total Waiting', value: Object.values(stats).reduce((a, s) => a + s.waiting, 0), color: '#EF4444', icon: '⏳' },
            { label: 'Served Today', value: Object.values(stats).reduce((a, s) => a + s.done, 0), color: '#22C55E', icon: '✅' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍  Search by name or specialization…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 20,
            padding: '13px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#F9FAFB', fontSize: 14, outline: 'none',
          }}
        />

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>Loading doctors…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍⚕️</div>
            <p style={{ color: '#6B7280' }}>No doctors found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {filtered.map((doc, i) => {
              const s = stats[doc._id] || { waiting: 0, inProgress: 0, done: 0 };
              const accentColor = getColor(doc.specialization);
              const isActive = s.inProgress > 0;

              return (
                <div key={doc._id} style={{
                  background: isActive ? `rgba(${hexToRgb(accentColor)}, 0.06)` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? accentColor + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 18, padding: '22px 24px',
                  transition: 'all 0.2s',
                  animation: `fadeInUp 0.3s ease-out ${i * 0.04}s both`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                      background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)`,
                      border: `1px solid ${accentColor}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 800, color: accentColor,
                    }}>
                      {doc.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 2 }}>Dr. {doc.name}</div>
                      <div style={{ fontSize: 13, color: accentColor, fontWeight: 600 }}>
                        {doc.specialization || 'General'}
                      </div>
                      <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>{doc.email}</div>
                    </div>
                    {/* Status pill */}
                    <div style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.1)',
                      border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.2)',
                      color: isActive ? '#22C55E' : '#F59E0B',
                      flexShrink: 0,
                    }}>
                      {isActive ? '🟢 Seeing' : s.waiting > 0 ? '🟡 Wait' : '⚪ Free'}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                      { label: 'Waiting',    value: s.waiting,    color: '#F59E0B' },
                      { label: 'In Room',    value: s.inProgress, color: '#60A5FA' },
                      { label: 'Done Today', value: s.done,       color: '#22C55E' },
                    ].map((stat, j) => (
                      <div key={j} style={{ flex: 1, textAlign: 'center', padding: '12px 4px', borderRight: j < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
