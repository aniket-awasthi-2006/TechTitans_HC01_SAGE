'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import StatusBadge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import { calculateWaitTime, formatWaitTime } from '@/lib/wait-time';
import { sortWaitingByPriority } from '@/lib/queue-sort';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Ticket, Hourglass, Stethoscope, Timer, X,
  Plus, Search, User as UserIcon, ShieldAlert, ShieldCheck, TriangleAlert, Edit3,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Doctor {
  _id: string;
  name: string;
  specialization?: string;
  isAvailable?: boolean;
}

interface Patient {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  patientAge: number;
  patientGender?: 'male' | 'female' | 'other';
  patientPhone?: string;
  relationship?: string;
  bookedById?: { _id: string; name: string } | string;
  vitals?: { bp?: string; temp?: string; pulse?: string; weight?: string; spo2?: string };
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  isPriority?: boolean;
  priorityMarkedAt?: string;
  doctorId: { _id: string; name: string; specialization?: string } | string;
  createdAt: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const RELATIONSHIP_LABELS: Record<string, string> = {
  self: 'Self', spouse: 'Spouse', parent: 'Parent',
  child: 'Child', sibling: 'Sibling', other: 'Other',
};
const RELATIONSHIP_COLORS: Record<string, string> = {
  self: '#6366F1', spouse: '#EC4899', parent: '#F59E0B',
  child: '#22C55E', sibling: '#06B6D4', other: '#9CA3AF',
};

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export default function ReceptionDashboard() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [avgDuration, setAvgDuration] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [tokensRes, docRes, consultRes] = await Promise.all([
        fetch('/api/tokens', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users?role=doctor', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/consultations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [tokensData, docData, consultData] = await Promise.all([
        tokensRes.json(), docRes.json(), consultRes.json(),
      ]);
      setTokens(tokensData.tokens || []);
      setDoctors(docData.users || []);
      setAvgDuration(consultData.avgDuration || 10);
    } catch { toast.error('Failed to fetch data'); }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on('token_created', refresh);
    socket.on('token_updated', refresh);
    socket.on('queue_updated', refresh);
    socket.on('doctor_availability_changed', refresh);
    return () => {
      socket.off('token_created', refresh);
      socket.off('token_updated', refresh);
      socket.off('queue_updated', refresh);
      socket.off('doctor_availability_changed', refresh);
    };
  }, [socket, fetchData]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tokens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) toast.success(`Token marked as ${status}`);
      else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update');
      }
    } catch { toast.error('Network error'); }
  };

  const togglePriority = async (tokenItem: Token) => {
    if (tokenItem.status !== 'waiting') {
      toast.error('Only waiting patients can be marked as priority');
      return;
    }

    const nextPriority = !tokenItem.isPriority;

    try {
      const res = await fetch(`/api/tokens/${tokenItem._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPriority: nextPriority }),
      });
      if (res.ok) {
        toast.success(nextPriority ? 'Patient marked as priority' : 'Priority removed');
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update priority');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const toggleAvailability = async (doctor: Doctor) => {
    const goingUnavailable = doctor.isAvailable !== false;

    if (goingUnavailable) {
      // Count waiting patients for this doctor
      const waitingForDoc = tokens.filter(t => {
        const tDocId = typeof t.doctorId === 'object' ? t.doctorId._id : t.doctorId;
        return tDocId === doctor._id && t.status === 'waiting';
      });
      if (waitingForDoc.length > 0) {
        const ok = confirm(
          `⚠️ ${doctor.name} has ${waitingForDoc.length} patient(s) waiting.\n\nMarking unavailable will send an emergency notice to affected patients.\n\nContinue?`
        );
        if (!ok) return;
      }
    }

    try {
      const res = await fetch(`/api/users/${doctor._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isAvailable: !goingUnavailable }),
      });
      if (res.ok) {
        toast.success(`${doctor.name} marked as ${!goingUnavailable ? 'available ✅' : 'unavailable 🔴'}`);
        fetchData();
      } else toast.error('Failed to update availability');
    } catch { toast.error('Network error'); }
  };

  const openEditToken = (tokenItem: Token) => {
    if (tokenItem.status !== 'waiting') {
      toast.error('Only waiting patients can be edited.');
      return;
    }
    setEditingToken(tokenItem);
    setShowEditModal(true);
  };

  const waiting = tokens.filter(t => t.status === 'waiting');
  const inProgress = tokens.filter(t => t.status === 'in-progress');
  const getDoctorId = (doctorValue: Token['doctorId']) =>
    typeof doctorValue === 'object' ? doctorValue._id : doctorValue;

  const waitingByDoctor: Record<string, Token[]> = {};
  waiting.forEach((tokenItem) => {
    const docId = getDoctorId(tokenItem.doctorId);
    if (!docId) return;
    if (!waitingByDoctor[docId]) waitingByDoctor[docId] = [];
    waitingByDoctor[docId].push(tokenItem);
  });
  Object.keys(waitingByDoctor).forEach((docId) => {
    waitingByDoctor[docId] = sortWaitingByPriority(waitingByDoctor[docId]);
  });

  return (
    <DashboardLayout title="Reception Dashboard" subtitle="Manage OPD queue in real-time" requiredRole="reception">

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard title="Total Tokens Today" value={tokens.length}           icon={<Ticket size={20} />}    color="#6366F1" />
        <StatCard title="Waiting"            value={waiting.length}          icon={<Hourglass size={20} />} color="#F59E0B" />
        <StatCard title="In Progress"        value={inProgress.length}       icon={<Stethoscope size={20} />} color="#3B82F6" />
        <StatCard title="Avg Wait Time"      value={formatWaitTime(avgDuration)} icon={<Timer size={20} />} color="#22C55E" />
      </div>

      {/* ── Doctor Availability Panel ── */}
      <div className="glass-card" style={{ marginBottom: 24, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ShieldCheck size={16} color="#6366F1" />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', margin: 0 }}>Doctor Availability</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {doctors.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 13 }}>No doctors registered.</p>
          ) : doctors.map(d => {
            const isAvail = d.isAvailable !== false;
            const waitingCount = tokens.filter(t => {
              const tDocId = typeof t.doctorId === 'object' ? t.doctorId._id : t.doctorId;
              return tDocId === d._id && t.status === 'waiting';
            }).length;
            return (
              <div key={d._id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12,
                background: isAvail ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${isAvail ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                minWidth: 220,
              }}>
                {/* Status dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: isAvail ? '#22C55E' : '#EF4444',
                  boxShadow: isAvail ? '0 0 6px #22C55E' : '0 0 6px #EF4444',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    {d.specialization || 'General'}{waitingCount > 0 ? ` · ${waitingCount} waiting` : ''}
                  </div>
                </div>
                <button
                  onClick={() => toggleAvailability(d)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isAvail ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                    color: isAvail ? '#FCA5A5' : '#86EFAC',
                    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  {isAvail ? <><ShieldAlert size={12} /> Mark Unavailable</> : <><ShieldCheck size={12} /> Mark Available</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Queue Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#F9FAFB' }}>Queue — {format(new Date(), 'dd MMM yyyy')}</h2>
        <Button onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Create Token
        </Button>
      </div>

      {/* ── Queue Table ── */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading queue...</div>
        ) : tokens.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p>No tokens yet today. Create the first one!</p>
          </div>
        ) : (
          <table className="data-table" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Relation</th>
                <th>Booked By</th>
                <th>Age</th>
                <th>Doctor</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Wait</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map(t => {
                const doc = typeof t.doctorId === 'object' ? t.doctorId : null;
                const bookedBy = typeof t.bookedById === 'object' ? t.bookedById : null;
                const docId = getDoctorId(t.doctorId);
                const waitingForDoctor = docId ? (waitingByDoctor[docId] || []) : [];
                const patientsAhead = waitingForDoctor.findIndex(w => w._id === t._id);
                const wait = t.status === 'waiting' ? calculateWaitTime(patientsAhead, avgDuration) : 0;
                const rel = t.relationship || 'self';
                const relColor = RELATIONSHIP_COLORS[rel] || '#9CA3AF';
                return (
                  <tr key={t._id} style={{ opacity: t.status === 'cancelled' ? 0.5 : 1 }}>
                    <td>
                      <span style={{ fontSize: 18, fontWeight: 700, color: t.status === 'in-progress' ? '#60A5FA' : '#F9FAFB' }}>
                        #{t.tokenNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{t.patientName}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${relColor}20`, color: relColor, border: `1px solid ${relColor}40` }}>
                        {RELATIONSHIP_LABELS[rel] || rel}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {bookedBy ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <UserIcon size={12} /> {bookedBy.name}
                        </span>
                      ) : rel === 'self' ? '—' : <span style={{ color: '#6B7280' }}>Walk-in</span>}
                    </td>
                    <td style={{ color: '#9CA3AF' }}>{t.patientAge}y</td>
                    <td>
                      <span style={{ color: '#C4B5FD' }}>{doc?.name || 'Unassigned'}</span>
                      {doc && doctors.find(d => d._id === doc._id)?.isAvailable === false && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#EF4444', fontWeight: 700 }}>UNAVAIL.</span>
                      )}
                    </td>
                    <td>
                      {t.isPriority ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          padding: '3px 8px',
                          borderRadius: 999,
                          color: '#FCA5A5',
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid rgba(239,68,68,0.35)',
                        }}>
                          <TriangleAlert size={11} /> PRIORITY
                        </span>
                      ) : (
                        <span style={{ color: '#4B5563', fontSize: 12 }}>-</span>
                      )}
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ color: '#6B7280', fontSize: 13 }}>
                      {t.status === 'waiting' ? formatWaitTime(wait) : '—'}
                    </td>
                    <td style={{ minWidth: 240 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {t.status === 'waiting' && (
                          <button
                            className="btn-ghost"
                            style={{
                              height: 28,
                              padding: '0 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: t.isPriority ? '#FCA5A5' : '#FCD34D',
                              border: t.isPriority ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(245,158,11,0.35)',
                              background: t.isPriority ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                            }}
                            onClick={() => togglePriority(t)}
                          >
                            <TriangleAlert size={12} />
                            {t.isPriority ? 'Unmark Priority' : 'Mark Priority'}
                          </button>
                        )}
                        {t.status === 'waiting' && (
                          <button
                            className="btn-ghost"
                            style={{
                              height: 28,
                              padding: '0 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: '#A5B4FC',
                              border: '1px solid rgba(99,102,241,0.35)',
                              background: 'rgba(99,102,241,0.08)',
                            }}
                            onClick={() => openEditToken(t)}
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        )}
                        {!['done', 'cancelled'].includes(t.status) && (
                          <button className="btn-ghost" style={{ height: 28, padding: '0 8px', fontSize: 11, color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => updateStatus(t._id, 'cancelled')}>
                            <X size={12} /> {t.status === 'waiting' ? 'Remove' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Token Create Modal */}
      {showModal && (
        <TokenCreateModal
          doctors={doctors}
          token={token!}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchData(); }}
        />
      )}

      {showEditModal && editingToken && (
        <TokenEditModal
          key={editingToken._id}
          tokenItem={editingToken}
          doctors={doctors}
          token={token!}
          onClose={() => { setShowEditModal(false); setEditingToken(null); }}
          onSaved={() => { setShowEditModal(false); setEditingToken(null); fetchData(); }}
        />
      )}
    </DashboardLayout>
  );
}

/* ─── Token Create Modal ─────────────────────────────────────────────────────── */
function TokenCreateModal({
  doctors, token, onClose, onCreated,
}: {
  doctors: Doctor[];
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    patientName: '', patientAge: '', patientPhone: '',
    patientGender: 'other', doctorId: '', relationship: 'self', familyName: '',
    vitals: { bp: '', temp: '', pulse: '', weight: '', spo2: '' },
  });
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFamilyMember = form.relationship !== 'self';
  // Only show AVAILABLE doctors in the dropdown
  const availableDoctors = doctors.filter(d => d.isAvailable !== false);

  const handlePatientSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim() || q.length < 2) { setPatientResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/users?role=patient&search=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setPatientResults(data.users || []);
      } catch { /* ignore */ }
      setSearchLoading(false);
    }, 350);
  };

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p); setSearchQuery(p.name); setPatientResults([]);
    if (!form.patientPhone && p.phone) setForm(f => ({ ...f, patientPhone: p.phone || '' }));
  };

  const clearPatient = () => {
    setSelectedPatient(null); setSearchQuery(''); setPatientResults([]);
    setForm(f => ({ ...f, patientPhone: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doctorId) { toast.error('Please select a doctor'); return; }
    if (!form.patientPhone.trim()) { toast.error('Phone number is required'); return; }
    const finalPatientName = isFamilyMember
      ? form.familyName.trim()
      : (selectedPatient?.name || form.patientName.trim());
    if (!finalPatientName) {
      toast.error(isFamilyMember ? 'Family member name is required' : 'Patient name is required');
      return;
    }
    setIsLoading(true);
    try {
      const body = {
        doctorId: form.doctorId,
        patientAge: parseInt(form.patientAge) || 0,
        patientGender: form.patientGender,
        patientPhone: form.patientPhone,
        vitals: form.vitals,
        forSelf: !isFamilyMember,
        familyName: isFamilyMember ? form.familyName : undefined,
        familyRelationship: isFamilyMember ? form.relationship : undefined,
        bookedById: selectedPatient?._id,
        patientName: !isFamilyMember ? (selectedPatient?.name || form.patientName) : undefined,
      };
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { toast.success('Token created!'); onCreated(); }
      else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    } catch { toast.error('Network error'); }
    setIsLoading(false);
  };

  const setVital = (key: string, val: string) =>
    setForm(f => ({ ...f, vitals: { ...f.vitals, [key]: val } }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB' }}>Create OPD Token</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Registered Patient Search */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Search size={13} /> Registered Patient (optional)
            </label>
            <div style={{ position: 'relative' }}>
              {selectedPatient ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#A5B4FC', fontSize: 14 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{selectedPatient.email}{selectedPatient.phone ? ` · ${selectedPatient.phone}` : ''}</div>
                  </div>
                  <button type="button" onClick={clearPatient} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                    <input className="input-dark" placeholder="Search by name, email, or phone…" value={searchQuery} onChange={e => handlePatientSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                  </div>
                  {(patientResults.length > 0 || searchLoading) && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      {searchLoading ? (
                        <div style={{ padding: '10px 14px', color: '#6B7280', fontSize: 13 }}>Searching…</div>
                      ) : patientResults.map(p => (
                        <div key={p._id} onClick={() => selectPatient(p)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ fontWeight: 600, color: '#F9FAFB', fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Link to a registered patient so consultations appear in their history.</p>
          </div>

          {/* Relationship */}
          <div>
            <label className="form-label">Relationship to Registered Patient</label>
            <select className="select-dark" value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value, familyName: '' }))}>
              {Object.entries(RELATIONSHIP_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Family Member or Walk-in Name */}
          {isFamilyMember ? (
            <div>
              <label className="form-label">Family Member Name *</label>
              <input className="input-dark" placeholder={`e.g. ${form.relationship === 'spouse' ? 'Priya Sharma' : 'Full Name'}`} value={form.familyName} onChange={e => setForm(f => ({ ...f, familyName: e.target.value }))} required />
            </div>
          ) : !selectedPatient ? (
            <div>
              <label className="form-label">Patient Name * <span style={{ color: '#6B7280', fontWeight: 400 }}>(walk-in)</span></label>
              <input className="input-dark" placeholder="Full Name" value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} required />
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Age *</label>
              <input className="input-dark" type="number" placeholder="Age" value={form.patientAge} onChange={e => setForm(f => ({ ...f, patientAge: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select className="select-dark" value={form.patientGender} onChange={e => setForm(f => ({ ...f, patientGender: e.target.value }))}>
                <option value="other">Other</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Phone *</label>
            <input className="input-dark" placeholder="+91 XXXXXXXXXX" value={form.patientPhone} onChange={e => setForm(f => ({ ...f, patientPhone: e.target.value }))} required />
          </div>

          {/* Doctor — only available doctors */}
          <div>
            <label className="form-label">Assign Doctor *</label>
            {availableDoctors.length === 0 ? (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#FCA5A5' }}>
                ⚠️ No doctors are currently available.
              </div>
            ) : (
              <select className="select-dark" value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))} required>
                <option value="">Select Doctor</option>
                {availableDoctors.map(d => (
                  <option key={d._id} value={d._id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
                ))}
              </select>
            )}
          </div>

          {/* Vitals */}
          <div>
            <label className="form-label">Vitals (optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[['bp', 'BP (mmHg)'], ['temp', 'Temp (°F)'], ['pulse', 'Pulse (bpm)'], ['weight', 'Wt (kg)'], ['spo2', 'SpO2 (%)']].map(([key, label]) => (
                <input key={key} className="input-dark" placeholder={label} value={form.vitals[key as keyof typeof form.vitals]} onChange={e => setVital(key, e.target.value)} style={{ fontSize: 13 }} />
              ))}
            </div>
          </div>

          {/* Summary */}
          {(selectedPatient || isFamilyMember) && (
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#9CA3AF' }}>
              <span style={{ color: '#A5B4FC', fontWeight: 700 }}>Summary: </span>
              {isFamilyMember
                ? <>Token for <strong style={{ color: '#F9FAFB' }}>{form.familyName || '?'}</strong> ({RELATIONSHIP_LABELS[form.relationship]}){selectedPatient ? <>, under <strong style={{ color: '#A5B4FC' }}>{selectedPatient.name}</strong>&apos;s account</> : ', no linked account'}</>
                : <>Token for <strong style={{ color: '#F9FAFB' }}>{selectedPatient!.name}</strong> (self)</>
              }
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <Button type="submit" isLoading={isLoading} style={{ flex: 2 }}>Create Token</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TokenEditModal({
  tokenItem, doctors, token, onClose, onSaved,
}: {
  tokenItem: Token;
  doctors: Doctor[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const buildForm = (source: Token) => ({
    patientName: source.patientName || '',
    patientAge: String(source.patientAge || ''),
    patientGender: source.patientGender || 'other',
    patientPhone: source.patientPhone || '',
    relationship: source.relationship || 'self',
    doctorId: typeof source.doctorId === 'object' ? source.doctorId._id : source.doctorId,
    vitals: {
      bp: source.vitals?.bp || '',
      temp: source.vitals?.temp || '',
      pulse: source.vitals?.pulse || '',
      weight: source.vitals?.weight || '',
      spo2: source.vitals?.spo2 || '',
    },
  });

  const [form, setForm] = useState(() => buildForm(tokenItem));
  const [isSaving, setIsSaving] = useState(false);

  const setVital = (key: string, val: string) =>
    setForm(prev => ({ ...prev, vitals: { ...prev.vitals, [key]: val } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim()) { toast.error('Patient name is required'); return; }
    if (!form.patientPhone.trim()) { toast.error('Phone number is required'); return; }
    if (!form.doctorId) { toast.error('Please select a doctor'); return; }
    if (Number(form.patientAge) < 0) { toast.error('Age must be valid'); return; }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/tokens/${tokenItem._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName: form.patientName.trim(),
          patientAge: parseInt(form.patientAge, 10) || 0,
          patientGender: form.patientGender,
          patientPhone: form.patientPhone.trim(),
          relationship: form.relationship,
          doctorId: form.doctorId,
          vitals: form.vitals,
        }),
      });

      if (res.ok) {
        toast.success(`Token #${tokenItem.tokenNumber} updated`);
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update token');
      }
    } catch {
      toast.error('Network error');
    }
    setIsSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB', margin: 0 }}>
            Edit Token #{tokenItem.tokenNumber}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>
            ×
          </button>
        </div>

        <div style={{
          marginBottom: 14,
          padding: '9px 12px',
          borderRadius: 10,
          border: '1px solid rgba(245,158,11,0.25)',
          background: 'rgba(245,158,11,0.08)',
          color: '#FCD34D',
          fontSize: 12,
        }}>
          Editable only while patient is waiting (before being called).
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Patient Name *</label>
            <input
              className="input-dark"
              value={form.patientName}
              onChange={e => setForm(prev => ({ ...prev, patientName: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Age *</label>
              <input
                className="input-dark"
                type="number"
                min={0}
                value={form.patientAge}
                onChange={e => setForm(prev => ({ ...prev, patientAge: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select
                className="select-dark"
                value={form.patientGender}
                onChange={e => setForm(prev => ({ ...prev, patientGender: e.target.value as 'male' | 'female' | 'other' }))}
              >
                <option value="other">Other</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Phone *</label>
            <input
              className="input-dark"
              value={form.patientPhone}
              onChange={e => setForm(prev => ({ ...prev, patientPhone: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Relationship</label>
              <select
                className="select-dark"
                value={form.relationship}
                onChange={e => setForm(prev => ({ ...prev, relationship: e.target.value }))}
              >
                {Object.entries(RELATIONSHIP_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Assign Doctor *</label>
              <select
                className="select-dark"
                value={form.doctorId}
                onChange={e => setForm(prev => ({ ...prev, doctorId: e.target.value }))}
                required
              >
                <option value="">Select Doctor</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.name}{d.specialization ? ` - ${d.specialization}` : ''}{d.isAvailable === false ? ' (Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Vitals (optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[['bp', 'BP (mmHg)'], ['temp', 'Temp (°F)'], ['pulse', 'Pulse (bpm)'], ['weight', 'Wt (kg)'], ['spo2', 'SpO2 (%)']].map(([key, label]) => (
                <input
                  key={key}
                  className="input-dark"
                  placeholder={label}
                  value={form.vitals[key as keyof typeof form.vitals]}
                  onChange={e => setVital(key, e.target.value)}
                  style={{ fontSize: 13 }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <Button type="submit" isLoading={isSaving} style={{ flex: 2 }}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
