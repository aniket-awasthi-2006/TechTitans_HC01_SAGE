'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import toast from 'react-hot-toast';

interface Consultation {
  _id: string;
  diagnosis: string;
  prescription: string;
  doctorName: string;
  date: string;
  notes?: string;
  patientName: string;
  relationship?: string;
  patientGender?: string;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: 'You (Self)',
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  other: 'Other',
};

const GENDER_ICONS: Record<string, string> = { male: '♂', female: '♀', other: '⚧' };

const RELATIONSHIP_COLORS: Record<string, string> = {
  self:    '#6366F1',
  spouse:  '#EC4899',
  parent:  '#F59E0B',
  child:   '#22C55E',
  sibling: '#06B6D4',
  other:   '#9CA3AF',
};

export default function PatientHistoryPage() {
  const { token, user } = useAuth();
  const [history, setHistory] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 'all' | patientName

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/consultations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data.consultations || []);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Group unique people
  const people = Array.from(
    new Map(history.map(c => [c.patientName, { name: c.patientName, relationship: c.relationship || 'self', gender: c.patientGender }])).values()
  );

  const filtered = history.filter(c => {
    const matchSearch = !search ||
      c.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
      c.doctorName.toLowerCase().includes(search.toLowerCase()) ||
      c.prescription.toLowerCase().includes(search.toLowerCase()) ||
      c.patientName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === 'all' || c.patientName === activeFilter;
    return matchSearch && matchFilter;
  });

  const color = (rel?: string) => RELATIONSHIP_COLORS[rel || 'self'] || '#6366F1';

  return (
    <DashboardLayout title="Medical History" subtitle="All consultations — you & your family" requiredRole="patient">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* ── People Tabs ── */}
        {people.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '8px 18px', borderRadius: 30, fontSize: 13, fontWeight: 600,
                border: activeFilter === 'all' ? '1.5px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.1)',
                background: activeFilter === 'all' ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                color: activeFilter === 'all' ? '#A5B4FC' : '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              👥 Everyone ({history.length})
            </button>
            {people.map(p => {
              const rel = p.relationship || 'self';
              const isMe = rel === 'self';
              const label = isMe ? `👤 ${user?.name?.split(' ')[0]}` : `${p.name.split(' ')[0]}`;
              const count = history.filter(c => c.patientName === p.name).length;
              const accent = color(rel);
              const isActive = activeFilter === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => setActiveFilter(p.name)}
                  style={{
                    padding: '8px 18px', borderRadius: 30, fontSize: 13, fontWeight: 600,
                    border: isActive ? `1.5px solid ${accent}60` : '1px solid rgba(255,255,255,0.1)',
                    background: isActive ? `${accent}20` : 'rgba(255,255,255,0.04)',
                    color: isActive ? accent : '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Search ── */}
        <input
          type="text"
          placeholder="🔍  Search by diagnosis, doctor, or medicine…"
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
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
            <p style={{ color: '#6B7280', fontSize: 15 }}>
              {search ? 'No results found.' : 'No consultation history yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((c, i) => {
              const rel = c.relationship || 'self';
              const isSelf = rel === 'self';
              const accent = color(rel);

              return (
                <div key={c._id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${accent}25`,
                  borderRadius: 16, padding: '20px 22px',
                  animation: `fadeInUp 0.3s ease-out ${i * 0.04}s both`,
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Person avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: `${accent}20`, border: `1px solid ${accent}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 800, color: accent,
                      }}>
                        {c.patientName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>
                            {isSelf ? `${c.patientName} (You)` : c.patientName}
                          </span>
                          {c.patientGender && (
                            <span style={{ fontSize: 11, color: '#6B7280' }}>
                              {GENDER_ICONS[c.patientGender]}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          <span style={{ color: accent, fontWeight: 600, background: `${accent}15`, padding: '1px 8px', borderRadius: 20, fontSize: 11 }}>
                            {RELATIONSHIP_LABELS[rel] || rel}
                          </span>
                          <span style={{ color: '#4B5563', marginLeft: 8 }}>· Dr. {c.doctorName}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right', flexShrink: 0 }}>
                      📅 {new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', marginBottom: 6 }}>DIAGNOSIS</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#E5E7EB' }}>🩺 {c.diagnosis}</div>
                  </div>

                  {/* Prescription */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: c.notes ? 10 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', marginBottom: 6 }}>PRESCRIPTION</div>
                    <div style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.5 }}>💊 {c.prescription}</div>
                  </div>

                  {/* Doctor's notes */}
                  {c.notes && (
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', letterSpacing: '0.06em', marginBottom: 4 }}>DOCTOR'S NOTES</div>
                      <div style={{ fontSize: 13, color: '#FCD34D', lineHeight: 1.5 }}>📝 {c.notes}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
