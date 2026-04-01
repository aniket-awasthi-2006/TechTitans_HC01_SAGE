'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import toast from 'react-hot-toast';

interface Consultation {
  _id: string;
  patientName: string;
  relationship?: string;
  bookedById?: { _id: string; name: string } | string | null;
  diagnosis: string;
  prescription: string;
  notes?: string;
  date: string;
  duration?: number;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  self: 'Self',
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  other: 'Other',
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  self:    '#6366F1',
  spouse:  '#EC4899',
  parent:  '#F59E0B',
  child:   '#22C55E',
  sibling: '#06B6D4',
  other:   '#9CA3AF',
};

export default function DoctorHistoryPage() {
  const { token } = useAuth();
  const [history, setHistory] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [relFilter, setRelFilter] = useState<string>('all');

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/consultations', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setHistory(data.consultations || []);
    } catch { toast.error('Failed to load history'); }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = history.filter(c => {
    const matchSearch =
      c.patientName.toLowerCase().includes(search.toLowerCase()) ||
      c.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
      c.prescription.toLowerCase().includes(search.toLowerCase());
    const matchRel = relFilter === 'all' || (c.relationship || 'self') === relFilter;
    return matchSearch && matchRel;
  });

  const familyConsultCount = history.filter(c => c.relationship && c.relationship !== 'self').length;

  return (
    <DashboardLayout title="Consultation History" subtitle="All your past patient consultations" requiredRole="doctor">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Consultations', value: history.length, color: '#6366F1' },
            { label: 'Family Members', value: familyConsultCount, color: '#EC4899' },
            { label: 'This Week', value: history.filter(c => { const d = new Date(c.date); const now = new Date(); return (now.getTime() - d.getTime()) < 7 * 86400000; }).length, color: '#22C55E' },
            { label: 'Avg Duration', value: history.length ? `${Math.round(history.reduce((a, c) => a + (c.duration || 10), 0) / history.length)}m` : '—', color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Relationship filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'self', 'spouse', 'parent', 'child', 'sibling', 'other'].map(rel => {
            const isActive = relFilter === rel;
            const color = rel === 'all' ? '#6366F1' : (RELATIONSHIP_COLORS[rel] || '#9CA3AF');
            return (
              <button
                key={rel}
                onClick={() => setRelFilter(rel)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: isActive ? `1.5px solid ${color}60` : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? `${color}18` : 'rgba(255,255,255,0.03)',
                  color: isActive ? color : '#6B7280',
                  transition: 'all 0.15s',
                }}
              >
                {rel === 'all' ? '👥 All' : RELATIONSHIP_LABELS[rel] || rel}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍  Search by patient, diagnosis, or medicine…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 20,
            padding: '13px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#F9FAFB', fontSize: 14, outline: 'none',
          }}
        />

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6B7280' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
            <p style={{ color: '#6B7280' }}>{search ? 'No results.' : 'No consultations yet.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((c, i) => {
              const isOpen = expanded === c._id;
              const rel = c.relationship || 'self';
              const relColor = RELATIONSHIP_COLORS[rel] || '#6366F1';
              const bookedBy = typeof c.bookedById === 'object' && c.bookedById
                ? c.bookedById.name
                : null;
              return (
                <div key={c._id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: isOpen ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, overflow: 'hidden',
                  transition: 'border-color 0.2s',
                  animation: `fadeInUp 0.3s ease-out ${i * 0.03}s both`,
                }}>
                  {/* Row */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : c._id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 800, color: relColor, minWidth: 36 }}>#{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>{c.patientName}</div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 12,
                          background: `${relColor}20`, color: relColor, border: `1px solid ${relColor}30`,
                        }}>
                          {RELATIONSHIP_LABELS[rel] || rel}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>🩺 {c.diagnosis}</div>
                      {bookedBy && rel !== 'self' && (
                        <div style={{ fontSize: 11, color: '#6366F1', marginTop: 2 }}>
                          👤 Booked by: {bookedBy}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {c.duration && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>⏱ {c.duration}m</div>}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <DetailBlock label="💊 Prescription" value={c.prescription} color="#A5B4FC" />
                      {c.notes && <DetailBlock label="📝 Doctor's Notes" value={c.notes} color="#FCD34D" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)" />}
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

function DetailBlock({ label, value, color, bg = 'rgba(255,255,255,0.04)', border = 'rgba(255,255,255,0.08)' }: { label: string; value: string; color: string; bg?: string; border?: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}
